/** A constrained prose column for the static content pages. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose-clearway max-w-[68ch] space-y-4 text-[--color-road] [&_a]:text-[--color-route] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_li]:ml-1 [&_p]:leading-relaxed [&_p]:text-[--color-muted] [&_strong]:text-[--color-road] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mb-8">
      <p className="legend mb-3">{eyebrow}</p>
      <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.02em]">
        {title}
      </h1>
    </header>
  )
}
