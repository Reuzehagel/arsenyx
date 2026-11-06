/** True when the name already says "Prime", so a Prime tag would repeat it. */
export function isPrimeRedundant(name: string): boolean {
  return /\bprime\b/i.test(name)
}
