import type { SubjectAverage } from '@/lib/data/mastery'
import type { MasteryTimelinePoint } from '@/lib/mastery/timeline'
import type { PanelStrings } from './strings'

/**
 * Grafiklerin erişilebilir karşılıkları — SUNUCUDA çizilir.
 *
 * Grafikler `next/dynamic` ile sonradan yükleniyor ve `aria-hidden`; bu yüzden
 * tablo onlardan bağımsız olmalı. Aksi hâlde JavaScript gelene kadar ekran
 * okuyucu için sayfada hiçbir veri bulunmazdı.
 */

export function TrendTable({
  points,
  strings,
}: {
  points: readonly MasteryTimelinePoint[]
  strings: PanelStrings
}) {
  return (
    <table className="sr-only">
      <caption>{strings.trendTableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{strings.weekLabel}</th>
          <th scope="col">{strings.averageLabel}</th>
          <th scope="col">{strings.sampleLabel}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.weekStart}>
            <th scope="row">{point.weekStart}</th>
            <td>{point.averageMastery}</td>
            <td>{point.sampleCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function RadarTable({
  subjects,
  strings,
}: {
  subjects: readonly SubjectAverage[]
  strings: PanelStrings
}) {
  return (
    <table className="sr-only">
      <caption>{strings.radarTableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{strings.subjectLabel}</th>
          <th scope="col">{strings.averageLabel}</th>
          <th scope="col">{strings.topicCount}</th>
          <th scope="col">{strings.measuredTopics}</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((subject) => (
          <tr key={subject.subjectId}>
            <th scope="row">{subject.name}</th>
            <td>{subject.averageMastery}</td>
            <td>{subject.topicCount}</td>
            <td>{subject.measuredTopicCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
