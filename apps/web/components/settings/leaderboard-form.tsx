'use client'

import { useState } from 'react'
import { Switch } from '@zihin/ui/switch'
import { Loader2 } from 'lucide-react'
import { updateLeaderboardOptIn } from '@/app/(student)/ayarlar/actions'
import { section, t } from '@/lib/i18n/settings'
import { FormErrorSummary, SwitchRow } from '@/components/common/form-parts'
import { useSettingsAction } from './use-settings-action'

const s = section<{ leaderboard: Record<string, string> }>('settings')

/**
 * Tek anahtarlık bölüm; ayrı bir "Kaydet" düğmesi yerine anahtarın kendisi
 * kaydeder. Başarısızlıkta değer eski hâline döner ve hata gösterilir —
 * kullanıcı kaydedildiğini sanıp sayfadan ayrılmasın.
 */
export function LeaderboardForm({ initial }: { initial: boolean }) {
  const [optIn, setOptIn] = useState(initial)
  const { submit, pending, error } = useSettingsAction(updateLeaderboardOptIn)

  function onChange(checked: boolean) {
    const previous = optIn
    setOptIn(checked)
    submit({ optIn: checked }, { onError: () => setOptIn(previous) })
  }

  return (
    <div className="space-y-3">
      <FormErrorSummary message={error} />

      <SwitchRow
        id="ayar-liderlik"
        label={t('settings.leaderboard.optIn')}
        hint={s.leaderboard.optInHint}
      >
        {(aria) => (
          <span className="flex items-center gap-2">
            {pending ? (
              <Loader2 aria-hidden="true" className="text-muted-foreground size-4 animate-spin" />
            ) : null}
            <Switch {...aria} checked={optIn} disabled={pending} onCheckedChange={onChange} />
            {/* Kaydetme sessiz olduğu için durum ekran okuyucuya ayrıca duyurulur. */}
            <span aria-live="polite" className="sr-only">
              {pending ? t('settings.saving') : ''}
            </span>
          </span>
        )}
      </SwitchRow>

      {optIn ? null : <p className="text-muted-foreground text-xs">{s.leaderboard.optInOffNote}</p>}
    </div>
  )
}
