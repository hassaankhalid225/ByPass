import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 font-display font-bold rounded-[--radius] ' +
  'transition-[background-color,border-color,color] duration-120 disabled:opacity-60 ' +
  'disabled:cursor-not-allowed active:scale-[0.98] select-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-[--color-sign] text-[--color-sign-ink] hover:bg-[color-mix(in_srgb,var(--color-sign)_88%,black)]',
  secondary:
    'border border-[--color-line] bg-[--color-surface] text-[--color-road] hover:bg-[--color-surface-2]',
  ghost: 'text-[--color-road] hover:bg-[--color-surface-2]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-14 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
})
