import { describe, it, expect } from "bun:test";
import {
  isAuraSelfAffecting,
  getAuraStats,
  getAuraMaxValue,
} from "../aura-effects";

// =============================================================================
// isAuraSelfAffecting() TESTS
// =============================================================================

describe("isAuraSelfAffecting", () => {
  it("returns true for Steel Charge", () => {
    expect(isAuraSelfAffecting("Steel Charge")).toBe(true);
  });

  it("returns true for Growing Power", () => {
    expect(isAuraSelfAffecting("Growing Power")).toBe(true);
  });

  it("returns true for Physique", () => {
    expect(isAuraSelfAffecting("Physique")).toBe(true);
  });

  it("returns false for Corrosive Projection (excluded)", () => {
    expect(isAuraSelfAffecting("Corrosive Projection")).toBe(false);
  });

  it("returns false for Energy Siphon (excluded)", () => {
    expect(isAuraSelfAffecting("Energy Siphon")).toBe(false);
  });

  it("returns false for unknown aura", () => {
    expect(isAuraSelfAffecting("Nonexistent Aura")).toBe(false);
  });
});

// =============================================================================
// getAuraStats() TESTS
// =============================================================================

describe("getAuraStats", () => {
  it("returns stats for Steel Charge at rank", () => {
    const stats = getAuraStats("Steel Charge", 5);
    expect(stats).toHaveLength(1);
    expect(stats[0].type).toBe("melee_damage");
    // perRank * (rank + 1) = 10 * 6 = 60
    expect(stats[0].value).toBe(60);
  });

  it("returns stats for Steel Charge at rank 0", () => {
    const stats = getAuraStats("Steel Charge", 0);
    expect(stats[0].value).toBe(10); // perRank * 1 = 10
  });

  it("returns empty array for unknown aura", () => {
    expect(getAuraStats("Nonexistent", 5)).toEqual([]);
  });

  it("returns empty array for excluded aura", () => {
    expect(getAuraStats("Corrosive Projection", 5)).toEqual([]);
  });
});

// =============================================================================
// getAuraMaxValue() TESTS
// =============================================================================

describe("getAuraMaxValue", () => {
  it("returns max value for Steel Charge melee_damage", () => {
    expect(getAuraMaxValue("Steel Charge", "melee_damage")).toBe(60);
  });

  it("returns max value for Physique health", () => {
    expect(getAuraMaxValue("Physique", "health")).toBe(20);
  });

  it("returns undefined for wrong stat type", () => {
    expect(getAuraMaxValue("Steel Charge", "health")).toBeUndefined();
  });

  it("returns undefined for unknown aura", () => {
    expect(getAuraMaxValue("Nonexistent", "health")).toBeUndefined();
  });
});
