import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind sinif adlarini cakismasiz birlestirir. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
