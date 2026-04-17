/**
 * Simple bounded LRU cache. Evicts least-recently-used entries when capacity is exceeded.
 * Drop-in replacement for Map where unbounded growth is a concern.
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>()
  private readonly max: number

  constructor(max: number) {
    this.max = max
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    // Move to end (most recently used)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.max) {
      // Evict oldest (first key)
      const oldest = this.map.keys().next().value!
      this.map.delete(oldest)
    }
    this.map.set(key, value)
  }

  get size(): number {
    return this.map.size
  }
}
