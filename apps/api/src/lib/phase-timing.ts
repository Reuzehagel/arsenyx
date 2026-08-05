import type { Context, MiddlewareHandler } from "hono"

// Per-request CPU attribution for a route under active investigation.
//
// READ THIS BEFORE TRUSTING A NUMBER OUT OF HERE.
//
// The `phases` durations are only meaningful under `wrangler dev`. In
// production, Workers freezes the clock as a Spectre mitigation: Date.now()
// returns the time of the LAST I/O and "does not advance during code
// execution" (https://developers.cloudflare.com/workers/reference/security-model/).
// Two consequences, in increasing order of how badly they mislead:
//
//   1. A phase that performs no I/O measures as 0ms.
//   2. Its real cost is not lost — it lands on the NEXT phase that does I/O,
//      since that I/O is what finally moves the clock forward.
//
// So in production this doesn't merely lose precision, it attributes a cost to
// the wrong phase and looks confident doing it. That matters here specifically:
// the ~1s we're chasing on GET /:slug/partners showed wallTime − cpuTime of
// only ~120–200ms, i.e. almost pure execution with no I/O to hide behind —
// exactly the (1)+(2) failure case.
//
// workerd increments timers normally when run locally, so this same code
// reports real numbers under `wrangler dev`. Profile there. For a call-tree
// rather than these coarse phases, `wrangler dev` → press `D` → Profiler tab.
//
// `isolate` and `seq` below ARE trustworthy in production — they never consult
// a clock.

let isolateId: string | null = null
let served = 0

// Identifies the isolate, and this request's position in its lifetime.
//
// `seq: 1` means this request is the first the isolate has served, so it paid
// whatever one-time init the isolate owes (module evaluation, WASM compile). A
// cost that also appears at `seq > 1` is per-request and cannot be a cold start.
//
// This is the clock-free way to settle the question two 1s requests three
// minutes apart in the same colo left open: same `isolate` on both, with the
// second at `seq > 1`, rules out one-time init entirely.
function isolateStamp(): { isolate: string; seq: number } {
  // Lazily rather than at module scope: Workers disallows crypto during
  // global-scope evaluation, so seeding this at import time would throw on
  // isolate startup.
  isolateId ??= crypto.randomUUID().slice(0, 8)
  return { isolate: isolateId, seq: ++served }
}

type Timer = {
  mark: (name: string) => void
  phases: Record<string, number>
}

const KEY = "phaseTimer"

// Apply BEFORE any other middleware on the route. The session resolve that
// edgeCache performs (lib/edge-cache.ts → isAuthenticated) is itself one of the
// suspects, so it has to fall inside the measured window rather than upstream
// of it.
export function profile(route: string): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now()
    const phases: Record<string, number> = {}
    let last = start
    const timer: Timer = {
      mark(name) {
        const now = Date.now()
        phases[name] = now - last
        last = now
      },
      phases,
    }
    c.set(KEY, timer)

    await next()

    console.info("profile", {
      route,
      ...isolateStamp(),
      phases,
      // Sum of the marked phases vs. the wall span. A gap means time was spent
      // somewhere unmarked; in production it means the clock was frozen for it.
      marked: Object.values(phases).reduce((a, b) => a + b, 0),
      wall: Date.now() - start,
    })
  }
}

// No-ops when the route isn't wrapped in profile(), so a handler can carry
// marks without requiring the middleware.
export function marker(c: Context): (name: string) => void {
  const timer = c.get(KEY) as Timer | undefined
  return timer ? timer.mark : () => {}
}
