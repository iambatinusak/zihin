import { classifyMastery } from '@zihin/core'
import type { MasteryStatus } from '@zihin/core'
import { Badge } from '@zihin/ui/badge'
import { cn } from '@zihin/ui/lib/utils'
import { t } from '@/lib/i18n'

/** Yetkinlik bandına karşılık gelen belirteç sınıfı. Renk tek başına anlam taşımaz. */
const STATUS_CLASSES: Record<MasteryStatus, string> = {
  unknown: 'border-transparent bg-mastery-unknown text-white',
  weak: 'border-transparent bg-mastery-weak text-white',
  medium: 'border-transparent bg-mastery-medium text-white',
  strong: 'border-transparent bg-mastery-strong text-white',
}

type MasteryBadgeProps =
  | {
      status: MasteryStatus
      mastery?: never
      attempts?: never
      showScore?: boolean
      className?: string
    }
  | {
      status?: never
      /** 0-100 puan. `attempts` ile birlikte verilirse band core'da hesaplanır. */
      mastery: number
      attempts: number
      showScore?: boolean
      className?: string
    }

/**
 * Yetkinlik bandını Türkçe etiketli renkli rozet olarak gösterir.
 * Band ya doğrudan verilir ya da `classifyMastery` ile puandan türetilir.
 */
export function MasteryBadge(props: MasteryBadgeProps) {
  const { showScore = false, className } = props
  const status: MasteryStatus = props.status ?? classifyMastery(props.mastery, props.attempts)
  const label = t(`mastery.${status}`)

  return (
    <Badge
      className={cn(STATUS_CLASSES[status], className)}
      title={`${t('mastery.title')}: ${label}`}
    >
      {label}
      {showScore && props.mastery !== undefined && status !== 'unknown' ? (
        <span className="tabular-nums">· {Math.round(props.mastery)}</span>
      ) : null}
    </Badge>
  )
}
