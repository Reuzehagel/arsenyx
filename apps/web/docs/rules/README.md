# Rules

Per-package LLM rules extracted from npm dependencies via [`vibe-rules`](https://www.npmjs.com/package/vibe-rules). Each file mirrors one `<name_slug>...</name_slug>` block that `vibe-rules` would otherwise append to `CLAUDE.md`.

We keep CLAUDE.md as a small index (progressive disclosure) so this content only loads when Claude reads the specific file.

## Refreshing after upgrades

```sh
bunx vibe-rules install claude-code
```

That appends fresh blocks to `apps/web/CLAUDE.md`. Move them back out:

```sh
# from apps/web
awk '
  /^<@tanstack\/react-router_/ {
    s=$0; sub(/^<@tanstack\/react-router_/, "", s); sub(/>$/, "", s);
    out="docs/rules/tanstack-router-" s ".md"; capture=1; next
  }
  /^<\/@tanstack\/react-router_/ { capture=0; close(out); next }
  capture { print > out }
' CLAUDE.md
```

Then strip the inlined blocks from `CLAUDE.md` (or restore the index version from git).
