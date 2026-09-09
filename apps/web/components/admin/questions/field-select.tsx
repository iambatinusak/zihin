'use client'

import * as React from 'react'
import { cn } from '@zihin/ui/lib/utils'
import { SELECT_CLASS } from './select-class'

/** Ortak sınıfı uygulayan `<select>` sarmalayıcısı. */
export function SelectField({ className, ...props }: React.ComponentProps<'select'>) {
  return <select {...props} className={cn(SELECT_CLASS, className)} />
}
