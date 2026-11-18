# Agent settings tools

Privacy settings and the model list, creation, and editing pages share an adjacent rule debugger on wide screens. On narrower screens the debugger follows the form.

Enter sample text to preview the text after redaction and its replacement mappings. The debugger uses the same redaction engine as Agent requests, including enabled categories, custom wildcard rules such as `a-*`, and allowlist exemptions. Changing privacy settings updates the preview immediately. Each preview starts a fresh replacement session, so placeholder numbering can differ from an existing conversation.

On model pages, enter a model ID to inspect matching whitelist and blacklist patterns. Blacklist matches take priority. Model forms pass their unsaved rules to the debugger, so saving or invoking the Agent is unnecessary. A blocked model displays a no-request result. The preview shows the supplied sample text; it does not assemble the full conversation, repository context, or tool results.

Agent menu actions are managed in `/settings/menus`. The list provides an edit link, description, delete button, and enabled switch. `/settings/menus/new` creates an action; `/settings/menus/[id]` edits its title, optional description, and prompt. Saving an edit preserves the enabled state. Menu actions continue using the existing browser-local menu configuration storage.

Both the menu list and editor require confirmation before deleting an action. Cancelling leaves the action unchanged. Titles use an inline edit link with a pencil icon.

Built-in action IDs are stable readable names, such as `agent-review`. New custom actions receive `agent_custom_${crypto.randomUUID()}` when saved. Editing the title or prompt preserves the ID; IDs are routing and storage keys, not names derived from the title.

General settings (`/settings/general`) also provide a browser storage inspector. It lists localStorage, sessionStorage, IndexedDB databases and object stores with record counts, and Cache Storage names. Entries are read in pages of 30; value previews are limited to 16,000 characters. IndexedDB uses a cursor rather than loading an entire object store. Cache previews display request URLs and methods without reading response bodies.

Clearing requires confirmation and removes storage for the current origin, including saved project entries, Agent preferences, and persisted directory handles. It does not delete repository files or server data. Successful cleanup reloads the page; blocked database deletion or other errors remain visible so the user can close other tabs and retry. Database connections owned by the application close on version changes. Browsers without database enumeration support fall back to the application's known database names.

Git panel search accepts both Cmd+F and Ctrl+F on every platform. The focused panel takes precedence over the hovered panel. Each split or conflict code pane owns its search input; opening or repeating search focuses and selects that input.

Sidebar branch trees are flattened into visible rows and rendered with the shared fixed-height virtual list. Local and remote branches, stashes, tags, worktrees, submodules, and commit file tree/path views mount only the viewport and overscan rows. Expanding folders changes the flattened data rather than mounting recursive subtrees. Filtering or collapsing a scrolled list clamps its scroll position to prevent an empty viewport. This bounds DOM growth; it does not defer fetching repository metadata.
