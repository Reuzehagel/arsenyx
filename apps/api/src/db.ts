import { AsyncLocalStorage } from "node:async_hooks"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "./generated/prisma/client"

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
// owns the upstream pool, so spinning up a fresh client per request is cheap.

type RequestScope = {
  connectionString: string
  client: PrismaClient | null
  pending: Set<Promise<unknown>>
}

const als = new AsyncLocalStorage<RequestScope>()

function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })
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
  if (!scope.client) scope.client = createPrismaClient(scope.connectionString)
  return scope.client
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
    client: null,
    pending: new Set(),
  }
  return als.run(scope, async () => {
    try {
      return await fn()
    } finally {
      // Keep the client alive until all background work registered via
      // registerBackgroundWork() settles, then disconnect.
      const client = scope.client
      if (client || scope.pending.size > 0) {
        ctx.waitUntil(
          Promise.allSettled([...scope.pending]).then(() =>
            client?.$disconnect(),
          ),
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
    return Reflect.get(currentClient() as object, prop)
  },
})
