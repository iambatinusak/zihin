import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_PREFS,
  InviteCodeSchema,
  LeaderboardOptInSchema,
  ProfileSettingsSchema,
  StudySettingsSchema,
  UnlinkParentSchema,
  normalizeInviteCode,
  parseNotificationPrefs,
} from './schemas'

const UUID = '4d0f5f18-2f43-4c3f-8a0f-0f9a3a2b1c00'

describe('normalizeInviteCode', () => {
  it('küçük harfleri büyütür', () => {
    expect(normalizeInviteCode('abcd2345')).toBe('ABCD2345')
  })

  it('boşluk, tire ve alt çizgiyi atar', () => {
    expect(normalizeInviteCode(' ab-cd 23_45 ')).toBe('ABCD2345')
  })

  it('Türkçe i harfini alfabenin dışına taşımaz', () => {
    // toUpperCase() tr yerel ayarında 'İ' üretebilirdi; kod alfabesi bunu tanımaz.
    expect(normalizeInviteCode('i')).toBe('I')
  })

  it('zaten normal olan kodu değiştirmez', () => {
    expect(normalizeInviteCode('QWXZ9876')).toBe('QWXZ9876')
  })

  it('boş girdide boş döner', () => {
    expect(normalizeInviteCode('')).toBe('')
  })
})

describe('InviteCodeSchema', () => {
  it('normalleştirilmiş geçerli kodu kabul eder', () => {
    const parsed = InviteCodeSchema.parse({ code: 'ab-cd 2345' })
    expect(parsed.code).toBe('ABCD2345')
  })

  it('kısa kodu reddeder', () => {
    expect(InviteCodeSchema.safeParse({ code: 'ABC123' }).success).toBe(false)
  })

  it('uzun kodu reddeder', () => {
    expect(InviteCodeSchema.safeParse({ code: 'ABCD23456' }).success).toBe(false)
  })

  it('alfabede olmayan karakterleri reddeder (0, 1, O, I, L)', () => {
    for (const code of ['ABCD234O', 'ABCD2340', 'ABCD2341', 'ABCD234I', 'ABCD234L']) {
      expect(InviteCodeSchema.safeParse({ code }).success).toBe(false)
    }
  })

  it('noktalama içeren kodu reddeder', () => {
    expect(InviteCodeSchema.safeParse({ code: 'ABCD.345' }).success).toBe(false)
  })
})

describe('ProfileSettingsSchema', () => {
  const valid = {
    fullName: 'Ayşe Yılmaz',
    displayName: 'ayse',
    avatarUrl: 'https://ornek.com/a.png',
    grade: '11',
  }

  it('geçerli girdiyi kabul eder', () => {
    expect(ProfileSettingsSchema.parse(valid).grade).toBe('11')
  })

  it('boş görünen adı ve avatarı null yapar', () => {
    const parsed = ProfileSettingsSchema.parse({ ...valid, displayName: '  ', avatarUrl: '' })
    expect(parsed.displayName).toBeNull()
    expect(parsed.avatarUrl).toBeNull()
  })

  it('boş sınıfı null yapar', () => {
    expect(ProfileSettingsSchema.parse({ ...valid, grade: '' }).grade).toBeNull()
  })

  it('listede olmayan sınıfı reddeder', () => {
    expect(ProfileSettingsSchema.safeParse({ ...valid, grade: '13' }).success).toBe(false)
    expect(ProfileSettingsSchema.safeParse({ ...valid, grade: 'universite' }).success).toBe(false)
  })

  it('veritabanı listesindeki tüm sınıfları kabul eder', () => {
    for (const grade of ['8', '9', '10', '11', '12', 'mezun', 'yetiskin']) {
      expect(ProfileSettingsSchema.safeParse({ ...valid, grade }).success).toBe(true)
    }
  })

  it('çok kısa adı reddeder', () => {
    expect(ProfileSettingsSchema.safeParse({ ...valid, fullName: 'A' }).success).toBe(false)
  })

  it('http bağlantısını reddeder', () => {
    expect(
      ProfileSettingsSchema.safeParse({ ...valid, avatarUrl: 'http://ornek.com/a.png' }).success,
    ).toBe(false)
  })
})

