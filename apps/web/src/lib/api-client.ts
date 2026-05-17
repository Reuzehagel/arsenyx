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
  return (
    err.body?.message ??
    err.body?.error ??
    err.body?.details ??
    fallback
  )
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
