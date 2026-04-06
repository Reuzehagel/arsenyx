import { describe, it, expect } from "bun:test"

import { LRUCache } from "../lru-cache"

describe("LRUCache", () => {
  it("returns undefined for missing keys", () => {
    const cache = new LRUCache<string, string>(3)
    expect(cache.get("missing")).toBeUndefined()
  })

  it("stores and retrieves values", () => {
    const cache = new LRUCache<string, number>(3)
    cache.set("a", 1)
    cache.set("b", 2)
    expect(cache.get("a")).toBe(1)
    expect(cache.get("b")).toBe(2)
  })

  it("tracks size correctly", () => {
    const cache = new LRUCache<string, string>(5)
    expect(cache.size).toBe(0)
    cache.set("a", "1")
    expect(cache.size).toBe(1)
    cache.set("b", "2")
    expect(cache.size).toBe(2)
  })

  it("evicts the least-recently-used entry when capacity is exceeded", () => {
    const cache = new LRUCache<string, number>(3)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    // Cache is full (3/3). Adding "d" should evict "a" (oldest).
    cache.set("d", 4)

    expect(cache.size).toBe(3)
    expect(cache.get("a")).toBeUndefined()
    expect(cache.get("b")).toBe(2)
    expect(cache.get("c")).toBe(3)
    expect(cache.get("d")).toBe(4)
  })

  it("promotes accessed entries so they are not evicted", () => {
    const cache = new LRUCache<string, number>(3)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)

    // Access "a" to promote it to most-recently-used
    cache.get("a")

    // Adding "d" should evict "b" (now the oldest), not "a"
    cache.set("d", 4)

    expect(cache.get("a")).toBe(1)
    expect(cache.get("b")).toBeUndefined()
    expect(cache.get("c")).toBe(3)
    expect(cache.get("d")).toBe(4)
  })

  it("overwrites existing key without evicting other entries", () => {
    const cache = new LRUCache<string, number>(3)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)

    // Overwrite "a" — should NOT evict anything
    cache.set("a", 10)

    expect(cache.size).toBe(3)
    expect(cache.get("a")).toBe(10)
    expect(cache.get("b")).toBe(2)
    expect(cache.get("c")).toBe(3)
  })

  it("handles capacity of 1", () => {
    const cache = new LRUCache<string, string>(1)
    cache.set("a", "1")
    expect(cache.get("a")).toBe("1")

    cache.set("b", "2")
    expect(cache.size).toBe(1)
    expect(cache.get("a")).toBeUndefined()
    expect(cache.get("b")).toBe("2")
  })
})
