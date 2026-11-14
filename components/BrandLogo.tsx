import Image from 'next/image'
import Link from 'next/link'

import { PRODUCT_DISPLAY_NAME } from '@/constants/brand'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  markClassName?: string
  wordmarkClassName?: string
  priority?: boolean
  href?: string
  animated?: boolean
}

/** Product mark. `animated` is accepted so existing call sites stay valid. */
export function BrandMark({ className, priority = false, animated: _animated = false }: { className?: string; priority?: boolean; animated?: boolean }) {
  return <Image src="/brand/yggdrasil-app-icon.png" alt="" aria-hidden width={40} height={40} priority={priority} className={cn(className || 'size-6 shrink-0')} />
}

function Wordmark({ className }: { className?: string }) {
  const name = PRODUCT_DISPLAY_NAME
  const accent = name.endsWith('it') ? 'it' : ''
  const lead = accent ? name.slice(0, -accent.length) : name
  return (
    <span className={cn('font-display font-semibold leading-none text-ink', className)}>
      {lead}
      {accent ? <span className="text-accent">{accent}</span> : null}
    </span>
  )
}

/** Shared mark and wordmark for dark application surfaces. */
export function BrandLogo({ className, markClassName, wordmarkClassName, priority = false, href, animated = false }: Props) {
  const mark = <BrandMark className={markClassName} priority={priority} animated={animated} />

  const content = (
    <>
      {mark}
      <Wordmark className={wordmarkClassName} />
    </>
  )

  const logoClassName = cn('inline-flex min-w-0 items-center gap-2', className)

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${PRODUCT_DISPLAY_NAME} 首页`}
        className={cn(
          logoClassName,
          'rounded-[0.25rem] no-underline transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--accent)_50%,transparent)]'
        )}
      >
        {content}
      </Link>
    )
  }

  return <span className={logoClassName}>{content}</span>
}
