/**
 * CPU-profile the local API Worker: replays edge-cache-missing build reads
 * against `wrangler dev` while recording over its inspector (CDP), then prints
 * where the CPU went. Production capture (`cf workers versions profile`) lands
 * on idle isolates at our traffic, so this is the working route — see
 * docs/usage-analytics.md.
 *
 *   bun run cf:profile [--api http://localhost:8787] [--inspector 9229] [--requests 100] [--out file.cpuprofile]
 *
 * Start the API first with prod-like logging: `bun run dev --var NODE_ENV:production`
 * in apps/api (dev logging prints every query and skews the profile).
 */

import { parseArgs } from "node:util"

const { values: args } = parseArgs({
  options: {
    api: { type: "string", default: "http://localhost:8787" },
    inspector: { type: "string", default: "9229" },
    requests: { type: "string", default: "100" },
    out: { type: "string" },
  },
})
const N = Number(args.requests)

type Node = {
  id: number
  callFrame: { functionName: string; url: string; lineNumber: number }
  children?: number[]
}
type Profile = { nodes: Node[]; samples: number[]; timeDeltas: number[] }

const targets = (await (
  await fetch(`http://127.0.0.1:${args.inspector}/json`)
).json()) as { webSocketDebuggerUrl: string }[]
const ws = new WebSocket(targets.at(-1)!.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let msgId = 0
const pending = new Map<number, (v: any) => void>()
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data))
  pending.get(m.id)?.(m.result ?? m.error)
}
const send = (method: string, params = {}) =>
  new Promise<any>((r) => {
    pending.set(++msgId, r)
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })

const list = (await (await fetch(`${args.api}/builds?limit=40`)).json()) as {
  builds?: { slug: string }[]
}
const slugs = list.builds?.map((b) => b.slug) ?? []
if (!slugs.length) throw new Error(`no builds from ${args.api}/builds`)
// A fresh query param misses the edge cache, so every request runs the handler.
const hit = async (i: number) => {
  const res = await fetch(
    `${args.api}/builds/${slugs[i % slugs.length]}?p=${Math.random()}`,
  )
  await res.arrayBuffer()
}
for (let i = 0; i < 10; i++) await hit(i) // warm the isolate

await send("Profiler.enable")
await send("Profiler.setSamplingInterval", { interval: 100 })
await send("Profiler.start")
for (let i = 0; i < N; i++) await hit(i)
const { profile } = (await send("Profiler.stop")) as { profile: Profile }
ws.close()
if (args.out) await Bun.write(args.out, JSON.stringify(profile))

const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const parent = new Map<number, number>()
for (const n of profile.nodes)
  for (const c of n.children ?? []) parent.set(c, n.id)
const selfUs = new Map<number, number>()
profile.samples.forEach((s, i) =>
  selfUs.set(s, (selfUs.get(s) ?? 0) + (profile.timeDeltas[i] ?? 0)),
)
const label = (n: Node) => {
  const f = n.callFrame
  return `${f.functionName || "(anon)"} ${f.url.split(/[\\/]/).at(-1)}:${f.lineNumber + 1}`
}
const busy = [...selfUs].filter(
  ([id]) =>
    !["(idle)", "(program)"].includes(byId.get(id)!.callFrame.functionName),
)
const total = busy.reduce((a, [, us]) => a + us, 0)

const self = new Map<string, number>()
const incl = new Map<string, number>()
for (const [id, us] of busy) {
  const l = label(byId.get(id)!)
  self.set(l, (self.get(l) ?? 0) + us)
  // Inclusive: count each sample once per distinct frame on its stack.
  const seen = new Set<string>()
  for (let cur: number | undefined = id; cur != null; cur = parent.get(cur)) {
    const fl = label(byId.get(cur)!)
    if (seen.has(fl)) continue
    seen.add(fl)
    incl.set(fl, (incl.get(fl) ?? 0) + us)
  }
}
const top = (m: Map<string, number>, n: number) =>
  [...m]
    .filter(([l]) => !l.startsWith("("))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([l, us]) => ({
      share: `${((us / total) * 100).toFixed(1)}%`,
      msPerReq: +(us / 1000 / N).toFixed(2),
      frame: l,
    }))

console.log(
  `\n${N} requests, ${(total / 1000 / N).toFixed(1)} ms busy CPU per request (local ms don't map to prod; compare shares)`,
)
console.log("\nTop inclusive (frame + callees):")
console.table(top(incl, 30))
console.log("\nTop self:")
console.table(top(self, 15))
