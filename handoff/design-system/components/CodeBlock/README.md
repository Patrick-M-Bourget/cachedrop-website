# CodeBlock

A copyable command or path with a label bar and a Copy button that confirms “Copied” for 1.6 s.

**Provide** `code` (the exact text copied) and `label` (`Terminal` for commands, `Path` for locations). `copyable={false}` hides the button.

- One command per block. Explain what it does in the sentence before it, including what it does not delete.
- Use real, working commands only, and say when the user should quit an app first.
- Long lines scroll horizontally inside the block; never wrap a command.
