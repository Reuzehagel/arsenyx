// pg exports its crypto helpers (`./lib/*`) but ships no types for them.
declare module "pg/lib/crypto/utils" {
  const utils: {
    deriveKey(
      password: string,
      salt: Uint8Array,
      iterations: number,
    ): Promise<ArrayBuffer>
  }
  export default utils
}
