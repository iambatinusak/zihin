'use server'

import { revalidatePath } from 'next/cache'
import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { deliverNotificationsQuietly } from '@/lib/notifications/deliver'
import { helpStrings } from '@/components/help/strings'
import { MAX_MESSAGES_PER_REQUEST, toHelpAppError } from '@/lib/help/db-errors'
import { countHelpMessages, getHelpRequest } from '@/lib/data/help'
import { AnswerHelpRequestSchema } from './schemas'

/**
 * Öğretmen panelinin mutasyonları (spec §M11).
 *
 * KAPSAM SINIRI — BU DOSYA ÖĞRENCİNİN ÇALIŞMA VERİSİNE DOKUNMAZ. Öğretmen
 * yalnızca `help_requests` / `help_messages` satırlarını ve bildirimi yazar;
 * `attempts`, `topic_mastery`, `study_plans` ve `flashcards` bu modülden
 * ERİŞİLMEZ. Öğretmenin işi yanıtlamaktır, öğrencinin ilerlemesini elle
 * değiştirmek değil.
 */

export type AnswerHelpRequestResult = {
  requestId: string
  /** Bu yanıttan sonra soru altında kaç mesaj hakkı kaldı. */
  remainingMessages: number
}

/**
 * Soruyu yanıtlar.
 *
 * Üç yazma tek akışta: mesaj eklenir, soru `answered` olarak damgalanır ve
 * öğrenciye bildirim düşer.
 *
 * `answered_at` YALNIZCA İLK yanıtta damgalanır — SLA raporları ilk yanıt
 * süresini ölçüyor (0007'deki kolon yorumu), ikinci mesaj o ölçümü bozmamalı.
 *
 * ── ÜSTLENME KURALI ────────────────────────────────────────────────────────
 * Sahipsiz bir soruyu HERHANGİ bir öğretmen yanıtlayabilir; ilk yanıt soruyu
 * üstlenir (`assigned_teacher_id`). Üstlenilmiş bir soruya ise ARTIK YALNIZCA
 * o öğretmen (ya da bir yönetici) yazabilir.
 *
 * Neden kural bu: RLS bu kapıyı tutmuyor — 0011'deki
 * `help_messages_insert_participant` politikası `public.is_teacher()` diyor,
 * yani veritabanı açısından her öğretmen her sorunun altına yazabilir. Denetim
 * yoksa ikinci bir öğretmen başkasının konuşmasına girip 5 mesajlık sınırı
 * tüketebilir ve öğrenci tek soruda iki farklı ses duyar. Bir Server Action
 * herkese açık bir uç noktadır; kuralı burada uygularız.
 *
 * Yönetici dışarıda tutuldu: devredilemeyen bir soru, öğretmen ayrıldığında
 * kuyrukta sonsuza kadar kalırdı.
 */
export const answerHelpRequest = action(
  AnswerHelpRequestSchema,
  async (input): Promise<AnswerHelpRequestResult> => {
    const teacher = await assertRole(['teacher', 'admin'])
    const supabase = await createSupabaseServerClient()
    const s = helpStrings()

    const request = await getHelpRequest(supabase, input.requestId)

    if (request.status === 'closed') {
      throw new AppError('conflict', 'Bu soru kapatılmış; yanıtlanamaz.')
    }

    assertMayAnswer(request.assigned_teacher_id, teacher.id, teacher.role === 'admin')

    const count = await countHelpMessages(supabase, request.id)
    if (count >= MAX_MESSAGES_PER_REQUEST) {
      throw new AppError(
        'conflict',
        'Bu soru altında en fazla 5 mesaj gönderilebilir; yeni mesaj eklenemez.',
      )
    }

    const { error: messageError } = await supabase.from('help_messages').insert({
      request_id: request.id,
      sender_id: teacher.id,
      body: composeAnswerBody(input.body, input.videoUrl ?? null),
      image_url: input.imageUrl ?? null,
    })

    if (messageError) {
      throw toHelpAppError(messageError, 'Yanıtınız kaydedilemedi. Lütfen tekrar deneyin.')
    }

    const { error: updateError } = await supabase
      .from('help_requests')
      .update({
        status: 'answered',
        answered_at: request.answered_at ?? new Date().toISOString(),
        assigned_teacher_id: request.assigned_teacher_id ?? teacher.id,
      })
      .eq('id', request.id)

    if (updateError) {
      throw toHelpAppError(updateError, 'Soru durumu güncellenemedi.')
    }

    await notifyStudentQuietly(
      request.student_id,
      request.id,
      s.notificationTitle,
      s.notificationBody,
    )

    revalidatePath('/ogretmen/sorular')
    revalidatePath(`/ogretmen/sorular/${request.id}`)
    return {
      requestId: request.id,
      remainingMessages: MAX_MESSAGES_PER_REQUEST - (count + 1),
    }
  },
)

/**
 * Soruyu bu öğretmen yanıtlayabilir mi?
 *
 * Sahipsiz soru herkese açıktır; üstlenilmiş soru yalnızca sahibine (ve
 * yöneticiye). Hata mesajı öğretmenin kimliğini SIZDIRMAZ — kuyruğu gören her
 * öğretmen kimin hangi soruyu aldığını bilmek zorunda değil.
 */
function assertMayAnswer(
  assignedTeacherId: string | null,
  teacherId: string,
  isAdmin: boolean,
): void {
  if (assignedTeacherId === null) return
  if (assignedTeacherId === teacherId) return
  if (isAdmin) return

  throw new AppError('forbidden', 'Bu soruyu başka bir öğretmen üstlendi.')
}

/**
 * Çözüm videosu bağlantısı yanıt metnine markdown bağlantısı olarak eklenir.
 * Ayrı bir kolon yok (0007) ve mesaj gövdesi zaten paylaşılan markdown
 * işleyicisiyle basılıyor; bağlantı orada güvenle temizleniyor.
 */
function composeAnswerBody(body: string, videoUrl: string | null): string {
  if (!videoUrl) return body
  return `${body}\n\n[Çözüm videosu](${videoUrl})`
}

/**
 * Öğrenciye bildirim yazar.
 *
 * `notifications` tablosunun INSERT politikası YOKTUR (0011): bildirimleri
 * yalnızca sistem üretir, bu yüzden service-role gerekir. Yazma tek kapıdan
 * geçer (`lib/notifications/deliver.ts`), böylece uygulama içi bildirimi
 * kapatmış öğrenciye satır yazılmaz. Hata yutulur — bildirim yazılamaması
 * öğretmenin yanıtını geri almamalı.
 */
async function notifyStudentQuietly(
  studentId: string,
  requestId: string,
  title: string,
  body: string,
): Promise<void> {
  const admin = createSupabaseAdminClient()
  await deliverNotificationsQuietly(admin, [
    {
      userId: studentId,
      type: 'help_answered',
      title,
      body,
      link: `/soru-sor/${requestId}`,
    },
  ])
}
