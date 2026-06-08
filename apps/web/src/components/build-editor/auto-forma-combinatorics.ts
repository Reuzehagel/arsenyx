// Lazy permutation/combination generators — produce one tuple at a time so
// the caller can early-exit on a feasibility hit without materializing the
// whole space. (Materializing C(20, 8) = 125k tuples and discarding them
// after the first match was the source of an early hang.)

export function* permutationsOf<T>(arr: T[]): Generator<T[]> {
  if (arr.length === 0) {
    yield []
    return
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const sub of permutationsOf(rest)) {
      yield [arr[i], ...sub]
    }
  }
}

export function* combinationsOfK<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield []
    return
  }
  if (arr.length < k) return
  if (arr.length === k) {
    yield [...arr]
    return
  }
  const [head, ...tail] = arr
  for (const c of combinationsOfK(tail, k - 1)) yield [head, ...c]
  yield* combinationsOfK(tail, k)
}
