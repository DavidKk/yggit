# Remote group import

The project switcher provides **Import remote group** beside the existing project import actions. Choose GitLab or GitHub, enter an HTTPS group or organization URL, and select or type a destination folder. Imported entries are remote projects in the catalog; cloning to disk remains a separate action.

GitLab imports include nested subgroups and exclude projects merely shared into the group. GitHub imports organization repositories. Self-hosted GitLab and GitHub Enterprise use the selected host's API. Only repositories visible to the supplied credentials are returned; anonymous requests can return public repositories only. This action does not continuously synchronize future additions.

The importer reads every page before saving, deduplicates existing projects, and assigns matching projects to the destination folder while retaining local associations and labels. A failed page aborts the import without writing a partial project list. Browser storage writes use one IndexedDB transaction; Local mode writes the resulting catalog once. A token supplied in Local mode is validated and stored through the existing credential service.

Browser mode calls the provider directly and requires compatible CORS settings. Use the desktop application when a private provider cannot be accessed from the browser. The feature currently supports HTTPS endpoints hosted at the domain root; other Git hosting platforms require additional adapters.

Regression coverage includes nested GitLab paths, pagination, GitHub Enterprise API routing, token headers, repeated-page rejection, and failure without partial results. A live private-group import requires provider credentials and has not been part of the automated regression.
