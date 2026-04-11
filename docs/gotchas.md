# Gotchas

- **`bun dev` hides type errors** — Turbopack skips strict TS checks. Always `bun build`.
- **Satori (OG images)** — Flexbox only (no grid), inline `style` objects only (no Tailwind), `.ttf`/`.woff` only (not `.woff2`). Use ternaries, never `&&` short-circuits.
- **`pg` and `sharp` must be external** — `serverExternalPackages` in `next.config.ts`.
- **PowerShell doesn't support `<` redirection** — wrap in `bash -c '...'` for Docker stdin.
- **Base UI Slider** — `onValueChange`/`onValueCommitted` use `number | readonly number[]`.
- **Base UI Select** — `onValueChange` passes `string | null`.
- **Test coverage is partial** — be careful refactoring untested code.
