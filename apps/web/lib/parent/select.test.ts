import { describe, expect, it } from 'vitest'
import { resolveSelectedStudent, studentHref } from './select'

const students = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('resolveSelectedStudent', () => {
  it('bağlı öğrenci yoksa null döner', () => {
    expect(resolveSelectedStudent([], 'a')).toBeNull()
  })

  it('parametre yoksa ilk öğrenciyi seçer', () => {
    expect(resolveSelectedStudent(students, null)).toEqual({ id: 'a' })
    expect(resolveSelectedStudent(students, undefined)).toEqual({ id: 'a' })
    expect(resolveSelectedStudent(students, '   ')).toEqual({ id: 'a' })
  })

  it('bağlı bir kimlik verildiğinde onu seçer', () => {
    expect(resolveSelectedStudent(students, 'b')).toEqual({ id: 'b' })
  })

  it('bağlı OLMAYAN kimlikte fırlatmaz, ilk öğrenciye düşer', () => {
    expect(resolveSelectedStudent(students, 'baska-ogrenci')).toEqual({ id: 'a' })
    expect(resolveSelectedStudent(students, '00000000-0000-0000-0000-000000000000')).toEqual({
      id: 'a',
    })
  })

  it('kimliği kırpar; boşluklu kopyala-yapıştır seçimi bozmaz', () => {
    expect(resolveSelectedStudent(students, ' c ')).toEqual({ id: 'c' })
  })
})

describe('studentHref', () => {
  it('seçimi adres çubuğunda taşır', () => {
    expect(studentHref('/veli', 'a')).toBe('/veli?ogrenci=a')
    expect(studentHref('/veli/raporlar', 'a', '2025-09-08')).toBe(
      '/veli/raporlar?ogrenci=a&hafta=2025-09-08',
    )
  })
})
