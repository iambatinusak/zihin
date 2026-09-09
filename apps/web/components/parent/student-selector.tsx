import { Label } from '@zihin/ui/label'
import { Button } from '@zihin/ui/button'
import { parentStrings } from './strings'

export type StudentOption = { id: string; name: string }

type StudentSelectorProps = {
  students: StudentOption[]
  selectedId: string
  /** Formun gideceği yol; seçim adres çubuğunda taşınır. */
  action: string
  /** Seçili hafta korunsun diye gizli alan olarak taşınır. */
  weekStart?: string
}

/**
 * Bağlı öğrenciler arasında geçiş.
 *
 * GET formu: seçim adres çubuğunda (`?ogrenci=`) kalır, sayfa yenilenince
 * bağlam kaybolmaz ve JavaScript olmadan da çalışır.
 *
 * ── GÖNDERME NEDEN AÇIK BİR DÜĞMEYLE ───────────────────────────────────────
 * Önceki hâli `onChange` ile formu kendiliğinden gönderiyordu. Bu, KLAVYE
 * KULLANICISINI KAPANA KISTIRIYOR: Firefox'ta (ve ekran okuyucuların sanal
 * imleç kipinde) kapalı bir `select` üzerinde ok tuşuna basmak her seferinde
 * `change` üretir, yani listenin ikinci öğesine inen kullanıcı üçüncüye
 * geçemeden sayfa yeniden yükleniyordu. Fareyle seçim yapan kullanıcının
 * kazandığı tek tıklama, klavyeyle gezinen kullanıcının seçimi
 * tamamlayamamasına değmez.
 *
 * Düğme bu yüzden HER ZAMAN görünür — `<noscript>` içinde saklı değil.
 *
 * Kimlik doğrulaması burada YAPILMAZ: gönderilen değer sunucuda velinin bağlı
 * öğrenci kümesiyle karşılaştırılır (lib/parent/select.ts). Bu bileşen yalnızca
 * bir tercih taşıyıcısıdır.
 */
export function StudentSelector({ students, selectedId, action, weekStart }: StudentSelectorProps) {
  const s = parentStrings()

  if (students.length < 2) return null

  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3">
      {weekStart ? <input type="hidden" name="hafta" value={weekStart} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="veli-ogrenci-secimi">{s.selector.label}</Label>
        <select
          id="veli-ogrenci-secimi"
          name="ogrenci"
          defaultValue={selectedId}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full min-w-56 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" variant="secondary">
        {s.selector.submit}
      </Button>
    </form>
  )
}
