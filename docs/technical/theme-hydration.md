# Theme persistence and hydration

Theme preference is `light`, `dark`, or `auto`. The request cookie `yggit.themePref` is authoritative; localStorage with the same key is a fallback for older sessions or blocked cookies. Explicit `auto` is persisted rather than deleting the preference.

SSR uses an explicit preference directly. For `auto`, it uses `yggit.themeMode`, the last mode resolved by the browser, or dark when no valid mode is known. The server cannot know the current OS setting on a first visit from these cookies alone.

The inline script runs before page content is painted. It reads cookie then localStorage, resolves auto using `prefers-color-scheme`, applies the document theme, and synchronizes cookies for the next request. Storage failures do not override a known theme with dark.

React starts from the SSR snapshot to keep hydration consistent. The provider restores browser preferences after mounting and only then enables its document-theme effect, preserving the inline script result during hydration. OS changes update the applied theme only in auto mode and refresh the resolved-mode cookie. Legacy localStorage-only preferences migrate without requiring the user to reselect a theme.

The theme switcher is visible in the SSR snapshot and uses the request preference immediately. Its visibility must not depend on the provider's browser-restoration flag; that flag only guards document-theme synchronization.

Cookies are shared across ports on the same hostname; separate localhost worktrees therefore share the cookie preference even though localStorage is scoped to each origin. Cookie priority keeps SSR and browser initialization consistent in this case.
