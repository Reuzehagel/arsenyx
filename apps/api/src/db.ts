import { AsyncLocalStorage } from "node:async_hooks"

import { PrismaPg } from "@prisma/adapter-pg"
import { Pool, types } from "pg"

import { type Prisma, PrismaClient } from "./generated/prisma/client"
import "./lib/scram-cache"

// Workers reuses isolates across requests, and the pg Pool is request-scoped.
// A module-level PrismaClient singleton leaks I/O across requests → `Cannot
// perform I/O on behalf of a different request`. We scope one client per
// request via AsyncLocalStorage; routes keep using the `prisma` proxy
// unchanged.
//
// The connection string comes from the Hyperdrive binding
// (`env.HYPERDRIVE.connectionString`), threaded in through `withPrisma`.
// Unlike the old Neon `DATABASE_URL`, it can't be read from `process.env` —
// it's a runtime binding with a dynamically-allocated local port. Hyperdrive
// owns the upstream pool, but the per-request client still costs: creation,
// the pg connection and query planning are ~half of a cache miss's CPU.

type RequestScope = {
  connectionString: string
  pool: Pool | null
  client: PrismaClient | null
  pending: Set<Promise<unknown>>
}

const als = new AsyncLocalStorage<RequestScope>()

// One pg Pool per request, shared by raw `sql` reads and the PrismaClient, so a
// request that uses both reuses the same connection(s).
function currentPool(): Pool {
  const scope = currentScope()
  if (!scope.pool)
    scope.pool = new Pool({ connectionString: scope.connectionString })
  return scope.pool
}

function createPrismaClient(pool: Pool) {
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })
}

function currentScope(): RequestScope {
  const scope = als.getStore()
  if (!scope) {
    throw new Error(
      "prisma accessed outside withPrisma() — wrap the request handler",
    )
  }
  return scope
}

function currentClient(): PrismaClient {
  const scope = currentScope()
  if (!scope.client) scope.client = createPrismaClient(currentPool())
  return scope.client
}

// Prisma's DateTime columns are `timestamp without time zone` holding UTC; pg's
// default parser reads them as local time. Per query, so Prisma's parsing of
// the shared pool is untouched.
const TIMESTAMP_OID = 1114
const sqlTypes = {
  getTypeParser: ((oid: number, format?: "text" | "binary") =>
    oid === TIMESTAMP_OID
      ? (s: string) => new Date(`${s.replace(" ", "T")}Z`)
      : types.getTypeParser(oid, format)) as typeof types.getTypeParser,
}

/** Plain parameterized SQL on the request's connection, without constructing
 *  a PrismaClient (~half of a cache miss's CPU). For hot anonymous reads; rows
 *  come back as pg parses them (timestamps → UTC Date, json → objects). */
export async function sql<T>(query: Prisma.Sql): Promise<T[]> {
  const res = await currentPool().query({
    text: query.text,
    values: query.values,
    types: sqlTypes,
  })
  return res.rows as T[]
}

export function withPrisma<T>(
  connectionString: string,
  ctx: ExecutionContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  // Lazy: the client (and its WASM query engine init) is only constructed
  // when a route actually touches `prisma.*`. Requests that satisfy from
  // Better Auth's cookieCache (the common /auth/get-session path) never
  // pay the Prisma init cost.
  const scope: RequestScope = {
    connectionString,
    pool: null,
    client: null,
    pending: new Set(),
  }
  return als.run(scope, async () => {
    try {
      return await fn()
    } finally {
      // Keep the pool alive until all background work registered via
      // registerBackgroundWork() settles, then close it. Read the scope after
      // that, since background work may be what first opened it.
      if (scope.pool || scope.pending.size > 0) {
        ctx.waitUntil(
          Promise.allSettled([...scope.pending]).then(async () => {
            await scope.client?.$disconnect()
            await scope.pool?.end()
          }),
        )
      }
    }
  })
}

// Register a promise to be awaited before the request's Prisma client is
// disconnected. Callers can use this to schedule fire-and-forget writes
// (e.g. lastUsedAt bumps) that still need a live client to complete.
export function registerBackgroundWork(promise: Promise<unknown>): void {
  const scope = als.getStore()
  if (!scope) {
    promise.catch(() => {})
    return
  }
  const wrapped = promise.catch(() => {})
  scope.pending.add(wrapped)
  wrapped.finally(() => scope.pending.delete(wrapped))
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    // Better Auth's prisma adapter reads this at betterAuth() init (module
    // load, outside withPrisma) for an optional schema check; skip the check.
    if (prop === "_runtimeDataModel") return undefined
    return Reflect.get(currentClient() as object, prop)
  },
})
