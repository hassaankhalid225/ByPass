import { cn } from '@/lib/cn'

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[--radius-lg] border border-[--color-line] bg-[--color-surface] shadow-[--shadow-sm]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
