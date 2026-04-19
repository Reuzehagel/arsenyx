# Gotchas

Non-obvious pitfalls. Add to this file when you hit one.

## Build / tooling

- **Dev servers hide type errors.** Vite and `bun --hot` skip strict TS checks — always `bun run build` (web) and `bunx tsc --noEmit` (api) before claiming done.
- **PowerShell doesn't support `<` redirection** — wrap in `bash -c '...'` for Docker stdin (e.g. piping SQL into `psql`).

## Shadcn in the monorepo

The `shadcn` skill's bootstrap runs `shadcn info` from cwd and errors at the monorepo root (`error: monorepo_root`). Workarounds:

- **Preferred:** start Claude Code with cwd `apps/web`, then the skill works normally.
- **Otherwise:** skip the skill and use the CLI — `cd apps/web && bunx shadcn@latest view <name>` to inspect, `bunx shadcn@latest add <name> -c .` to add.
- **Dep conflicts with our customised `button` / `input`:** `view` the component, write it manually into `apps/web/src/components/ui/`, rewrite `@/registry/base-nova/...` imports to `@/lib/utils` and `@/components/ui/...`.

Never modify existing files in `apps/web/src/components/ui/` — override via `className`.

## Base UI (shadcn underneath)

- `Slider` — `onValueChange` / `onValueCommitted` receive `number | readonly number[]`.
- `Select` — `onValueChange` receives `string | null`.

## WFCD data quirks

- Item fields vary types across items — e.g. `aura` is `string` on most warframes but `string[]` on Jade. Always handle both forms.
