import { cn } from '@/lib/utils'

/** Typography for rendered markdown. Tokens strictly following Yggdrasil world-tree palette. */
export const markdownBody = cn(
  'min-w-0 text-[13.5px] leading-[1.75] text-ink',
  // H1: primary anchor with world-tree emerald bar
  '[&_h1]:mt-2 [&_h1]:mb-5 [&_h1]:border-l-[3.5px] [&_h1]:border-accent [&_h1]:pl-3.5 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-ink',
  // H2: organic branch gradient divider
  '[&_h2]:mt-9 [&_h2]:mb-3.5 [&_h2]:font-display [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink',
  '[&_h2]:border-b-0 [&_h2]:relative [&_h2]:after:content-[""] [&_h2]:after:block [&_h2]:after:h-[1px] [&_h2]:after:w-full [&_h2]:after:mt-2 [&_h2]:after:bg-gradient-to-r [&_h2]:after:from-accent/45 [&_h2]:after:via-line [&_h2]:after:to-transparent',
  // H3: subsection with emerald node dot
  '[&_h3]:mt-6 [&_h3]:mb-2.5 [&_h3]:font-display [&_h3]:text-[14.5px] [&_h3]:font-semibold [&_h3]:text-ink [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2',
  '[&_h3]:before:content-[""] [&_h3]:before:inline-block [&_h3]:before:size-1.5 [&_h3]:before:rounded-full [&_h3]:before:bg-accent/75',
  // H4, H5, H6
  '[&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:text-[13.5px] [&_h4]:font-semibold [&_h4]:text-ink',
  // Paragraphs & Lists
  '[&_p]:my-3',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul>li::marker]:text-accent/60',
  '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol>li::marker]:text-ink-soft',
  '[&_li]:my-1.5',
  // Strong & Emphasis
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_em]:italic [&_em]:text-ink/90',
  // Links: glowing emerald accent
  '[&_a]:text-accent [&_a]:underline-offset-3 hover:[&_a]:underline hover:[&_a]:text-accent/90 [&_a]:transition-colors',
  // Horizontal rule: soft gradient fade
  '[&_hr]:my-7 [&_hr]:border-0 [&_hr]:h-px [&_hr]:bg-gradient-to-r [&_hr]:from-transparent [&_hr]:via-line [&_hr]:to-transparent',
  // Inline code: emerald leaf crystal badge
  '[&_:not(pre)>code]:rounded-[0.3rem] [&_:not(pre)>code]:bg-[color-mix(in_oklab,var(--accent)_10%,var(--panel))] [&_:not(pre)>code]:text-[color-mix(in_oklab,var(--accent)_85%,var(--ink))] [&_:not(pre)>code]:border [&_:not(pre)>code]:border-[color-mix(in_oklab,var(--accent)_22%,transparent)] [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-[0.1rem] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[12px] [&_:not(pre)>code]:font-medium',
  // Code block: textured rock panel with clean line
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-[color-mix(in_oklab,var(--panel-2)_75%,var(--inset))] [&_pre]:p-3.5 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:leading-[1.65]',
  '[&_pre>code]:block [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:font-mono',
  '[&_.line]:inline-block [&_.line]:min-w-full',
  // Table: fixed layout inside resizable wrap
  '[&_table]:my-0 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12.5px]',
  '[&_th]:border-b [&_th]:border-line [&_th]:bg-panel-2/80 [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink [&_th]:whitespace-nowrap',
  '[&_td]:border-b [&_td]:border-line-soft [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:align-top',
  '[&_tr:last-child>td]:border-b-0',
  '[&_tr:hover>td]:bg-[color-mix(in_oklab,var(--accent)_4%,transparent)]',
  // Blockquote: soft emerald callout
  '[&_blockquote]:my-4 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-[3.5px] [&_blockquote]:border-accent/60 [&_blockquote]:bg-[color-mix(in_oklab,var(--accent)_6%,var(--panel))] [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:text-ink-soft [&_blockquote_p]:my-1',
  // Callouts / Alerts (GFM extension support)
  '[&_.git-alert]:my-4 [&_.git-alert]:rounded-lg [&_.git-alert]:border [&_.git-alert]:px-4 [&_.git-alert]:py-3 [&_.git-alert]:text-[13px] [&_.git-alert]:leading-relaxed',
  '[&_.git-alert-title]:font-semibold [&_.git-alert-title]:text-[13px] [&_.git-alert-title]:mb-1.5 [&_.git-alert-title]:tracking-wide',
  '[&_.git-alert-body_p]:my-1',
  '[&_.git-alert-note]:border-[color-mix(in_oklab,var(--accent)_30%,transparent)] [&_.git-alert-note]:bg-[color-mix(in_oklab,var(--accent)_8%,var(--panel))] [&_.git-alert-note_.git-alert-title]:text-accent',
  '[&_.git-alert-tip]:border-[color-mix(in_oklab,var(--accent)_30%,transparent)] [&_.git-alert-tip]:bg-[color-mix(in_oklab,var(--accent)_8%,var(--panel))] [&_.git-alert-tip_.git-alert-title]:text-accent',
  '[&_.git-alert-important]:border-[color-mix(in_oklab,var(--focus-contrast)_35%,transparent)] [&_.git-alert-important]:bg-[color-mix(in_oklab,var(--focus-contrast)_8%,var(--panel))] [&_.git-alert-important_.git-alert-title]:text-focus-contrast',
  '[&_.git-alert-warning]:border-[color-mix(in_oklab,var(--warn)_35%,transparent)] [&_.git-alert-warning]:bg-[color-mix(in_oklab,var(--warn)_8%,var(--panel))] [&_.git-alert-warning_.git-alert-title]:text-warn',
  '[&_.git-alert-caution]:border-[color-mix(in_oklab,var(--fail)_35%,transparent)] [&_.git-alert-caution]:bg-[color-mix(in_oklab,var(--fail)_8%,var(--panel))] [&_.git-alert-caution_.git-alert-title]:text-fail',
  // Code block container reset
  '[&_.git-code-block_pre]:m-0 [&_.git-code-block_pre]:border-0 [&_.git-code-block_pre]:bg-transparent [&_.git-code-block_pre]:rounded-none [&_.git-code-block_pre]:p-0',
  // Images, badges, centered HTML blocks, and collapsible details
  '[&_img]:inline-block [&_img]:max-w-full [&_img]:align-middle',
  '[&_div[align="center"]]:text-center [&_div[align="center"]_h1]:border-l-0 [&_div[align="center"]_h1]:pl-0',
  '[&_div[align="center"]>img]:rounded-xl [&_div[align="center"]>img]:my-2',
  '[&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details]:border-line [&_details]:bg-panel-2/40 [&_details]:px-4 [&_details]:py-2.5',
  '[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-ink [&_summary]:select-none'
)
