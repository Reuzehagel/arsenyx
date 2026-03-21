import { describe, it, expect } from "bun:test";
import {
  getShardImageUrl,
  getStatsForColor,
  findStat,
  getStatIndex,
  getStatByIndex,
  formatStatValue,
  getShardCssColor,
  getShardGlowColor,
  SHARD_COLORS,
  SHARD_COLOR_NAMES,
} from "../shards";

// =============================================================================
// getShardImageUrl() TESTS
// =============================================================================

describe("getShardImageUrl", () => {
  it("returns regular image URL", () => {
    const url = getShardImageUrl("crimson", false);
    expect(url).toContain("CrimsonArchonShard");
    expect(url).not.toContain("Tauforged");
  });

  it("returns tauforged image URL", () => {
    const url = getShardImageUrl("crimson", true);
    expect(url).toContain("TauforgedCrimsonArchonShard");
  });

  it("works for all shard colors", () => {
    for (const color of SHARD_COLORS) {
      expect(getShardImageUrl(color, false)).toBeTruthy();
      expect(getShardImageUrl(color, true)).toBeTruthy();
    }
  });
});

// =============================================================================
// getStatsForColor() TESTS
// =============================================================================

describe("getStatsForColor", () => {
  it("returns stats for crimson", () => {
    const stats = getStatsForColor("crimson");
    expect(stats.length).toBeGreaterThan(0);
    expect(stats[0].name).toBe("Melee Critical Damage");
  });

  it("returns stats for all colors", () => {
    for (const color of SHARD_COLORS) {
      const stats = getStatsForColor(color);
      expect(stats.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// findStat() TESTS
// =============================================================================

describe("findStat", () => {
  it("finds existing stat by name", () => {
    const stat = findStat("crimson", "Ability Strength");
    expect(stat).toBeDefined();
    expect(stat!.baseValue).toBe(10);
    expect(stat!.tauforgedValue).toBe(15);
  });

  it("returns undefined for non-existent stat", () => {
    expect(findStat("crimson", "Nonexistent Stat")).toBeUndefined();
  });
});

// =============================================================================
// getStatIndex() / getStatByIndex() ROUNDTRIP TESTS
// =============================================================================

describe("getStatIndex", () => {
  it("returns index for known stat", () => {
    expect(getStatIndex("crimson", "Ability Strength")).toBe(3);
  });

  it("returns 0 for unknown stat", () => {
    expect(getStatIndex("crimson", "Nonexistent")).toBe(0);
  });
});

describe("getStatByIndex", () => {
  it("returns stat name for valid index", () => {
    expect(getStatByIndex("crimson", 0)).toBe("Melee Critical Damage");
  });

  it("returns first stat for out-of-range index", () => {
    expect(getStatByIndex("crimson", 999)).toBe("Melee Critical Damage");
  });

  it("returns first stat for negative index", () => {
    expect(getStatByIndex("crimson", -1)).toBe("Melee Critical Damage");
  });
});

describe("stat index roundtrip", () => {
  it("roundtrips all crimson stats", () => {
    const stats = getStatsForColor("crimson");
    for (let i = 0; i < stats.length; i++) {
      const index = getStatIndex("crimson", stats[i].name);
      const name = getStatByIndex("crimson", index);
      expect(name).toBe(stats[i].name);
    }
  });
});

// =============================================================================
// formatStatValue() TESTS
// =============================================================================

describe("formatStatValue", () => {
  it("formats regular shard stat with unit", () => {
    const stat = { name: "Ability Strength", baseValue: 10, tauforgedValue: 15, unit: "%" };
    expect(formatStatValue(stat, false)).toBe("+10%");
  });

  it("formats tauforged shard stat", () => {
    const stat = { name: "Ability Strength", baseValue: 10, tauforgedValue: 15, unit: "%" };
    expect(formatStatValue(stat, true)).toBe("+15%");
  });

  it("formats stat with decimal value", () => {
    const stat = { name: "Melee Critical Damage", baseValue: 25, tauforgedValue: 37.5, unit: "%" };
    expect(formatStatValue(stat, true)).toBe("+37.5%");
  });

  it("formats stat without unit", () => {
    const stat = { name: "Health", baseValue: 150, tauforgedValue: 225, unit: "" };
    expect(formatStatValue(stat, false)).toBe("+150");
  });

  it("formats stat with complex unit", () => {
    const stat = { name: "Health Regen", baseValue: 5, tauforgedValue: 7.5, unit: "/s" };
    expect(formatStatValue(stat, false)).toBe("+5/s");
  });
});

// =============================================================================
// CSS COLOR TESTS
// =============================================================================

describe("getShardCssColor", () => {
  it("returns hex color for each shard color", () => {
    for (const color of SHARD_COLORS) {
      const css = getShardCssColor(color);
      expect(css).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("getShardGlowColor", () => {
  it("returns rgba color for each shard color", () => {
    for (const color of SHARD_COLORS) {
      const glow = getShardGlowColor(color);
      expect(glow).toMatch(/^rgba\(/);
    }
  });
});

// =============================================================================
// SHARD_COLOR_NAMES TESTS
// =============================================================================

describe("SHARD_COLOR_NAMES", () => {
  it("has a display name for every shard color", () => {
    for (const color of SHARD_COLORS) {
      expect(SHARD_COLOR_NAMES[color]).toBeTruthy();
    }
  });

  it("capitalizes color names", () => {
    expect(SHARD_COLOR_NAMES["crimson"]).toBe("Crimson");
    expect(SHARD_COLOR_NAMES["azure"]).toBe("Azure");
  });
});
