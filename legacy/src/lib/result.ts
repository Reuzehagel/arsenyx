// =============================================================================
// STANDARD RESULT TYPE — discriminated union for server action returns
// =============================================================================

/**
 * Discriminated union for server action results.
 * Use `ok(data)` and `err(error)` helpers to construct.
 *
 * Consumer pattern:
 * ```ts
 * const result = await someAction();
 * if (result.success) {
 *   // result.data is typed as T
 * } else {
 *   // result.error is string
 * }
 * ```
 */
export type Result<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

/** Create a success result */
export function ok(): Result<void>
export function ok<T>(data: T): Result<T>
export function ok<T>(data?: T): Result<T> {
  return { success: true, data: data as T }
}

/** Create an error result */
export function err(error: string): Result<never> {
  return { success: false, error }
}

/** Extract error message from unknown catch value */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  return fallback
}
