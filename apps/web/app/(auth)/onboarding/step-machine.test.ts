import { describe, expect, it } from 'vitest'
import {
  homeForRole,
  lastStepForRole,
  nextStep,
  previousStep,
  progressPercent,
  resolveResumeStep,
  stepsForRole,
} from './step-machine'
import {
  DAILY_MINUTES_OPTIONS,
  ExamDateStepSchema,
  GRADES,
  OnboardingStepInputSchema,
  ScheduleStepSchema,
  TOTAL_STEPS,
} from './schemas'

describe('stepsForRole', () => {
  it('öğrenci altı adımın tamamını yürür', () => {
    expect(stepsForRole('student')).toEqual([1, 2, 3, 4, 5, 6])
    expect(stepsForRole('student')).toHaveLength(TOTAL_STEPS)
  })

  it('veli yalnızca rol adımını yürür', () => {
    expect(stepsForRole('parent')).toEqual([1])
    expect(lastStepForRole('parent')).toBe(1)
  })
})

describe('nextStep', () => {
  it('öğrenci için sırayla ilerler', () => {
    expect(nextStep('student', 1)).toBe(2)
    expect(nextStep('student', 4)).toBe(5)
  })

  it('son adımdan sonra null döner', () => {
    expect(nextStep('student', 6)).toBeNull()
    expect(nextStep('parent', 1)).toBeNull()
  })

  it('bilinmeyen adımdan ilk adıma döner', () => {
    expect(nextStep('student', 99)).toBe(1)
    expect(nextStep('parent', 3)).toBe(1)
  })
})

describe('previousStep', () => {
  it('bir önceki adımı döner', () => {
    expect(previousStep('student', 3)).toBe(2)
    expect(previousStep('student', 6)).toBe(5)
  })

  it('ilk adımda geri gidilecek yer yoktur', () => {
    expect(previousStep('student', 1)).toBeNull()
    expect(previousStep('parent', 1)).toBeNull()
  })
})

describe('resolveResumeStep', () => {
  it('hiç adım tamamlanmadıysa ilk adımdan başlar', () => {
    expect(resolveResumeStep('student', 0)).toBe(1)
    expect(resolveResumeStep('parent', 0)).toBe(1)
  })

  it('tamamlanan adımın bir sonrasından devam eder', () => {
    expect(resolveResumeStep('student', 1)).toBe(2)
    expect(resolveResumeStep('student', 4)).toBe(5)
    expect(resolveResumeStep('student', 5)).toBe(6)
  })

  it('son adımı aşmaz', () => {
    expect(resolveResumeStep('student', 6)).toBe(6)
    expect(resolveResumeStep('student', 12)).toBe(6)
    expect(resolveResumeStep('parent', 5)).toBe(1)
  })

  it('bozuk değerlerde ilk adıma düşer', () => {
    expect(resolveResumeStep('student', -3)).toBe(1)
    expect(resolveResumeStep('student', Number.NaN)).toBe(1)
    expect(resolveResumeStep('student', 2.7)).toBe(3)
  })
})

describe('progressPercent', () => {
  it('ilk adımda 0, son adımda son dilimde olur', () => {
    expect(progressPercent('student', 1)).toBe(0)
    expect(progressPercent('student', 4)).toBe(50)
    expect(progressPercent('student', 6)).toBe(83)
    expect(progressPercent('parent', 1)).toBe(0)
  })
})

describe('homeForRole', () => {
  it('seviye tespiti seçildiğinde panele bayrakla gider', () => {
    expect(homeForRole('student', true)).toBe('/seviye-tespit')
    expect(homeForRole('student', false)).toBe('/dashboard')
  })

  it('veli kendi paneline gider, bayrak veliyi etkilemez', () => {
    expect(homeForRole('parent')).toBe('/veli')
    expect(homeForRole('parent', true)).toBe('/veli')
  })
})

describe('adım şemaları', () => {
  it('rol adımı yalnızca öğrenci/veli kabul eder', () => {
    expect(OnboardingStepInputSchema.safeParse({ step: 1, role: 'student' }).success).toBe(true)
    expect(OnboardingStepInputSchema.safeParse({ step: 1, role: 'admin' }).success).toBe(false)
  })

  it('sınıf değerleri profiles.grade kısıtıyla aynıdır', () => {
    expect(GRADES).toEqual(['8', '9', '10', '11', '12', 'mezun', 'yetiskin'])
    for (const grade of GRADES) {
      expect(OnboardingStepInputSchema.safeParse({ step: 3, grade }).success).toBe(true)
    }
    expect(OnboardingStepInputSchema.safeParse({ step: 3, grade: '7' }).success).toBe(false)
  })

  it('sınav adımı uuid ister', () => {
    expect(
      OnboardingStepInputSchema.safeParse({
        step: 2,
        examId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true)
    expect(OnboardingStepInputSchema.safeParse({ step: 2, examId: 'LGS' }).success).toBe(false)
  })

  it('geçmiş tarih reddedilmez, biçimsiz tarih reddedilir', () => {
    expect(ExamDateStepSchema.safeParse({ step: 4, targetExamDate: '2001-06-01' }).success).toBe(
      true,
    )
    expect(ExamDateStepSchema.safeParse({ step: 4, targetExamDate: '01.06.2027' }).success).toBe(
      false,
    )
    expect(ExamDateStepSchema.safeParse({ step: 4, targetExamDate: '1998-06-01' }).success).toBe(
      false,
    )
  })

  it('çalışma günleri sınır değerleri', () => {
    const base = { step: 5 as const, dailyMinutes: 60 }
    expect(ScheduleStepSchema.safeParse({ ...base, studyDays: [1] }).success).toBe(true)
    expect(
      ScheduleStepSchema.safeParse({ ...base, studyDays: [1, 2, 3, 4, 5, 6, 7] }).success,
    ).toBe(true)
    expect(ScheduleStepSchema.safeParse({ ...base, studyDays: [] }).success).toBe(false)
    expect(ScheduleStepSchema.safeParse({ ...base, studyDays: [1, 1] }).success).toBe(false)
    expect(ScheduleStepSchema.safeParse({ ...base, studyDays: [0] }).success).toBe(false)
    expect(ScheduleStepSchema.safeParse({ ...base, studyDays: [8] }).success).toBe(false)
  })

  it('günlük süre yalnızca tanımlı seçeneklerden gelir', () => {
    for (const minutes of DAILY_MINUTES_OPTIONS) {
      expect(
        ScheduleStepSchema.safeParse({ step: 5, dailyMinutes: minutes, studyDays: [1] }).success,
      ).toBe(true)
    }
    expect(
      ScheduleStepSchema.safeParse({ step: 5, dailyMinutes: 45, studyDays: [1] }).success,
    ).toBe(false)
  })
})
