# Gotchas

Non-obvious pitfalls. Add to this file when you hit one.

## Build / tooling

- **Dev servers hide type errors.** Vite and `bun --hot` skip strict TS checks — always `bun run build` (web) and `bunx tsc --noEmit` (api) before claiming done.
- **PowerShell doesn't support `<` redirection** — wrap in `bash -c '...'` for Docker stdin (e.g. piping SQL into `psql`).
- **cssstudio is OFF by default in dev.** Toggle via URL: append `?cssstudio=1` to enable, `?cssstudio=0` to disable. The flag persists in `localStorage.arsenyx.cssstudio` and the param strips itself after apply. See [apps/web/src/main.tsx](../apps/web/src/main.tsx).

## R2 image hosting (img.arsenyx.com)

- **R2 served via a Custom Domain does NOT edge-cache objects that lack a `Cache-Control` header** — Cloudflare returns `Cf-Cache-Status: BYPASS` and every request round-trips to the R2 origin. [scripts/sync-images.ts](../scripts/sync-images.ts) sets `Cache-Control: public, max-age=31536000, immutable` on upload (keys are content-hashed, so the bytes never change). If you change that header, re-apply it to existing objects with `bun run sync:images --refresh-metadata` (CopyObject, no re-download). Verify with `curl -sSI https://img.arsenyx.com/<key>` → expect `HIT` on the second hit.
- Non-default-cacheable extensions (anything outside png/jpg/jpeg/gif/webp/svg/ico) still need a zone **Cache Rule** ("Cache Everything") to cache even with the header. We only serve default-cacheable image types today, so the header alone suffices.

## Shadcn in the monorepo

The `shadcn` skill's bootstrap runs `shadcn info` from cwd and errors at the monorepo root (`error: monorepo_root`). Workarounds:

- **Preferred:** start Claude Code with cwd `apps/web`, then the skill works normally.
- **Otherwise:** skip the skill and use the CLI — `cd apps/web && bunx shadcn@latest view <name>` to inspect, `bunx shadcn@latest add <name> -c .` to add.
- **Dep conflicts with our customised `button` / `input`:** `view` the component, write it manually into `apps/web/src/components/ui/`, rewrite `@/registry/base-nova/...` imports to `@/lib/utils` and `@/components/ui/...`.

Never modify existing files in `apps/web/src/components/ui/` — override via `className`.

## Base UI (shadcn underneath)

- `Slider` — `onValueChange` / `onValueCommitted` receive `number | readonly number[]`.
- `Select` — `onValueChange` receives `string | null`.
- `Select` — for `SelectValue` to render a label for the current value, pass an `items={[{ value, label }]}` prop to `<Select>`. Without it, `SelectValue` falls back to showing the raw value string (so `value={null}` renders literally as `null`, `value="__none__"` renders as `__none__`). Use `value: null` for the "no selection" entry. Reference: [select-example.tsx](https://raw.githubusercontent.com/shadcn-ui/ui/refs/heads/main/apps/v4/registry/bases/base/examples/select-example.tsx).

## Item data quirks

- Item fields vary types across items — e.g. `aura` is `string` on most warframes but `string[]` on Jade. Always handle both forms.
- **Twin-frames (Sirius & Orion) ship as TWO DE `ExportWarframes` rows** — a codex-visible `Suits` row (`SiriusSuit`, primary) and a hidden `SpecialItems` + `excludeFromCodex` row (`OrionSuit`). `collapseTwinFrames` ([scripts/build/merge-frames.ts](../scripts/build/merge-frames.ts)) merges each pair (keyed by the `TWIN_FRAMES` uniqueName prefix) into ONE catalog entity with a `forms[]` array; top-level `abilities`/`passive`/`exalted` mirror `forms[0]` for form-unaware consumers. In a build, each variant carries a `formIndex` selecting its form; shards + Helminth stay build-wide (the game only infuses Helminth on the primary form). A new such frame → add it to `TWIN_FRAMES`.
- Set crest filenames under [apps/web/public/mod-set-icons/](../apps/web/public/mod-set-icons/) are `modSet` path segments — rerun [scripts/tint-set-crests.py](../scripts/tint-set-crests.py) when a new set ships or a codename changes. Aliases live in [apps/web/src/lib/mod-card-config.ts](../apps/web/src/lib/mod-card-config.ts) (`SET_CODE_ALIASES`).
