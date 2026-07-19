# Go Tree-sitter WASM

An Astro example that parses Go source in the browser with `web-tree-sitter`.

```sh
bun install
bun dev
```

The install step copies both required WASM files into `public/`:

- `web-tree-sitter.wasm` is the Tree-sitter runtime.
- `tree-sitter-go.wasm` is the Go grammar.

Use `parseGo` from `src/lib/go-parser.ts` when you only need the syntax tree string, or `getGoParser` when you need the full Tree-sitter API.

## Commands

| Command | Action |
| :-- | :-- |
| `bun dev` | Start the development server |
| `bun run build` | Build the production site |
| `bun run preview` | Preview the production build |
| `bun run copy:wasm` | Refresh the public WASM assets |
