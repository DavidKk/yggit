# Commit conflict indicators

The commit message warning uses a concise tooltip. Clicking the icon opens the conflict comparison directly without an intermediate popover.

Amber indicates that reconstructing the merge encountered conflicts. Red indicates that a historically conflicted file in the committed result still contains a complete Git conflict marker block. Marker widths of seven or more characters and diff3 blocks are supported. Ordinary separator lines alone do not count. This checks conflict markers, not semantic correctness of the resolution.

Detection reads committed blobs and never modifies the working tree. Deleted files are treated as having no remaining markers. A failed read leaves the inspection unknown rather than claiming the conflict was resolved. Existing cached conflict records without this inspection are refreshed through the idle batch pipeline; unknown inspections remain cached to avoid repeated work.

Current branch, lineage, and spotlight message backgrounds cover the entire message cell, including its conflict icon and padding. The graph highlight still begins outside the node ring and extends to the right.
