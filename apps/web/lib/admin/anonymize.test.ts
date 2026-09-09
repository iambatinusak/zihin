import { describe, expect, it } from 'vitest'
import {
  ANONYMIZED_NAME,
  anonymizedEmail,
  anonymizedProfileFields,
  isAnonymizedEmail,
} from './anonymize'

describe('anonymizedProfileFields', () => {
  it('yalnızca kimlik taşıyan alanları döner', () => {
    expect(Object.keys(anonymizedProfileFields()).sort()).toEqual([
      'avatar_url',
      'display_name',
      'full_name',
      'invite_code',
      'leaderboard_opt_in',
    ])
  })

  it('ad alanlarını kimliksiz metinle değiştirir', () => {
    const fields = anonymizedProfileFields()
    expect(fields.full_name).toBe(ANONYMIZED_NAME)
    expect(fields.display_name).toBe(ANONYMIZED_NAME)
  })

  it('avatarı, davet kodunu ve liderlik onayını temizler', () => {
    const fields = anonymizedProfileFields()
    expect(fields.avatar_url).toBeNull()
    expect(fields.invite_code).toBeNull()
    expect(fields.leaderboard_opt_in).toBe(false)
  })

  it('öğrenme istatistiği taşıyan hiçbir kolona dokunmaz', () => {
    const keys = Object.keys(anonymizedProfileFields())
    for (const kept of ['xp', 'level', 'current_streak', 'longest_streak', 'role', 'grade']) {
      expect(keys).not.toContain(kept)
    }
  })

  it('her çağrıda aynı sonucu verir', () => {
    expect(anonymizedProfileFields()).toEqual(anonymizedProfileFields())
  })
})

describe('anonymizedEmail', () => {
  it('kimlikten yönlendirilemeyen bir adres türetir', () => {
    expect(anonymizedEmail('A1B2-C3')).toBe('anonim+a1b2-c3@anonim.invalid')
  })

  it('boşlukları kırpar', () => {
    expect(anonymizedEmail('  x  ')).toBe('anonim+x@anonim.invalid')
  })

  it('boş kimliği reddeder', () => {
    expect(() => anonymizedEmail('   ')).toThrow()
  })
})

describe('isAnonymizedEmail', () => {
  it('yer tutucu adresi tanır', () => {
    expect(isAnonymizedEmail(anonymizedEmail('abc'))).toBe(true)
    expect(isAnonymizedEmail('ANONIM+ABC@ANONIM.INVALID')).toBe(true)
  })

  it('gerçek adresi ve boş değeri tanımaz', () => {
    expect(isAnonymizedEmail('ali@example.com')).toBe(false)
    expect(isAnonymizedEmail(null)).toBe(false)
    expect(isAnonymizedEmail('')).toBe(false)
  })
})
