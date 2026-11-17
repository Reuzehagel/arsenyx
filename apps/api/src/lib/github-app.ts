// Files GitHub issues as the Arsenyx GitHub App (routes/reports.ts). The App,
// not a personal token, so issues show as opened by the bot and the repo owner
// is notified of them like any other new issue.
//
// Config (all three or the feature is off — see `githubAppConfig`):
//   GITHUB_APP_ID           — the App's numeric id (secret or var)
//   GITHUB_APP_PRIVATE_KEY  — the App's private key PEM (secret). GitHub hands
//                             out PKCS#1 ("BEGIN RSA PRIVATE KEY"); PKCS#8
//                             works too. Literal `\n` escapes are accepted.
//   GITHUB_ISSUES_REPO      — "owner/name" the issues go to ([vars])

const GITHUB_API = "https://api.github.com"
const USER_AGENT = "arsenyx-api"

export interface GithubAppConfig {
  appId: string
  privateKey: string
  repo: string
}

export function githubAppConfig(): GithubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID?.trim()
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim()
  const repo = process.env.GITHUB_ISSUES_REPO?.trim()
  if (!appId || !privateKey || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return null
  }
  return { appId, privateKey, repo }
}

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "GithubError"
  }
}

// ---------------------------------------------------------------------------
// Key handling

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64Url(bytes: Uint8Array | string): string {
  const bin =
    typeof bytes === "string"
      ? unescape(encodeURIComponent(bytes))
      : String.fromCharCode(...bytes)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** DER length octets. */
function derLength(n: number): number[] {
  if (n < 0x80) return [n]
  const bytes: number[] = []
  while (n > 0) {
    bytes.unshift(n & 0xff)
    n >>= 8
  }
  return [0x80 | bytes.length, ...bytes]
}

// AlgorithmIdentifier { rsaEncryption, NULL }, DER-encoded.
const RSA_ALGORITHM_ID = [
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
  0x05, 0x00,
]

/** Wraps a PKCS#1 RSAPrivateKey in a PKCS#8 PrivateKeyInfo, the only RSA
 *  private-key format WebCrypto imports. */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array<ArrayBuffer> {
  const octetString = [0x04, ...derLength(pkcs1.length)]
  const version = [0x02, 0x01, 0x00]
  const innerLength =
    version.length + RSA_ALGORITHM_ID.length + octetString.length + pkcs1.length
  const header = [
    0x30,
    ...derLength(innerLength),
    ...version,
    ...RSA_ALGORITHM_ID,
    ...octetString,
  ]
  const out = new Uint8Array(header.length + pkcs1.length)
  out.set(header)
  out.set(pkcs1, header.length)
  return out
}

/** PEM (PKCS#1 or PKCS#8) → PKCS#8 DER bytes. */
export function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const text = pem.replace(/\\n/g, "\n")
  const isPkcs1 = text.includes("BEGIN RSA PRIVATE KEY")
  const body = text
    .replace(/-----(BEGIN|END) [A-Z ]+-----/g, "")
    .replace(/\s+/g, "")
  const der = base64ToBytes(body)
  return isPkcs1 ? pkcs1ToPkcs8(der) : der
}

async function appJwt(cfg: GithubAppConfig): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(cfg.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const now = Math.floor(Date.now() / 1000)
  // Backdated a minute for clock drift; GitHub caps the lifetime at 10 min.
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = base64Url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: cfg.appId }),
  )
  const signed = `${header}.${payload}`
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signed),
  )
  return `${signed}.${base64Url(new Uint8Array(sig))}`
}

// ---------------------------------------------------------------------------
// Requests

async function github<T>(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new GithubError(res.status, `GitHub ${path}: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

// An installation token lives an hour. Caching the settled string per isolate
// spares the JWT signing and two GitHub calls on every report.
let cachedToken: { repo: string; token: string; expiresAt: number } | null =
  null

async function installationToken(cfg: GithubAppConfig): Promise<string> {
  if (
    cachedToken &&
    cachedToken.repo === cfg.repo &&
    cachedToken.expiresAt - Date.now() > 5 * 60_000
  ) {
    return cachedToken.token
  }
  const jwt = await appJwt(cfg)
  const installation = await github<{ id: number }>(
    `/repos/${cfg.repo}/installation`,
    jwt,
  )
  const { token, expires_at } = await github<{
    token: string
    expires_at: string
  }>(`/app/installations/${installation.id}/access_tokens`, jwt, {
    method: "POST",
  })
  cachedToken = { repo: cfg.repo, token, expiresAt: Date.parse(expires_at) }
  return token
}

/** The current login of a GitHub account, by its numeric id (what Better Auth
 *  stores as `accountId`). Null when GitHub can't say. */
export async function githubLoginForId(
  cfg: GithubAppConfig,
  githubId: string,
): Promise<string | null> {
  if (!/^\d+$/.test(githubId)) return null
  try {
    const token = await installationToken(cfg)
    const user = await github<{ login?: string }>(`/user/${githubId}`, token)
    return user.login ?? null
  } catch (err) {
    console.warn("github: login lookup failed", (err as Error).message)
    return null
  }
}

export interface CreatedIssue {
  number: number
  url: string
}

/** Opens an issue. If GitHub rejects the labels (422), retries without them:
 *  a missing label shouldn't lose the user's report. */
export async function createGithubIssue(
  cfg: GithubAppConfig,
  issue: { title: string; body: string; labels: string[] },
): Promise<CreatedIssue> {
  const token = await installationToken(cfg)
  const post = (body: object) =>
    github<{ number: number; html_url: string }>(
      `/repos/${cfg.repo}/issues`,
      token,
      { method: "POST", body },
    )
  let created
  try {
    created = await post(issue)
  } catch (err) {
    if (!(err instanceof GithubError) || err.status !== 422) throw err
    created = await post({ title: issue.title, body: issue.body })
  }
  return { number: created.number, url: created.html_url }
}
