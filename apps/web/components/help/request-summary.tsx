import type { ReactNode } from 'react'
import { Badge } from '@zihin/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@zihin/ui/card'
import { fill } from '@/lib/i18n'
import { helpStrings, statusLabel } from './strings'

/**
 * Bir sorunun başlık kartı: ders/konu, durum, metin ve fotoğraf.
 * Hem öğrenci ayrıntı sayfası hem öğretmen paneli aynı kartı kullanır.
 *
 * Soru metni markdown olabilir; SUNUCUDA basılıp `ReactNode` olarak geçirilir.
 * Fotoğraf `help-uploads` özel kovasından gelir, bu yüzden adres her istekte
 * yeniden imzalanmış süreli bir URL'dir.
 */
export type RequestSummaryProps = {
  status: 'open' | 'answered' | 'closed'
  hasPendingMatches?: boolean
  subjectName: string | null
  topicTitle: string | null
  /** Öğretmen panelinde öğrencinin GÖRÜNEN adı; öğrenci tarafında verilmez. */
  studentName?: string | null
  body: ReactNode | null
  imageUrl: string | null
  createdAtLabel: string
  answeredAtLabel?: string | null
}

export function RequestSummary({
  status,
  hasPendingMatches = false,
  subjectName,
  topicTitle,
  studentName,
  body,
  imageUrl,
  createdAtLabel,
  answeredAtLabel,
}: RequestSummaryProps) {
  const s = helpStrings()

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {[subjectName, topicTitle].filter(Boolean).join(' · ') || s.detailTitle}
          </CardTitle>
          <Badge variant={status === 'answered' ? 'default' : 'secondary'}>
            {statusLabel(s, status, hasPendingMatches)}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {studentName ? `${s.teacherStudentLabel}: ${studentName} · ` : ''}
          {fill(s.askedAt, { date: createdAtLabel })}
          {answeredAtLabel ? ` · ${fill(s.answeredAt, { date: answeredAtLabel })}` : ''}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {body ? (
          <div className="text-sm">{body}</div>
        ) : (
          <p className="text-muted-foreground text-sm">{s.teacherNoBody}</p>
        )}

        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imzalı, süreli
          // URL; next/image için remotePatterns tanımı gerekirdi.
          <img
            src={imageUrl}
            alt={s.imagePreview}
            className="border-border max-h-[32rem] w-full rounded-md border object-contain"
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
