'use client'

import Link from 'next/link'
import { useId } from 'react'
import { FaGithub, FaGitlab, FaPlay } from 'react-icons/fa'
import { LuArrowRight, LuFolderGit2, LuGitFork } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

import styles from './LandingPage.module.css'

export function LandingHero() {
  const t = useT()
  const ribbonId = useId()

  return (
    <section className={styles.copy} aria-labelledby="landing-headline">
      <div className={styles.category}>
        <LuGitFork aria-hidden />
        <span>{t('landing.hero.categoryPill')}</span>
      </div>

      <h1 id="landing-headline" className={styles.headline}>
        <span>{t('landing.hero.headlinePart1')}</span>
        <span className={styles.highlight}>{t('landing.hero.headlineHighlight')}</span>
      </h1>
      <svg className={styles.ribbon} viewBox="0 0 224 14" aria-hidden="true">
        <defs>
          <path id={`${ribbonId}-shape`} d="M0 13 C38 1 76 0 118 5 C151 9 188 9 224 3 C190 12 151 12 118 8 C76 3 38 4 0 13 Z" />
          <clipPath id={`${ribbonId}-clip`}>
            <use href={`#${ribbonId}-shape`} />
          </clipPath>
          <linearGradient id={`${ribbonId}-base`}>
            <stop stopColor="#37edc9" stopOpacity="0.18" />
            <stop offset="0.27" stopColor="#5fffe1" />
            <stop offset="0.43" stopColor="#8effe9" />
            <stop offset="0.6" stopColor="#35f4d6" />
            <stop offset="1" stopColor="#37edc9" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${ribbonId}-light`}>
            <stop stopColor="#36f8da" stopOpacity="0" />
            <stop offset="0.48" stopColor="#38fbe1" stopOpacity="0.48" />
            <stop offset="0.72" stopColor="#edfff9" />
            <stop offset="1" stopColor="#8affeb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <use href={`#${ribbonId}-shape`} fill={`url(#${ribbonId}-base)`} />
        <g clipPath={`url(#${ribbonId}-clip)`}>
          <rect className={styles.ribbonLight} width="64" height="14" fill={`url(#${ribbonId}-light)`} />
        </g>
      </svg>

      <p className={styles.description}>{t('landing.hero.description')}</p>

      <div className={styles.actions}>
        <Link href="/workdesk" className={cn(styles.action, styles.primary)}>
          <span>{t('landing.hero.enterWorkdesk')}</span>
          <LuArrowRight aria-hidden />
        </Link>
        <Link href="/git" className={styles.action}>
          <LuFolderGit2 aria-hidden />
          <span>{t('git.project.addLocal')}</span>
        </Link>
        <Link href="/git/github/DavidKk/yggit" className={styles.action}>
          <FaPlay aria-hidden />
          <span>{t('landing.hero.onlineDemo')}</span>
        </Link>
      </div>

      <div className={styles.platforms}>
        <span>
          <FaGithub aria-hidden />
          GitHub
        </span>
        <span>
          <FaGitlab aria-hidden className={styles.gitlab} />
          GitLab
        </span>
        <span className={styles.platformBadge}>{t('landing.hero.edgeLocal')}</span>
      </div>
    </section>
  )
}
