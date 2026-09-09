'use client'

import { usePathname, useRouter } from 'next/navigation'

import { Label } from '@zihin/ui/label'
import { t } from '@/lib/i18n/admin-media'
import type { ExamOption } from '@/lib/data/admin-media'

/**
 * Yalnızca sınav seçen süzgeç (deneme kurucusu).
 *
 * `CurriculumFilter`ın ders/konu kolonlarını gizlemek yerine ayrı bir bileşen:
 * deneme ekranında ders seçimi YOK — ders dağılımı formun kendisinde, sayı
 * girilerek yapılır. Devre dışı iki kutu göstermek bunu yanlış anlatırdı.
 */
export function ExamPicker({ exams, examId }: { exams: ExamOption[]; examId: string | null }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor="deneme-sinav">{t('adminMedia.mockExam')}</Label>
      <select
        id="deneme-sinav"
        className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px]"
        value={examId ?? ''}
        onChange={(event) => {
          const value = event.target.value
          router.push(value === '' ? pathname : `${pathname}?sinav=${encodeURIComponent(value)}`)
        }}
      >
        <option value="">{t('adminMedia.selectPlaceholder')}</option>
        {exams.map((exam) => (
          <option key={exam.id} value={exam.id}>
            {exam.name}
          </option>
        ))}
      </select>
    </div>
  )
}
