import { AsyncLocalStorage } from "node:async_hooks"

import { PrismaNeon } from "@prisma/adapter-neon"

import { PrismaClient } from "./generated/prisma/client"

// Workers reuses isolates across requests, and the Neon driver's Pool is
// request-scoped. A module-level PrismaClient singleton leaks I/O across
// requests → `Cannot perform I/O on behalf of a different request`. We scope
// one client per request via AsyncLocalStorage; routes keep using the
// `prisma` proxy unchanged.

type RequestScope = {
  client: PrismaClient
  pending: Set<Promise<unknown>>
}

const als = new AsyncLocalStorage<RequestScope>()

function createPrismaClient() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  })
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

export function withPrisma<T>(
  ctx: ExecutionContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  const scope: RequestScope = {
    client: createPrismaClient(),
    pending: new Set(),
  }
  return als.run(scope, async () => {
    try {
      return await fn()
    } finally {
      // Keep the client alive until all background work registered via
      // registerBackgroundWork() settles, then disconnect.
      ctx.waitUntil(
        Promise.allSettled([...scope.pending]).then(() =>
          scope.client.$disconnect(),
        ),
      )
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
    return Reflect.get(currentScope().client as object, prop)
  },
})
