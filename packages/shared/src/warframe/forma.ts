// Version of the forma-count derivation. Stored on each build row as
// `formaCalcVersion` when the count is computed. Bump this whenever the forma
// calculation (apps/web build-editor `computeFormaCount` / `calculateFormaCount`)
// changes, so a targeted recompute can find stale rows with
// `WHERE "formaCalcVersion" < FORMA_CALC_VERSION` instead of rescanning the
// whole table. See scripts/recompute-forma.ts.
export const FORMA_CALC_VERSION = 1

// `formaCalcVersion` value for a row whose count was never computed by the
// current calc — a pre-backfill row, or a write that didn't carry a valid
// client count. The recompute backfill targets these via
// `WHERE "formaCalcVersion" < FORMA_CALC_VERSION`. Must stay 0 to match the
// `formaCount`/`formaCalcVersion` column defaults in the Prisma schema.
export const FORMA_UNSTAMPED = 0

// Defensive bound on the client-supplied forma count. No real build has more
// forma than it has slots (aura + exilus + stance + ~12 normal). 99 leaves
// generous headroom while rejecting absurd values from a crafted payload.
export const MAX_FORMA_COUNT = 99
