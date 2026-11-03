/**
 * What every page downloads before first render, and which packages fill it.
 * `bun run bundle:report`. Background and the current baseline live in
 * docs/web-perf.md.
 *
 * Builds apps/web with sourcemaps into a temp dir, takes the eager set from the
 * built index.html (entry script + modulepreloads + stylesheet), and prints each
 * chunk's raw/brotli size and its bytes per package. Attribution decodes the
 * sourcemap mappings, so it counts minified output bytes, not source size.
 */

import { readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { brotliCompressSync } from "node:zlib"

const WEB = join(import.meta.dir, "../apps/web")
const OUT = join(tmpdir(), "arsenyx-bundle-report")
const TOP = 12 // packages listed per chunk
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

const build = Bun.spawnSync(
  [
    "bunx",
    "--bun",
    "vite",
    "build",
    "--sourcemap",
    "--emptyOutDir",
    "--outDir",
    OUT,
  ],
  { cwd: WEB, stdout: "ignore", stderr: "inherit" },
)
if (build.exitCode !== 0) process.exit(build.exitCode ?? 1)

const html = readFileSync(join(OUT, "index.html"), "utf8")
const eager = [
  ...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g),
].map((m) => m[1])

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`
let totalRaw = 0
let totalBr = 0

for (const file of eager) {
  const buf = readFileSync(join(OUT, file))
  const br = brotliCompressSync(buf).length
  totalRaw += buf.length
  totalBr += br
  console.log(`\n${file}  ${kb(buf.length)} raw, ${kb(br)} br`)
  if (!file.endsWith(".js")) continue
  const rows = [...attribute(buf.toString("utf8"), join(OUT, `${file}.map`))]
  for (const [name, bytes] of rows.sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
    console.log(`  ${kb(bytes).padStart(9)}  ${name}`)
  }
}
console.log(`\nEager total: ${kb(totalRaw)} raw, ${kb(totalBr)} br`)
rmSync(OUT, { recursive: true, force: true })

/** Minified bytes per package (or per apps/web/src top-level dir). */
function attribute(code: string, mapPath: string): Map<string, number> {
  const map = JSON.parse(readFileSync(mapPath, "utf8")) as {
    sources: string[]
    mappings: string
  }
  const lines = code.split("\n")
  const out = new Map<string, number>()
  let src = 0
  map.mappings.split(";").forEach((line, li) => {
    // Each segment: [genCol delta, srcIndex delta, ...]; deltas carry across lines for srcIndex only.
    const segs: [col: number, src: number][] = []
    let col = 0
    for (const seg of line.split(",")) {
      if (!seg) continue
      const v = decodeVlq(seg)
      col += v[0]
      if (v.length > 1) src += v[1]
      segs.push([col, v.length > 1 ? src : -1])
    }
    segs.forEach(([c, s], i) => {
      if (s < 0) return
      const end = segs[i + 1]?.[0] ?? lines[li]?.length ?? c
      const name = label(map.sources[s])
      out.set(name, (out.get(name) ?? 0) + end - c)
    })
  })
  return out
}

function label(source: string): string {
  const pkg = source.match(
    /node_modules\/(?:\.bun\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/,
  )
  if (pkg) return pkg[1]
  const app = source.match(/(apps\/web\/src|packages\/shared\/src)\/([^/]+)/)
  return app ? `${app[1]}/${app[2]}` : source
}

function decodeVlq(seg: string): number[] {
  const out: number[] = []
  let value = 0
  let shift = 0
  for (const ch of seg) {
    const digit = B64.indexOf(ch)
    value += (digit & 31) << shift
    if (digit & 32) {
      shift += 5
    } else {
      out.push(value & 1 ? -(value >> 1) : value >> 1)
      value = 0
      shift = 0
    }
  }
  return out
}
