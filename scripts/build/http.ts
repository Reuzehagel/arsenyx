/**
 * `fetch()` with a per-attempt timeout and bounded retries.
 *
 * The data-sync scripts hit content.warframe.com (DE PublicExport) and
 * wiki.warframe.com (Lua modules) — both behind Cloudflare, where a bare
 * `fetch` can stall a half-open connection *indefinitely* with no feedback.
 * That's the "data:bump looks stuck forever" failure mode. This wrapper aborts
 * each attempt after `timeoutMs` and retries transient failures (timeouts,
 * network errors, HTTP 5xx/429) with exponential backoff, so a refresh either
 * makes progress or fails loudly — it never hangs. Non-retryable client errors
 * (4xx other than 429) fail fast without burning retries.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchRetry(
  url: string,
  {
    timeoutMs = 30_000,
    retries = 3,
    headers,
  }: {
    timeoutMs?: number
    retries?: number
    headers?: Record<string, string>
  } = {},
): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    let res: Response
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers,
      })
    } catch (err) {
      // Timeout (AbortError) or network-level failure — transient, retry.
      lastErr = err
      const reason = err instanceof Error ? err.name : String(err)
      if (attempt < retries) {
        const backoff = 500 * 2 ** (attempt - 1)
        console.warn(
          `  ⚠ ${url} attempt ${attempt}/${retries} failed (${reason}); ` +
            `retrying in ${backoff}ms`,
        )
        await sleep(backoff)
      }
      continue
    }
    if (res.ok) return res

    const msg = `Fetch ${url} -> HTTP ${res.status} ${res.statusText}`
    // 5xx and 429 are transient; other 4xx won't fix themselves — fail now.
    if (res.status < 500 && res.status !== 429) throw new Error(msg)
    lastErr = new Error(msg)
    if (attempt < retries) {
      const backoff = 500 * 2 ** (attempt - 1)
      console.warn(
        `  ⚠ ${msg} (attempt ${attempt}/${retries}); retrying in ${backoff}ms`,
      )
      await sleep(backoff)
    }
  }
  throw lastErr
}
