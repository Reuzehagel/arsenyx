// Injected by Vite `define` in vite.config.ts — a build-time stamp of the
// static data version (epoch ms of `public/data/meta.json`'s `generatedAt`).
// Appended as `?v=` to every `/data/` fetch (see lib/queries/static-data-query.ts)
// so the CDN can serve the catalog as `immutable` yet bust automatically the
// next time the data pipeline regenerates it.
declare const __DATA_VERSION__: string

// Dev only: the seeded admin login that prefills the dev sign-in form. `just
// setup` writes it to apps/web/.env.development.local, which Vite loads under
// `vite dev` and never in a production build.
interface ImportMetaEnv {
  readonly VITE_DEV_ADMIN_EMAIL?: string
  readonly VITE_DEV_ADMIN_PASSWORD?: string
}
