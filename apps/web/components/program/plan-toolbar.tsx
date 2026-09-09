'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'
import type { PlanTemplate } from '@zihin/core'
import { Button } from '@zihin/ui/button'
import { Label } from '@zihin/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zihin/ui/select'
import { regeneratePlan } from '@/app/(student)/program/actions'
import { PLAN_TEMPLATES } from '@/app/(student)/program/schemas'
import type { ProgramStrings } from './strings'

/**
 * Şablon seçimi + "Programı yenile".
 *
 * Şablon seçmek TEK BAŞINA programı değiştirmez; yalnızca bir sonraki üretimin
 * girdisidir. Seçer seçmez yeniden üretseydi, öğrenci listeye göz atarken
 * planını üç kez silip yeniden kurmuş olurdu.
 */
export function PlanToolbar({
  weekStart,
  currentTemplate,
  strings,
  disabled,
}: {
  weekStart: string
  currentTemplate: PlanTemplate
  strings: ProgramStrings
  disabled: boolean
}) {
  const router = useRouter()
  const [template, setTemplate] = React.useState<PlanTemplate>(currentTemplate)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => setTemplate(currentTemplate), [currentTemplate])

  async function regenerate(): Promise<void> {
    if (pending) return
    setPending(true)
    try {
      const result = await regeneratePlan({ template, weekStart })
      if (result.ok) {
        toast.success(strings.regenerated)
        // Sunucu `revalidatePath` çağırdı; sayfayı tazeleyip yeni planı al.
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    } catch {
      toast.error(strings.regenerateFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="plan-template">{strings.templateLabel}</Label>
        <Select
          value={template}
          onValueChange={(value) => setTemplate(value as PlanTemplate)}
          disabled={disabled || pending}
        >
          <SelectTrigger id="plan-template" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAN_TEMPLATES.map((value) => (
              <SelectItem key={value} value={value}>
                {strings.templates[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground max-w-xs text-xs">{strings.templateHints[template]}</p>
      </div>

      <div className="space-y-1.5">
        <Button
          type="button"
          onClick={() => void regenerate()}
          disabled={disabled || pending}
          aria-busy={pending}
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="size-4" />
          )}
          {pending ? strings.regenerating : strings.regenerate}
        </Button>
        <p className="text-muted-foreground max-w-sm text-xs">{strings.regenerateHint}</p>
      </div>
    </div>
  )
}
