'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from './lib/utils'

function Progress({
  className,
  indicatorClassName,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Dolu çubuğun ek sınıfları (ör. yetkinlik durumuna göre renk). */
  indicatorClassName?: string
}) {
  const percent = Math.min(100, Math.max(0, value ?? 0))

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('bg-primary h-full w-full flex-1 transition-all', indicatorClassName)}
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
