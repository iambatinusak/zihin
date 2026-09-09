import { describe, expect, it } from 'vitest'
import {
  RegisterParentSchema,
  RegisterStudentSchema,
  ResetPasswordSchema,
  SignInSchema,
  passwordSchema,
} from './schemas'
import { inviteCodeField } from '@/lib/invite-code'

const validStudent = {
  fullName: 'Ayşe Yılmaz',
  email: 'Ayse@Example.COM',
  password: 'sifre1234',
  passwordConfirm: 'sifre1234',
  kvkkConsent: true as const,
}

describe('passwordSchema', () => {
  it('kuralı sağlayan şifreyi kabul eder', () => {
    expect(passwordSchema.safeParse('abcdefg1').success).toBe(true)
    expect(passwordSchema.safeParse('Şifre2026').success).toBe(true)
  })

  it('kısa, rakamsız veya harfsiz şifreyi reddeder', () => {
    expect(passwordSchema.safeParse('abc1').success).toBe(false)
    expect(passwordSchema.safeParse('abcdefghij').success).toBe(false)
    expect(passwordSchema.safeParse('12345678').success).toBe(false)
  })
})

describe('RegisterStudentSchema', () => {
  it('e-postayı küçük harfe çevirir', () => {
    const parsed = RegisterStudentSchema.parse(validStudent)
    expect(parsed.email).toBe('ayse@example.com')
  })

  it('şifreler eşleşmezse hatayı passwordConfirm alanına koyar', () => {
    const result = RegisterStudentSchema.safeParse({
      ...validStudent,
      passwordConfirm: 'baskabir1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.passwordConfirm).toEqual(['Şifreler eşleşmiyor.'])
    }
  })

  it('KVKK onayı olmadan geçmez', () => {
    const result = RegisterStudentSchema.safeParse({ ...validStudent, kvkkConsent: false })
    expect(result.success).toBe(false)
  })
})

describe('inviteCodeField', () => {
  it('kodu büyük harfe çevirir ve ayırıcıları temizler', () => {
    expect(inviteCodeField.parse(' ab23cd45 ')).toBe('AB23CD45')
    // Kod sözlü paylaşılıyor; tire ve boşlukla yazılan kod da kabul edilmeli.
    expect(inviteCodeField.parse('AB23-CD45')).toBe('AB23CD45')
    expect(inviteCodeField.parse('ab23 cd45')).toBe('AB23CD45')
  })

  it('uzunluğu ve karakter kümesini denetler', () => {
    expect(inviteCodeField.safeParse('AB23CD4').success).toBe(false)
    expect(inviteCodeField.safeParse('AB23CD456').success).toBe(false)
  })

  /**
   * `generate_invite_code()` 0/O ve 1/I/L üretmez; şema da üretmez.
   * Aksi hâlde kullanıcıya var olamayacak bir kodu "geçerli" gösterirdik.
   */
  it('karıştırılması kolay karakterleri reddeder', () => {
    for (const code of ['AB01CD23', 'ABI2CD34', 'ABL2CD34', 'ABO2CD34']) {
      expect(inviteCodeField.safeParse(code).success).toBe(false)
    }
  })
})

describe('RegisterParentSchema', () => {
  it('davet kodu zorunludur', () => {
    expect(RegisterParentSchema.safeParse(validStudent).success).toBe(false)
    expect(
      RegisterParentSchema.safeParse({ ...validStudent, inviteCode: 'ab23-cd45' }).success,
    ).toBe(true)
  })
})

describe('SignInSchema', () => {
  it('girişte şifre kuralı uygulanmaz', () => {
    expect(SignInSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
    expect(SignInSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})

describe('ResetPasswordSchema', () => {
  it('eşleşen ve kurallı şifreyi kabul eder', () => {
    expect(
      ResetPasswordSchema.safeParse({ password: 'yeni1234', passwordConfirm: 'yeni1234' }).success,
    ).toBe(true)
  })
})
