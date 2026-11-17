import { generateKeyPairSync } from "node:crypto"

import { describe, expect, it } from "vitest"

import { issueStatus, pemToPkcs8 } from "./github-app"

// GitHub App keys download as PKCS#1, which WebCrypto can't import; pin that
// the hand-written PKCS#8 wrapper yields a key that imports and signs.
describe("pemToPkcs8", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const pkcs1 = privateKey.export({ type: "pkcs1", format: "pem" }) as string
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" })

  const importAndSign = async (der: Uint8Array<ArrayBuffer>) => {
    const key = await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    )
    return crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new Uint8Array([1]))
  }

  it("wraps a PKCS#1 key into the same PKCS#8 bytes node emits", () => {
    expect(Buffer.from(pemToPkcs8(pkcs1))).toEqual(pkcs8)
  })

  it("accepts a key with literal \\n escapes and still signs", async () => {
    const escaped = pkcs1.trim().replace(/\n/g, "\\n")
    await expect(importAndSign(pemToPkcs8(escaped))).resolves.toBeTruthy()
  })

  it("passes a PKCS#8 PEM through", () => {
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string
    expect(Buffer.from(pemToPkcs8(pem))).toEqual(pkcs8)
  })
})

describe("issueStatus", () => {
  const issue = (
    state: "OPEN" | "CLOSED",
    stateReason: "COMPLETED" | "NOT_PLANNED" | "DUPLICATE" | "REOPENED" | null,
  ) => ({ state, stateReason, comments: { totalCount: 2 } })

  it("maps GitHub's state and close reason", () => {
    expect(issueStatus(issue("OPEN", "REOPENED"))).toEqual({
      state: "open",
      comments: 2,
    })
    expect(issueStatus(issue("CLOSED", "COMPLETED")).state).toBe("closed")
    expect(issueStatus(issue("CLOSED", null)).state).toBe("closed")
    expect(issueStatus(issue("CLOSED", "NOT_PLANNED")).state).toBe(
      "not_planned",
    )
    expect(issueStatus(issue("CLOSED", "DUPLICATE")).state).toBe("duplicate")
  })
})
