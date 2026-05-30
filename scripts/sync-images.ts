/**
 * Mirror image URLs emitted by build-items-index into our R2 bucket and
 * rewrite the JSON catalog to point at our public CDN domain.
 *
 *   build:items  →  imageName = "https://content.warframe.com/.../Foo.png!00_xyz"
 *   sync:images  →  imageName = "https://img.arsenyx.com/Foo-abc123.png"
 *
 * Idempotent. Re-running after a partial run picks up where it left off;
 * re-running after a no-op build is fast (HEADs only, no uploads).
 *
 * Sources: DE PublicExport CDN (primary) and wiki.warframe.com/images/
 * (fallback for wiki-only items). Both are content-hashed at the source,
 * so the SHA prefix in our key locks the bytes against future re-uploads
 * upstream — a wiki re-upload changes the URL, which changes the key,
 * which triggers a fresh download.
 *
 * Known debt: keys derive from the source URL. If upstream ever rotates a URL
 * without changing the bytes, we upload a fresh copy and the old object orphans
 * — there's no prune pass, so the bucket can grow slowly over many game
 * updates. Storage-only (cheap) and not user-facing; add a sweep keyed on the
 * live catalog if the bucket ever grows noticeably.
 *
 * Requires .env at repo root with R2_* vars. See .env.example.
 */

import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { AwsClient } from "aws4fetch"

import { fetchRetry } from "./build/http"
import { escapeRegex, findJsonFiles, sourceUrlRe } from "./build/image-hosts"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const DATA_DIR = resolve(REPO_ROOT, "apps/web/public/data")

/** Upstream URLs we mirror (see `SOURCE_HOSTS` in build/image-hosts.ts).
 *  URLs on any other host are left untouched in the catalog (so manually-
 *  curated local `/img/...` paths still work). */
const SOURCE_URL_RE = sourceUrlRe()

function envOrThrow(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example → .env at the repo ` +
        `root and fill in your R2 credentials.`,
    )
  }
  return v
}

/** Build chains (`data:bump`, the justfile rebuild target) pass
 *  `--skip-if-no-creds` so a contributor without R2 access — or the weekly
 *  data-refresh cron, which carries no R2 secrets — can still rebuild the
 *  catalog. In that case the catalog is left pointing at the upstream CDNs;
 *  CI's hotlink guard (`bun run check:images`) then blocks that from merging,
 *  so a human runs `sync:images` locally before the data PR lands. A direct
 *  `bun run sync:images` (no flag) still hard-errors via `envOrThrow`. */
const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const
const missingCreds = R2_ENV_KEYS.filter((k) => !process.env[k])
if (missingCreds.length > 0 && process.argv.includes("--skip-if-no-creds")) {
  console.warn(
    `⚠ sync:images skipped — missing R2 creds (${missingCreds.join(", ")}). ` +
      `Catalog still points at the upstream CDNs. Add them to the root .env ` +
      `and run \`bun run sync:images\` before deploying — CI's hotlink guard ` +
      `flags it otherwise.`,
  )
  process.exit(0)
}

const PUBLIC_URL = envOrThrow("R2_PUBLIC_URL").replace(/\/+$/, "")
const BUCKET = envOrThrow("R2_BUCKET")
const ACCOUNT_ID = envOrThrow("R2_ACCOUNT_ID")
const R2_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`

/** SigV4-signed fetch against the R2 S3-compatible API. `aws4fetch` is a
 *  ~5KB shim that signs `fetch()` requests — far lighter than the official
 *  @aws-sdk and works on every runtime. */
const aws = new AwsClient({
  accessKeyId: envOrThrow("R2_ACCESS_KEY_ID"),
  secretAccessKey: envOrThrow("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
})

function objectUrl(key: string): string {
  return `${R2_ENDPOINT}/${BUCKET}/${encodeURI(key)}`
}

// ---------------------------------------------------------------------------
// Walk catalog JSONs, collect every source URL we need to mirror.
// ---------------------------------------------------------------------------

function extractSourceUrls(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.matchAll(SOURCE_URL_RE)) out.add(m[0])
  return out
}

// ---------------------------------------------------------------------------
// Storage-key derivation.
// ---------------------------------------------------------------------------

/** `<stem>-<sha8>.<ext>` — derived from the source URL. Debuggable basename
 *  plus 8 hex chars of SHA-256 so two unrelated upstream files with the
 *  same basename can't collide. The source URL itself already carries the
 *  upstream's content hash (DE's `!00_xxx`, wiki's `?xxx`), so the key
 *  is implicitly content-stable. */
function keyForUrl(url: string): string {
  const u = new URL(url)
  // Last path segment, then strip the DE `!00_<hash>` cache-buster and
  // any query string.
  let base = u.pathname.split("/").pop() ?? ""
  base = base.split("!")[0] ?? base
  base = base.split("?")[0] ?? base
  // Replace anything that isn't filename-safe with `_`. Wiki filenames
  // contain `()`, `'`, etc. which work as URL paths but uglify R2 keys.
  base = base.replace(/[^a-zA-Z0-9._-]/g, "_")
  if (base.length === 0) base = "image.bin"
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 8)
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return `${base}-${hash}`
  return `${base.slice(0, dot)}-${hash}${base.slice(dot)}`
}

