'use client'

import { useState, type FormEvent } from 'react'
import { Switch } from '@zihin/ui/switch'
import { updateNotificationPreferences } from '@/app/(student)/ayarlar/actions'
import type { NotificationPrefs } from '@/app/(student)/ayarlar/schemas'
import { section } from '@/lib/i18n/settings'
import {
  FormErrorSummary,
  FormSuccess,
  SubmitButton,
  SwitchRow,
} from '@/components/common/form-parts'
import { useSettingsAction } from './use-settings-action'

const s = section<{ notifications: Record<string, string> }>('settings')

/** Anahtarlar `profiles.notification_prefs` jsonb alanının anahtarlarıdır. */
const ROWS = [
  {
    key: 'email_reminders',
    id: 'ayar-bildirim-hatirlatma',
    label: 'emailReminders',
    hint: 'emailRemindersHint',
  },
  {
    key: 'email_weekly_summary',
    id: 'ayar-bildirim-haftalik',
    label: 'emailWeeklySummary',
    hint: 'emailWeeklySummaryHint',
  },
  {
    key: 'app_notifications',
    id: 'ayar-bildirim-uygulama',
    label: 'appNotifications',
    hint: 'appNotificationsHint',
  },
] as const

export function NotificationForm({ initial }: { initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial)
  const { submit, pending, error, success } = useSettingsAction(updateNotificationPreferences)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // jsonb kısmi güncellenmez: nesnenin tamamı geri yazılır.
    submit(prefs)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormErrorSummary message={error} />

      <div>
        {ROWS.map((row) => (
          <SwitchRow
            key={row.key}
            id={row.id}
            label={s.notifications[row.label] ?? row.key}
            hint={s.notifications[row.hint]}
          >
            {(aria) => (
              <Switch
                {...aria}
                checked={prefs[row.key]}
                onCheckedChange={(checked) =>
                  setPrefs((current) => ({ ...current, [row.key]: checked }))
                }
              />
            )}
          </SwitchRow>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} />
        <FormSuccess show={success} />
      </div>
    </form>
  )
}
