# Web performance

How to measure page load, and where it stands. For Worker CPU and billing, see [usage-analytics.md](usage-analytics.md).

## Bundle: what every page downloads

```bash
bun run bundle:report
```

[scripts/bundle-report.ts](../scripts/bundle-report.ts) builds apps/web with sourcemaps, takes the eager set from the built `index.html`, and prints each chunk's size and its bytes per package. The brotli column uses max quality. The Cloudflare edge compresses less, so prod transfers about 20% more (check with `curl -s -o /dev/null -H 'accept-encoding: br' -w '%{size_download}' <url>`).

## Page vitals in the browser pane

There is no DevTools trace tool here, so read the Performance API from the page. Run this after the page loads through `javascript_tool`:

```js
const get = (t) => new Promise((res) => { const a = []; new PerformanceObserver((l) => a.push(...l.getEntries())).observe({ type: t, buffered: true }); setTimeout(() => res(a), 300) })
const [lcp, cls, lt] = await Promise.all(["largest-contentful-paint", "layout-shift", "longtask"].map(get))
const nav = performance.getEntriesByType("navigation")[0]
;({ ttfb: nav.responseStart, lcp: lcp.at(-1)?.startTime, lcpEl: lcp.at(-1)?.element?.outerHTML.slice(0, 120), cls: cls.reduce((s, e) => s + e.value, 0), longTasks: lt.map((e) => e.duration),
   res: performance.getEntriesByType("resource").map((r) => ({ u: r.name, start: r.startTime, tx: r.transferSize, body: r.decodedBodySize })) })
```

- These are warm-cache, unthrottled numbers. The pane can't clear the cache or throttle the network, so treat them as a floor and say so in any report.
- `paint` and LCP entries are missing while the pane is hidden. Bring it to the front, then reload.
- `transferSize: 0` means the response came from the browser cache.

## Baseline (2026-11-03)

- **Eager JS:** about 300 KB brotli on every route (`main` + `globals` + `relative-time` + `link`), plus 27 KB of CSS and the 29 KB Geist font. Most of it is framework code: react-dom, Base UI (`Select` is pulled in by the sort dropdowns), TanStack Router and Query. Vendor `manualChunks` was tried and reverted (see the comment in [vite.config.ts](../apps/web/vite.config.ts)). Lazy-loading the settings dialog would save only about 15 KB raw.
- **Caching is done:** hashed `/assets/*` and versioned `/data/*` are `immutable`, HTML revalidates, UI art caches for a day ([public/\_headers](../apps/web/public/_headers)). Everything is brotli and an edge HIT.
- **Warm vitals:** home TTFB 73 ms, CLS 0; build page LCP about 1.05 s (a mod-card frame image), CLS 0; no long tasks.
- **Home hero:** `index.html` preloads `items-index.json` on `/` only, and the hero `<img>` is `fetchPriority="high"` (#441).
- **Open:** catalog images are PNGs (the home hero is 80 KB at 512 px), and WebP would roughly halve them; that's a `sync:images` pipeline change. `wiki.warframe.com` is preconnected site-wide, but only build pages hotlink icons from it.
