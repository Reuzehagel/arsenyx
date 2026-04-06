import { describe, it, expect } from "bun:test"

import {
  getCategoryConfig,
  getCategoryByWfcd,
  getDefaultCategory,
  isValidCategory,
  mapWfcdCategory,
  isWarframeCategory,
  isWeaponCategory,
  isGunCategory,
  isMeleeCategory,
  isCompanionCategory,
  isArchwingCategory,
  BROWSE_CATEGORIES,
} from "../categories"

// =============================================================================
// getCategoryConfig
// =============================================================================

describe("getCategoryConfig", () => {
  it("returns config for valid category", () => {
    const config = getCategoryConfig("warframes")
    expect(config?.id).toBe("warframes")
    expect(config?.label).toBe("Warframe")
  })

  it("returns config for every defined category", () => {
    for (const cat of BROWSE_CATEGORIES) {
      expect(getCategoryConfig(cat.id)).toBeDefined()
    }
  })
})

// =============================================================================
// getCategoryByWfcd
// =============================================================================

describe("getCategoryByWfcd", () => {
  it("maps Warframes to warframes config", () => {
    expect(getCategoryByWfcd("Warframes")?.id).toBe("warframes")
  })

  it("maps Primary to primary config", () => {
    expect(getCategoryByWfcd("Primary")?.id).toBe("primary")
  })

  it("maps Sentinels to companions config", () => {
    expect(getCategoryByWfcd("Sentinels")?.id).toBe("companions")
  })

  it("maps Pets to companions config", () => {
    expect(getCategoryByWfcd("Pets")?.id).toBe("companions")
  })

  it("returns undefined for unknown WFCD category", () => {
    expect(getCategoryByWfcd("NonExistent")).toBeUndefined()
  })
})

// =============================================================================
// getDefaultCategory
// =============================================================================

describe("getDefaultCategory", () => {
  it("returns warframes", () => {
    expect(getDefaultCategory()).toBe("warframes")
  })
})

// =============================================================================
// isValidCategory
// =============================================================================

describe("isValidCategory", () => {
  it("returns true for all defined categories", () => {
    for (const cat of BROWSE_CATEGORIES) {
      expect(isValidCategory(cat.id)).toBe(true)
    }
  })

  it("returns false for invalid strings", () => {
    expect(isValidCategory("not-a-category")).toBe(false)
    expect(isValidCategory("")).toBe(false)
    expect(isValidCategory("Warframes")).toBe(false) // case-sensitive
  })
})

// =============================================================================
// mapWfcdCategory
// =============================================================================

describe("mapWfcdCategory", () => {
  it("maps Warframes to warframes", () => {
    expect(mapWfcdCategory("Warframes")).toBe("warframes")
  })

  it("maps Warframes + Mech type to necramechs", () => {
    expect(mapWfcdCategory("Warframes", "Voidrig Mech")).toBe("necramechs")
    expect(mapWfcdCategory("Warframes", "Bonewidow Mech")).toBe("necramechs")
  })

  it("maps Warframes without Mech type to warframes", () => {
    expect(mapWfcdCategory("Warframes", "PowerSuit")).toBe("warframes")
    expect(mapWfcdCategory("Warframes", undefined)).toBe("warframes")
  })

  it("returns null for unknown WFCD category", () => {
    expect(mapWfcdCategory("UnknownCategory")).toBeNull()
  })
})

// =============================================================================
// Type guards
// =============================================================================

describe("isWarframeCategory", () => {
  it("returns true for warframes and necramechs", () => {
    expect(isWarframeCategory("warframes")).toBe(true)
    expect(isWarframeCategory("necramechs")).toBe(true)
  })

  it("returns false for weapons and other categories", () => {
    expect(isWarframeCategory("primary")).toBe(false)
    expect(isWarframeCategory("companions")).toBe(false)
    expect(isWarframeCategory("archwing")).toBe(false)
  })
})

describe("isWeaponCategory", () => {
  it("returns true for primary, secondary, melee", () => {
    expect(isWeaponCategory("primary")).toBe(true)
    expect(isWeaponCategory("secondary")).toBe(true)
    expect(isWeaponCategory("melee")).toBe(true)
  })

  it("returns false for non-weapon categories", () => {
    expect(isWeaponCategory("warframes")).toBe(false)
    expect(isWeaponCategory("companions")).toBe(false)
    expect(isWeaponCategory("companion-weapons")).toBe(false)
    expect(isWeaponCategory("exalted-weapons")).toBe(false)
  })
})

describe("isGunCategory", () => {
  it("returns true for primary and secondary", () => {
    expect(isGunCategory("primary")).toBe(true)
    expect(isGunCategory("secondary")).toBe(true)
  })

  it("returns false for melee", () => {
    expect(isGunCategory("melee")).toBe(false)
  })
})

describe("isMeleeCategory", () => {
  it("returns true for melee only", () => {
    expect(isMeleeCategory("melee")).toBe(true)
    expect(isMeleeCategory("primary")).toBe(false)
  })
})

describe("isCompanionCategory", () => {
  it("returns true for companions only", () => {
    expect(isCompanionCategory("companions")).toBe(true)
    expect(isCompanionCategory("companion-weapons")).toBe(false)
  })
})

describe("isArchwingCategory", () => {
  it("returns true for archwing only", () => {
    expect(isArchwingCategory("archwing")).toBe(true)
    expect(isArchwingCategory("warframes")).toBe(false)
  })
})
