// Runs a command with an env file's pass:// references (Proton Pass) resolved by `pass-cli run`.
// Usage: node scripts/pass-env.mjs <env-file> <command> [args...]
// A file with plain values (or no file) runs the command unchanged.
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const [file, ...cmd] = process.argv.slice(2)
const refs =
  existsSync(file) &&
  /^\s*[A-Za-z_]\w*\s*=\s*["']?pass:\/\//m.test(readFileSync(file, "utf8"))
const args = refs ? ["pass-cli", "run", "--env-file", file, "--", ...cmd] : cmd
// wrangler reads its .env itself; this flag makes it take the resolved values from the environment.
const env = refs
  ? { ...process.env, CLOUDFLARE_INCLUDE_PROCESS_ENV: "true" }
  : process.env
const r = spawnSync(args[0], args.slice(1), { stdio: "inherit", env })
if (r.error) console.error(`pass-env: can't start ${args[0]}: ${r.error.code}`)
process.exit(r.status ?? 1)
