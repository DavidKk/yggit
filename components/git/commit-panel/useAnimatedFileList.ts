'use client'

import { useEffect, useRef, useState } from 'react'

import type { GitFileChange } from '@/lib/git/types'

export type AnimatedFileChange = GitFileChange & {
  isEntering?: boolean
  isExiting?: boolean
}

export function useAnimatedFileList(files: GitFileChange[], durationMs = 260): AnimatedFileChange[] {
  const [animatedList, setAnimatedList] = useState<AnimatedFileChange[]>(() => files)
  const isFirstRender = useRef(true)
  const prevMapRef = useRef<Map<string, GitFileChange>>(new Map())
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const enteringTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Initial mount: do not animate all initial items
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevMapRef.current = new Map(files.map((f) => [f.path, f]))
      setAnimatedList(files)
      return
    }

    const prevMap = prevMapRef.current
    const nextMap = new Map(files.map((f) => [f.path, f]))

    const addedPaths = new Set<string>()
    const removedFiles: AnimatedFileChange[] = []

    for (const file of files) {
      if (!prevMap.has(file.path)) {
        addedPaths.add(file.path)
      }
    }

    for (const [path, prevFile] of prevMap.entries()) {
      if (!nextMap.has(path)) {
        removedFiles.push({ ...prevFile, isExiting: true })
      }
    }

    // Nothing added or removed: just update items
    if (addedPaths.size === 0 && removedFiles.length === 0) {
      prevMapRef.current = nextMap
      setAnimatedList(files)
      return
    }

    // Combine current items with exiting items
    const combined: AnimatedFileChange[] = files.map((file) => ({
      ...file,
      isEntering: addedPaths.has(file.path),
    }))

    // Append exiting files to play their exit animation
    if (removedFiles.length > 0) {
      combined.push(...removedFiles)
    }

    prevMapRef.current = nextMap
    setAnimatedList(combined)

    // Schedule cleanup of exiting files
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => {
      setAnimatedList((curr) => curr.filter((item) => !item.isExiting))
    }, durationMs)

    // Schedule clearing entering animation flag
    if (enteringTimerRef.current) clearTimeout(enteringTimerRef.current)
    enteringTimerRef.current = setTimeout(() => {
      setAnimatedList((curr) => curr.map((item) => (item.isEntering ? { ...item, isEntering: false } : item)))
    }, durationMs + 80)

    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      if (enteringTimerRef.current) clearTimeout(enteringTimerRef.current)
    }
  }, [files, durationMs])

  return animatedList
}
