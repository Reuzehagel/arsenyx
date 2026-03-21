import { describe, it, expect } from "bun:test";
import { getHelminthAbilities, SUBSUMABLE_ABILITIES } from "../helminth";

// =============================================================================
// getHelminthAbilities() TESTS
// =============================================================================

describe("getHelminthAbilities", () => {
  it("returns a non-empty array", () => {
    const abilities = getHelminthAbilities();
    expect(abilities.length).toBeGreaterThan(10);
  });

  it("includes native Helminth abilities (source: Helminth)", () => {
    const abilities = getHelminthAbilities();
    const native = abilities.filter((a) => a.source === "Helminth");
    expect(native.length).toBeGreaterThan(0);
  });

  it("includes subsumable abilities from warframes", () => {
    const abilities = getHelminthAbilities();
    const roar = abilities.find((a) => a.name === "Roar");
    expect(roar).toBeDefined();
    expect(roar!.source).toBe("Rhino");
  });

  it("includes Eclipse from Mirage", () => {
    const abilities = getHelminthAbilities();
    const eclipse = abilities.find((a) => a.name === "Eclipse");
    expect(eclipse).toBeDefined();
    expect(eclipse!.source).toBe("Mirage");
  });

  it("has required fields on all abilities", () => {
    const abilities = getHelminthAbilities();
    for (const ability of abilities) {
      expect(ability.uniqueName).toBeTruthy();
      expect(ability.name).toBeTruthy();
      expect(ability.source).toBeTruthy();
    }
  });

  it("is sorted alphabetically by name", () => {
    const abilities = getHelminthAbilities();
    for (let i = 1; i < abilities.length; i++) {
      expect(abilities[i].name.localeCompare(abilities[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it("has no duplicate ability names from different sources", () => {
    const abilities = getHelminthAbilities();
    const nameCount = new Map<string, number>();
    for (const a of abilities) {
      nameCount.set(a.name, (nameCount.get(a.name) ?? 0) + 1);
    }
    for (const [name, count] of nameCount) {
      if (count > 1) {
        const sources = abilities.filter((a) => a.name === name).map((a) => a.source);
        const uniqueSources = new Set(sources);
        expect(uniqueSources.size).toBe(count);
      }
    }
  });
});

describe("SUBSUMABLE_ABILITIES", () => {
  it("maps warframe names to ability names", () => {
    expect(SUBSUMABLE_ABILITIES["Rhino"]).toBe("Roar");
    expect(SUBSUMABLE_ABILITIES["Mirage"]).toBe("Eclipse");
    expect(SUBSUMABLE_ABILITIES["Wisp"]).toBe("Breach Surge");
  });

  it("has more than 40 entries", () => {
    expect(Object.keys(SUBSUMABLE_ABILITIES).length).toBeGreaterThan(40);
  });
});
