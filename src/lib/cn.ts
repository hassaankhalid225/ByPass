import { clsx, type ClassValue } from 'clsx'

/** Class-name helper. clsx is enough — no tailwind-merge; we avoid conflicting utilities. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