// ---------------------------------------------------------------------------
// Upload pipeline.
// ---------------------------------------------------------------------------

interface UploadResult {
  url: string
  key: string
  status: "uploaded" | "skipped" | "missing"
}

/** Pass `--refresh-metadata` to re-apply Content-Type / Content-Disposition /
 *  Cache-Control on every already-uploaded object (via S3 CopyObject — no
 *  re-download). Useful when an earlier run uploaded objects with
 *  `application/octet-stream` (which made browsers offer a download instead of
 *  rendering inline) or with no Cache-Control (which left the edge BYPASSing). */
const REFRESH_METADATA = process.argv.includes("--refresh-metadata")

/** Map file extension → image MIME type. Trusting the upstream Content-Type
 *  bit us once: some responses came back as `application/octet-stream`, which
 *  R2 then served back verbatim and browsers treated as a download. Since we
 *  control the key (and therefore the extension), derive the type ourselves. */
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  ico: "image/x-icon",
}

function contentTypeForKey(key: string): string {
  const dot = key.lastIndexOf(".")
  if (dot < 0) return "application/octet-stream"
  const ext = key.slice(dot + 1).toLowerCase()
  return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

/** Catalog keys are content-hashed (`<stem>-<sha8>.<ext>`), so the bytes at a
 *  given URL never change — safe to cache forever. Without an explicit header,
 *  R2's custom domain serves these with no Cache-Control and Cloudflare's edge
 *  returns `Cf-Cache-Status: BYPASS`, round-tripping every icon to the R2
 *  origin. A zone-level Cache Rule on the public domain is still needed to flip
 *  the edge to HIT for all types; this header makes browsers cache long too. */
const CACHE_CONTROL = "public, max-age=31536000, immutable"

async function existsInBucket(key: string): Promise<boolean> {
  const res = await aws.fetch(objectUrl(key), { method: "HEAD" })
  if (res.status === 200) return true
  if (res.status === 404) return false
  throw new Error(`HEAD ${key} → HTTP ${res.status}`)
}

/** Rewrite an existing object's metadata in place via S3 CopyObject with
 *  `x-amz-metadata-directive: REPLACE`. No bytes are re-downloaded from
 *  upstream — R2 copies the body internally. */
async function refreshMetadata(key: string): Promise<void> {
  const res = await aws.fetch(objectUrl(key), {
    method: "PUT",
    headers: {
      "x-amz-copy-source": `/${BUCKET}/${encodeURI(key)}`,
      "x-amz-metadata-directive": "REPLACE",
      "Content-Type": contentTypeForKey(key),
      "Content-Disposition": "inline",
      "Cache-Control": CACHE_CONTROL,
    },
  })
  if (!res.ok) {
    throw new Error(`CopyObject ${key} → HTTP ${res.status} ${await res.text()}`)
  }
}

async function ensureUploaded(url: string, key: string): Promise<UploadResult> {
  if (await existsInBucket(key)) {
    return { url, key, status: "skipped" }
  }
  const res = await fetchRetry(url, {
    headers: {
      // Identify ourselves so an upstream operator can trace abuse back
      // to us if anything goes wrong. (Wiki /images/ isn't rate-limited
      // the way /Special:FilePath is, but be polite either way.)
      "User-Agent": "arsenyx-image-sync (https://www.arsenyx.com)",
    },
  })
  if (!res.ok) {
    console.warn(`  upstream HTTP ${res.status} for ${url}`)
    return { url, key, status: "missing" }
  }
  const body = await res.arrayBuffer()
  const put = await aws.fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: {
      // Set Content-Type from our key's extension, not the upstream
      // response — see MIME_BY_EXT comment above. Content-Disposition:
      // inline tells browsers to render in-tab instead of triggering
      // the save dialog when the user opens the image directly.
      "Content-Type": contentTypeForKey(key),
      "Content-Disposition": "inline",
      "Cache-Control": CACHE_CONTROL,
    },
  })
  if (!put.ok) {
    throw new Error(`PUT ${key} → HTTP ${put.status} ${await put.text()}`)
  }
  return { url, key, status: "uploaded" }
}

