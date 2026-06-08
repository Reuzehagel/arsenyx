import { API_URL } from "./constants"

/** Common error-body shape across arsenyx routes — Hono handlers all return
 *  `{ error }` or `{ message }`; Overframe import also surfaces `details`. */
export interface ApiErrorBody {
  error?: string
  message?: string
  details?: string
}

export class ApiError extends Error {
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

/** Maps an `ApiError` to a stable code string via per-status overrides,
 *  falling back to `codes.default`. Non-`ApiError` values are returned as-is
 *  so unexpected throws (network errors, etc.) propagate unchanged. The
 *  returned `Error` keeps the original as its `cause`. Used by mutation hooks
 *  that translate HTTP statuses into UI-facing error codes. */
export function remapApiError(
  err: unknown,
  codes: { default: string; 401?: string; 403?: string; 404?: string },
): unknown {
  if (!(err instanceof ApiError)) return err
  const code =
    (err.status === 401 && codes[401]) ||
    (err.status === 403 && codes[403]) ||
    (err.status === 404 && codes[404]) ||
    codes.default
  return new Error(code, { cause: err })
}

/** Loader-side error normalizer: always returns an `Error` (never passes a
 *  non-`ApiError` cause through), so a query loader surfaces a stable
 *  user-facing failure regardless of the underlying cause. `on401` overrides
 *  the message on a 401. The original is kept as `cause`. Use this in query
 *  loaders; use `remapApiError` in mutations that need network errors to
 *  propagate unchanged. */
export function loaderError(
  err: unknown,
  fallback: string,
  on401?: string,
): Error {
  if (on401 && err instanceof ApiError && err.status === 401)
    return new Error(on401, { cause: err })
  return new Error(fallback, { cause: err })
}

export interface ApiFetchInit extends Omit<RequestInit, "body"> {
  /** JSON-stringified into the request body with the right content-type. */
  json?: unknown
  /** Raw body (FormData, Blob, etc.). Mutually exclusive with `json`. */
  body?: BodyInit
}

/**
 * `fetch` with arsenyx defaults: prepends `API_URL`, sends cookies, parses
 * JSON, throws `ApiError` on non-2xx. Returns `undefined` for 204.
 *
 * For callers that need raw `Response` (streaming, header inspection,
 * non-JSON bodies on success), stick with `fetch`.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: ApiFetchInit,
): Promise<T> {
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
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
