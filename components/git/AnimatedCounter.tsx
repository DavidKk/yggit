'use client'

import React, { useEffect, useRef, useState } from 'react'

export interface AnimatedCounterProps {
  value: number | undefined | null
  durationMs?: number
  max?: number
  prefix?: string
  suffix?: string
  className?: string
  title?: string
}

export function useAnimatedCounter(
  targetValue: number | undefined | null,
  options: {
    durationMs?: number
    max?: number
    prefix?: string
    suffix?: string
  } = {}
) {
  const { durationMs = 360, max, prefix = '', suffix = '' } = options
  const numericTarget = typeof targetValue === 'number' && !Number.isNaN(targetValue) ? targetValue : 0

  const [currentVal, setCurrentVal] = useState<number>(numericTarget)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevTargetRef = useRef(numericTarget)
  const currentValRef = useRef(numericTarget)

  useEffect(() => {
    currentValRef.current = currentVal
  }, [currentVal])

  useEffect(() => {
    const fromVal = currentValRef.current
    const toVal = numericTarget

    if (fromVal === toVal) return

    prevTargetRef.current = toVal
    setIsAnimating(true)

    const startTime = performance.now()
    let rafId: number

    const tick = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, Math.max(0, elapsed / durationMs))
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - t, 3)
      const nextVal = Math.round(fromVal + (toVal - fromVal) * ease)

      setCurrentVal(nextVal)

      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setCurrentVal(toVal)
        setIsAnimating(false)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [numericTarget, durationMs])

  const isCapped = max !== undefined && currentVal >= max
  const formattedNumber = isCapped ? `${max}+` : String(currentVal)
  const displayText = `${prefix}${formattedNumber}${suffix}`

  return {
    value: currentVal,
    displayText,
    isAnimating,
  }
}

export function AnimatedCounter({ value, durationMs = 360, max, prefix = '', suffix = '', className, title }: AnimatedCounterProps) {
  const { displayText, isAnimating } = useAnimatedCounter(value, {
    durationMs,
    max,
    prefix,
    suffix,
  })

  return (
    <span className={className} title={title} data-animating={isAnimating ? 'true' : undefined} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {displayText}
    </span>
  )
}
