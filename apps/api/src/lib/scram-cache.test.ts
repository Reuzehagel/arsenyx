import pgCrypto from "pg/lib/crypto/utils"
import { describe, expect, it } from "vitest"

import "./scram-cache"

describe("scram-cache", () => {
  const salt = new Uint8Array([1, 2, 3, 4])

  it("returns the same salted password for the same inputs", async () => {
    const a = await pgCrypto.deriveKey("pw", salt, 4096)
    const b = await pgCrypto.deriveKey("pw", salt, 4096)
    expect(b).toBe(a)
  })

  it("derives separately when the password, salt or iterations differ", async () => {
    const a = await pgCrypto.deriveKey("pw", salt, 4096)
    const others = await Promise.all([
      pgCrypto.deriveKey("pw2", salt, 4096),
      pgCrypto.deriveKey("pw", new Uint8Array([9, 9]), 4096),
      pgCrypto.deriveKey("pw", salt, 4097),
    ])
    for (const o of others) {
      expect(o).not.toBe(a)
      expect(Buffer.from(o).equals(Buffer.from(a))).toBe(false)
    }
  })
})
