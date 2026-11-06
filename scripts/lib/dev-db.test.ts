import { describe, expect, it } from "bun:test"

import { isComposeDbUrl, pinHyperdriveIpv4 } from "./dev-db"

describe("isComposeDbUrl", () => {
  it("accepts only the compose container", () => {
    expect(isComposeDbUrl("postgresql://p:p@localhost:54320/a")).toBe(true)
    expect(isComposeDbUrl("postgresql://p:p@127.0.0.1:54320/a")).toBe(false)
    expect(isComposeDbUrl("postgresql://p:p@localhost:5432/a")).toBe(false)
    expect(isComposeDbUrl("postgresql://p:p@x.neon.tech/a")).toBe(false)
    expect(isComposeDbUrl(undefined)).toBe(false)
  })
})

describe("pinHyperdriveIpv4", () => {
  const db = 'DATABASE_URL="postgresql://p:p@localhost:54320/a"\n'
  const key = "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE"

  it("repoints only the Hyperdrive line, idempotently", () => {
    const env = `${db}${key}="postgresql://p:p@localhost:54320/a"\n`
    const pinned = pinHyperdriveIpv4(env)
    expect(pinned).toBe(`${db}${key}="postgresql://p:p@127.0.0.1:54320/a"\n`)
    expect(pinHyperdriveIpv4(pinned)).toBe(pinned)
  })

  it("leaves an env without the line alone", () => {
    expect(pinHyperdriveIpv4(db)).toBe(db)
  })
})
