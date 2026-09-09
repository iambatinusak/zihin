import { z } from 'zod'

/**
 * Veli davet kodunun TEK tanımı.
 *
 * Kod iki ayrı yerde giriliyor — kayıt formunda (`/register`, veli sekmesi) ve
 * veli panelindeki öğrenci ekleme formunda. Bir süre iki ayrı şema vardı:
 * biri `[A-Z0-9]` kabul edip ayırıcıları reddediyor, diğeri gerçek alfabeye
 * bakıp tire/boşluğu temizliyordu. Aynı kod bir formda geçip diğerinde
 * reddediliyordu. Kaynak burasıdır; iki taraf da bunu içe aktarır.
 *
 * Alfabe 0002_identity.sql'deki `generate_invite_code()` ile birebir aynıdır:
 * karıştırılması kolay 0/O ve 1/I/L karakterleri bilerek yok.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const INVITE_CODE_LENGTH = 8

const INVITE_CODE_PATTERN = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`)

/**
 * Kod telefonda sözlü paylaşılıyor; kullanıcı "abcd-2345" ya da "ABCD 2345"
 * yazıyor. Boşluk, tire ve alt çizgi atılır, harfler büyütülür.
 *
 * `toUpperCase()` yerine harf harf eşleme: Türkçe yerel ayarda 'i' → 'İ'
 * dönüşümü kodu alfabenin dışına çıkarırdı.
 */
export function normalizeInviteCode(raw: string): string {
  let out = ''
  for (const char of raw) {
    if (char === ' ' || char === '-' || char === '_' || char === '\t') continue
    const upper = char >= 'a' && char <= 'z' ? String.fromCharCode(char.charCodeAt(0) - 32) : char
    out += upper
  }
  return out
}

export const INVITE_CODE_MESSAGE = 'Davet kodu 8 haneli olmalı ve yalnızca harf ile rakam içermeli.'

/** Ayırıcıları temizleyip alfabeye göre doğrulayan alan şeması. */
export const inviteCodeField = z
  .string({ required_error: 'Davet kodunu girin.' })
  .transform(normalizeInviteCode)
  .refine((code) => INVITE_CODE_PATTERN.test(code), INVITE_CODE_MESSAGE)

/** Tek alanlı gövde; veli bağlama action'ının girdisi. */
export const InviteCodeSchema = z.object({ code: inviteCodeField })

export type InviteCodeInput = z.infer<typeof InviteCodeSchema>
