/**
 * Thin promise wrapper around the `lzma` npm package.
 *
 * The package exposes a callback API (`decompress(bytes, onFinish, onProgress)`)
 * where `onFinish` receives `(result, error)` — note the unusual order — and
 * `result` may be either a `Uint8Array` (binary) or a `string` (auto-decoded
 * when the output is valid UTF-8 text). DE's PublicExport blobs are always
 * UTF-8 JSON text, so we expect strings, but we handle both for safety.
 *
 * Why this wrapper exists rather than just calling lzma directly: the package
 * ships no TypeScript types, has no `main`-field-clean ESM build, and forces
 * callers to bridge callbacks → promises every time. One place to fix.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — `lzma` ships no .d.ts; index.js exports { compress, decompress, LZMA }
import lzmaPkg from "lzma"

type DecompressResult = Uint8Array | string
type OnFinish = (result: DecompressResult, err?: Error | null) => void

interface LzmaModule {
  decompress(
    bytes: Uint8Array | number[],
    onFinish: OnFinish,
    onProgress?: (percent: number) => void,
  ): void
}

const lzma = lzmaPkg as unknown as LzmaModule

/** Decompress LZMA1 bytes. Throws on decode failure. Returns a string when
 *  the payload decodes as valid UTF-8 (the common case for DE's exports),
 *  otherwise the raw Uint8Array. */
export function lzmaDecompress(
  bytes: Uint8Array,
): Promise<DecompressResult> {
  return new Promise((resolve, reject) => {
    lzma.decompress(bytes, (result, err) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

/** Convenience: always return a string. Throws if the payload doesn't decode
 *  to UTF-8 text. */
export async function lzmaDecompressText(bytes: Uint8Array): Promise<string> {
  const result = await lzmaDecompress(bytes)
  if (typeof result === "string") return result
  return new TextDecoder("utf-8", { fatal: true }).decode(result)
}