/** Run `fn` over `items` with at most `concurrency` in flight at once. */
async function pMap<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i]!, i)
    }
  })
  await Promise.all(workers)
  return out
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

/** `--refresh-metadata` only: re-apply Content-Type / Content-Disposition /
 *  Cache-Control on every object the catalog already references, derived from the keys in the
 *  current JSON — whether they still point upstream (pre-sync) or at our CDN
 *  (post-sync). Keying off the live catalog (not the upstream URL set, which
 *  is empty once a sync has rewritten everything) is what makes this runnable
 *  at any time. Uses S3 CopyObject — no bytes are re-downloaded. */
async function refreshAllMetadata(files: readonly string[]): Promise<void> {
  const ourUrlRe = new RegExp(`${escapeRegex(PUBLIC_URL)}/([^"\\\\]+)`, "g")
  const keys = new Set<string>()
  for (const f of files) {
    const text = readFileSync(f, "utf8")
    for (const u of extractSourceUrls(text)) keys.add(keyForUrl(u))
    for (const m of text.matchAll(ourUrlRe)) keys.add(decodeURIComponent(m[1]!))
  }
  console.log(`\n--refresh-metadata: re-applying Content-Type / Content-Disposition / Cache-Control on ${keys.size} objects`)

  let fixed = 0
  let absent = 0
  const list = [...keys]
  await pMap(list, 16, async (key, i) => {
    if (await existsInBucket(key)) {
      await refreshMetadata(key)
      fixed++
    } else {
      absent++
    }
    if ((i + 1) % 200 === 0 || i === list.length - 1) {
      console.log(`  ${i + 1}/${list.length}  (${fixed} refreshed, ${absent} not in bucket)`)
    }
  })
  console.log(`\nMetadata refresh complete: ${fixed} refreshed, ${absent} not in bucket`)
}

async function main(): Promise<void> {
  console.log(`Bucket: ${BUCKET}`)
  console.log(`Public: ${PUBLIC_URL}`)

  const files = findJsonFiles(DATA_DIR)

  if (REFRESH_METADATA) {
    await refreshAllMetadata(files)
    return
  }

  const sources = new Set<string>()
  for (const f of files) {
    for (const u of extractSourceUrls(readFileSync(f, "utf8"))) sources.add(u)
  }
  console.log(`\n${sources.size} unique source URLs across ${files.length} JSONs`)

  if (sources.size === 0) {
    console.log("Nothing to mirror — either build:items hasn't run, or all URLs are already on our CDN.")
    return
  }

  // Build the remap up-front so JSON rewriting doesn't depend on upload
  // success — even if an upload 404s upstream, the catalog entry still
  // points at our CDN (which will 404 too, surfacing the gap cleanly
  // instead of silently leaving a stale upstream URL behind).
  const remap = new Map<string, string>()
  for (const src of sources) {
    remap.set(src, `${PUBLIC_URL}/${keyForUrl(src)}`)
  }

  // Upload pass.
  const list = [...sources]
  let uploaded = 0
  let skipped = 0
  const missingUrls: string[] = []
  await pMap(list, 16, async (src, i) => {
    const key = keyForUrl(src)
    const result = await ensureUploaded(src, key)
    if (result.status === "uploaded") uploaded++
    else if (result.status === "skipped") skipped++
    else missingUrls.push(src)
    if ((i + 1) % 100 === 0 || i === list.length - 1) {
      console.log(
        `  ${i + 1}/${list.length}  (${uploaded} uploaded, ${skipped} already in R2, ${missingUrls.length} upstream-missing)`,
      )
    }
  })

  console.log(`\nUpload pass complete:`)
  console.log(`  ${uploaded} uploaded`)
  console.log(`  ${skipped} already in R2`)
  console.log(`  ${missingUrls.length} upstream missing (will 404 from our CDN too)`)
  if (missingUrls.length > 0) {
    // Surface the gaps explicitly — these are the only catalog images that
    // won't resolve from our CDN, because upstream itself 404s. Fix the
    // source (curated data / build) rather than the bucket.
    console.log(`\n  Upstream-missing URLs:`)
    for (const u of missingUrls.sort()) console.log(`    ${u}`)
  }

  // Rewrite pass — single regex replace per file using the remap.
  let rewrittenFiles = 0
  for (const f of files) {
    const text = readFileSync(f, "utf8")
    const out = text.replace(SOURCE_URL_RE, (m) => remap.get(m) ?? m)
    if (out !== text) {
      writeFileSync(f, out, "utf8")
      rewrittenFiles++
    }
  }
  console.log(`\nRewrote ${rewrittenFiles} JSON files to point at ${PUBLIC_URL}`)
}

await main()
