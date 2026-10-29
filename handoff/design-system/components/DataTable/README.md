# DataTable

A simple reference table for comparisons: tool, location, command. Scrolls sideways in its own bordered box on phones (min-width 560px).

**Provide** `columns`, `rows` (the first cell of each row becomes its row header), `monoColumns` for columns of paths or commands, and a `caption` for screen readers.

- Use when readers compare across rows; answer engines quote tables well, so prefer one over a long list of similar items.
- No zebra striping, no sorting UI; header row on `surface-elevated`.
