import pgCrypto from "pg/lib/crypto/utils"

// Every request opens a fresh pg connection, and SCRAM-SHA-256 auth runs
// PBKDF2 (4096 SHA-256 rounds) on each one: about a fifth of a cache miss's
// CPU. Its inputs — password, the role's salt, iterations — don't change
// between connections, so keep the salted password per isolate. pg's sasl.js
// calls `crypto.deriveKey` through the module object, so replacing the export
// is enough. Values, not promises, are cached: a promise settled in another
// request's context can't be awaited safely in Workers.
const derive = pgCrypto.deriveKey
const salted = new Map<string, ArrayBuffer>()

pgCrypto.deriveKey = async (password, salt, iterations) => {
  const key = `${iterations}:${btoa(String.fromCharCode(...salt))}:${password}`
  const hit = salted.get(key)
  if (hit) return hit
  const value = await derive(password, salt, iterations)
  // One role in practice; the cap only bounds a server that rotates salts.
  if (salted.size >= 8) salted.clear()
  salted.set(key, value)
  return value
}
