// Injected by Vite `define` in vite.config.ts — a build-time stamp of the
// static data version (epoch ms of `public/data/meta.json`'s `generatedAt`).
// Appended as `?v=` to every `/data/` fetch (see lib/queries/static-data-query.ts)
// so the CDN can serve the catalog as `immutable` yet bust automatically the
// next time the data pipeline regenerates it.
declare const __DATA_VERSION__: string
