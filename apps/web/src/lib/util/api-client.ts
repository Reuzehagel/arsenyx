import { notFound } from "@tanstack/react-router"

import { API_URL } from "./constants"

/** Common error-body shape across arsenyx routes — Hono handlers all return
 *  `{ error }` or `{ message }`; Overframe import also surfaces `details`. */
interface ApiErrorBody {
  error?: string
  message?: string
  details?: string
}

class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody | null,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** Read the user-facing message from a thrown value. Returns `fallback` when
 *  it isn't an `ApiError` or the body has no message field. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  return err.body?.message ?? err.body?.error ?? err.body?.details ?? fallback
}

/** HTTP status and `error` code of a failed API call; both null for anything
 *  that isn't an ApiError (no answer, or a client-side throw). */
export function apiErrorInfo(err: unknown): {
  status: number | null
  code: string | null
} {
  if (!(err instanceof ApiError)) return { status: null, code: null }
  return { status: err.status, code: err.body?.error ?? null }
}

export interface ApiFetchInit extends Omit<RequestInit, "body"> {
  /** JSON-stringified into the request body with the right content-type. */
  json?: unknown
  /** Raw body (FormData, Blob, etc.). Mutually exclusive with `json`. */
  body?: BodyInit
}

/** `fetch` with arsenyx defaults: prepends `API_URL`, sends cookies, throws
 *  `ApiError` on non-2xx. Returns the raw `Response` (blobs, headers). */
export async function apiResponse(
  path: string,
  init?: ApiFetchInit,
): Promise<Response> {
  const { json, headers, body, ...rest } = init ?? {}
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(json !== undefined && { "content-type": "application/json" }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : body,
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw new ApiError(res.status, errBody, `API ${res.status}: ${path}`)
  }
  return res
}

/** {@link apiResponse} parsed as JSON; `undefined` for 204. */
export async function apiFetch<T = unknown>(
  path: string,
  init?: ApiFetchInit,
): Promise<T> {
  const res = await apiResponse(path, init)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface ApiErrorPolicy {
  /** Message of the `Error` thrown per HTTP status; `default` covers every
   *  other failure, network errors included. Without `default`, a failure no
   *  entry names propagates unchanged. The original is kept as `cause`. */
  codes?: Partial<Record<number | "default", string>>
  /** Prefer the server's body message over `codes` (admin / org forms show
   *  it verbatim). An `ApiError` without one falls back to `codes`, then
   *  `http_<status>`. */
  serverMessage?: boolean
  /** Throw the router's `notFound()` on a 404 (detail-page loaders). */
  notFoundOn404?: boolean
}

/**
 * The one API error policy: {@link apiFetch} whose failures become the stable
 * `Error` messages the UI keys on (see {@link ApiErrorPolicy}).
 */
export async function apiCall<T = unknown>(
  path: string,
  {
    codes,
    serverMessage,
    notFoundOn404,
    ...init
  }: ApiFetchInit & ApiErrorPolicy = {},
): Promise<T> {
  try {
    return await apiFetch<T>(path, init)
  } catch (err) {
    throw apiCallError(err, { codes, serverMessage, notFoundOn404 })
  }
}

/** The value {@link apiCall} throws for a failure `err`. */
export function apiCallError(
  err: unknown,
  { codes = {}, serverMessage, notFoundOn404 }: ApiErrorPolicy,
): unknown {
  if (!(err instanceof ApiError)) {
    return codes.default ? new Error(codes.default, { cause: err }) : err
  }
  if (notFoundOn404 && err.status === 404) return notFound()
  const fromCodes = codes[err.status] ?? codes.default
  const message = serverMessage
    ? apiErrorMessage(err, fromCodes ?? `http_${err.status}`)
    : fromCodes
  return message ? new Error(message, { cause: err }) : err
}

type QueryValue = string | number | boolean | null | undefined

/**
 * `?k=v&…` from `params` in key order, `""` when nothing remains. Skips empty
 * values (`undefined`, `null`, `""`, `false`, `0`) and any equal to its
 * `defaults` entry, so default state keeps the bare URL. `true` → `1`.
 */
export function toQueryString(
  params: Record<string, QueryValue>,
  defaults: Record<string, QueryValue> = {},
): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!value || value === defaults[key]) continue
    qs.set(key, value === true ? "1" : String(value))
  }
  const str = qs.toString()
  return str ? `?${str}` : ""
}
