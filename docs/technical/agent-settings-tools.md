# Agent settings tools

Privacy settings and the model list, creation, and editing pages share an adjacent rule debugger on wide screens. On narrower screens the debugger follows the form.

Enter sample text to preview the text after redaction and its replacement mappings. The debugger uses the same redaction engine as Agent requests, including enabled categories, custom wildcard rules such as `a-*`, and allowlist exemptions. Changing privacy settings updates the preview immediately. Each preview starts a fresh replacement session, so placeholder numbering can differ from an existing conversation.

On model pages, enter a model ID to inspect matching whitelist and blacklist patterns. Blacklist matches take priority. Model forms pass their unsaved rules to the debugger, so saving or invoking the Agent is unnecessary. A blocked model displays a no-request result. The preview shows the supplied sample text; it does not assemble the full conversation, repository context, or tool results.

Agent menu actions are managed in `/settings/menus`. The list provides an edit link, description, delete button, and enabled switch. `/settings/menus/new` creates an action; `/settings/menus/[id]` edits its title, optional description, and prompt. Saving an edit preserves the enabled state. Menu actions continue using the existing browser-local menu configuration storage.

Both the menu list and editor require confirmation before deleting an action. Cancelling leaves the action unchanged. Titles use an inline edit link with a pencil icon.

Built-in action IDs are stable readable names, such as `agent-review`. New custom actions receive `agent_custom_${crypto.randomUUID()}` when saved. Editing the title or prompt preserves the ID; IDs are routing and storage keys, not names derived from the title.

General settings (`/settings/general`) list only the application's registered IndexedDB databases, with a database count, name, estimated size, refresh, and individual/all deletion controls. No object stores, records, or values are displayed. The shared registry in `lib/storage/databases.ts` preserves the existing `yggit_` names for directory handles and conflict caches; unrelated databases are neither listed nor deleted.

Size is an estimate of stored keys and values, scanned with cursors without retaining a full database in memory. It excludes engine/index overhead and external directory contents. A failed estimate displays an unavailable size without preventing deletion. Deletion requires confirmation and reloads the page on success to discard in-memory caches. Blocked operations remain visible so the user can close other tabs and retry. Application connections close on version changes. Browsers without database enumeration support probe only registered names and abort creation of missing databases. Clearing these databases leaves localStorage, sessionStorage, Cache Storage, repository files, and server data untouched.

Git panel search accepts both Cmd+F and Ctrl+F on every platform. The focused panel takes precedence over the hovered panel. Each split or conflict code pane owns its search input; opening or repeating search focuses and selects that input.

Sidebar branch trees are flattened into visible rows and rendered with the shared fixed-height virtual list. Local and remote branches, stashes, tags, worktrees, submodules, and commit file tree/path views mount only the viewport and overscan rows. Expanding folders changes the flattened data rather than mounting recursive subtrees. Filtering or collapsing a scrolled list clamps its scroll position to prevent an empty viewport. This bounds DOM growth; it does not defer fetching repository metadata.