describe('StudySettingsSchema', () => {
  const valid = {
    examId: UUID,
    targetExamDate: '2026-06-20',
    dailyMinutes: 90,
    studyDays: [1, 3, 5],
  }

  it('geçerli girdiyi kabul eder', () => {
    expect(StudySettingsSchema.parse(valid).dailyMinutes).toBe(90)
  })

  it('sınav ve tarih boşsa null yapar', () => {
    const parsed = StudySettingsSchema.parse({ ...valid, examId: '', targetExamDate: '' })
    expect(parsed.examId).toBeNull()
    expect(parsed.targetExamDate).toBeNull()
  })

  it('günleri sıralar', () => {
    expect(StudySettingsSchema.parse({ ...valid, studyDays: [7, 2, 5] }).studyDays).toEqual([
      2, 5, 7,
    ])
  })

  it('boş gün listesini reddeder', () => {
    expect(StudySettingsSchema.safeParse({ ...valid, studyDays: [] }).success).toBe(false)
  })

  it('aralık dışı günü reddeder', () => {
    expect(StudySettingsSchema.safeParse({ ...valid, studyDays: [0] }).success).toBe(false)
    expect(StudySettingsSchema.safeParse({ ...valid, studyDays: [8] }).success).toBe(false)
    expect(StudySettingsSchema.safeParse({ ...valid, studyDays: [-1] }).success).toBe(false)
  })

  it('tekrarlı günü reddeder', () => {
    expect(StudySettingsSchema.safeParse({ ...valid, studyDays: [1, 1] }).success).toBe(false)
  })

  it('yedi günün tamamını kabul eder', () => {
    expect(
      StudySettingsSchema.safeParse({ ...valid, studyDays: [1, 2, 3, 4, 5, 6, 7] }).success,
    ).toBe(true)
  })

  it('günlük süre sınırlarını veritabanıyla aynı uygular', () => {
    expect(StudySettingsSchema.safeParse({ ...valid, dailyMinutes: 15 }).success).toBe(true)
    expect(StudySettingsSchema.safeParse({ ...valid, dailyMinutes: 720 }).success).toBe(true)
    expect(StudySettingsSchema.safeParse({ ...valid, dailyMinutes: 14 }).success).toBe(false)
    expect(StudySettingsSchema.safeParse({ ...valid, dailyMinutes: 721 }).success).toBe(false)
  })

  it('ondalıklı süreyi reddeder', () => {
    expect(StudySettingsSchema.safeParse({ ...valid, dailyMinutes: 90.5 }).success).toBe(false)
  })

  it('metin olarak gelen süreyi sayıya çevirir', () => {
    expect(StudySettingsSchema.parse({ ...valid, dailyMinutes: '60' }).dailyMinutes).toBe(60)
  })

  it('bozuk tarihi reddeder', () => {
    expect(StudySettingsSchema.safeParse({ ...valid, targetExamDate: '20.06.2026' }).success).toBe(
      false,
    )
    expect(StudySettingsSchema.safeParse({ ...valid, targetExamDate: '2026-13-45' }).success).toBe(
      false,
    )
  })

  it('uuid olmayan sınav kimliğini reddeder', () => {
    expect(StudySettingsSchema.safeParse({ ...valid, examId: 'yks' }).success).toBe(false)
  })
})

describe('parseNotificationPrefs', () => {
  it('tam nesneyi olduğu gibi döner', () => {
    const prefs = {
      email_reminders: false,
      email_weekly_summary: true,
      app_notifications: false,
    }
    expect(parseNotificationPrefs(prefs)).toEqual(prefs)
  })

  it('eksik anahtarları varsayılanla tamamlar', () => {
    expect(parseNotificationPrefs({ email_reminders: false })).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      email_reminders: false,
    })
  })

  it('null ve bozuk değerde varsayılana döner', () => {
    expect(parseNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS)
    expect(parseNotificationPrefs('acik')).toEqual(DEFAULT_NOTIFICATION_PREFS)
    expect(parseNotificationPrefs({ email_reminders: 'evet' })).toEqual(DEFAULT_NOTIFICATION_PREFS)
  })
})

describe('LeaderboardOptInSchema', () => {
  it('yalnızca boolean kabul eder', () => {
    expect(LeaderboardOptInSchema.safeParse({ optIn: true }).success).toBe(true)
    expect(LeaderboardOptInSchema.safeParse({ optIn: 'true' }).success).toBe(false)
  })
})

describe('UnlinkParentSchema', () => {
  it('tek tarafın kimliği yeterlidir', () => {
    expect(UnlinkParentSchema.safeParse({ parentId: UUID }).success).toBe(true)
    expect(UnlinkParentSchema.safeParse({ studentId: UUID }).success).toBe(true)
  })

  it('iki taraf da boşsa reddeder', () => {
    expect(UnlinkParentSchema.safeParse({}).success).toBe(false)
  })

  it('uuid olmayan kimliği reddeder', () => {
    expect(UnlinkParentSchema.safeParse({ parentId: '42' }).success).toBe(false)
  })
})
