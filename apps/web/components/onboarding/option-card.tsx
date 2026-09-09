'use client'

import { RadioGroupItem } from '@zihin/ui/radio-group'
import { Label } from '@zihin/ui/label'
import { cn } from '@zihin/ui/lib/utils'

/**
 * Sihirbazdaki tek seçimli kart.
 *
 * Görsel olarak kart, semantik olarak radio: seçim ok tuşlarıyla yapılabilir,
 * etiket `htmlFor` ile gerçek input'a bağlıdır. Kartın tamamı tıklanabilir
 * olsun diye `<Label>` kartı sarar.
 */
export function OptionCard({
  value,
  label,
  hint,
  icon,
}: {
  value: string
  label: string
  hint?: string
  icon?: React.ReactNode
}) {
  const id = `secenek-${value}`

  return (
    <Label
      htmlFor={id}
      className={cn(
        'border-border bg-card flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-colors',
        'hover:bg-accent/50',
        'has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5',
        'has-[button:focus-visible]:ring-ring/50 has-[button:focus-visible]:ring-[3px]',
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </span>
    </Label>
  )
}
