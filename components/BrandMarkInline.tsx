import { cn } from '@/lib/utils'

/** Inline mark (no asset URL), for surfaces without the site's `/brand` path such as the game plugin. */
export function BrandMarkInline({ className, animated: _animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable="false" className={cn('size-6 shrink-0', className)}>
      <g fill="var(--wt-primary, var(--accent))">
        <circle cx="32" cy="18" r="12" />
        <circle cx="18" cy="28" r="8" />
        <circle cx="46" cy="28" r="8" />
        <rect x="29" y="26" width="6" height="22" rx="3" />
        <path d="M32 46c-8 4-14 8-16 12h7c2-2 6-4 9-6 3 2 7 4 9 6h7c-2-4-8-8-16-12z" />
      </g>
      <circle cx="32" cy="18" r="3.5" fill="var(--wt-accent-node, var(--focus-contrast, var(--info)))" />
    </svg>
  )
}
