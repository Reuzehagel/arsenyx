/**
 * Mods the wiki flags `Conclave = true` but which are actually usable in PvE,
 * so they must NOT be hidden behind the picker's Conclave (PvP) toggle.
 *
 * The wiki's `Conclave` boolean means "usable in Conclave", NOT "PvP-exclusive".
 * Most Conclave-flagged mods (≈129) live under `/PvPMods/` and are genuinely
 * PvP-only, but a handful of Warframe ability augments + the two weapon zoom
 * mods are usable in BOTH PvE and Conclave (the wiki lead says "usable in both
 * PvE and Conclave" / "is a PvE and Conclave Warframe Augment"). Nothing in the
 * DE export or the wiki Lua module distinguishes these from the Conclave-only
 * augments — the records are byte-identical — so this allowlist is curated from
 * each mod's wiki page. See merge step in scripts/build-items-index.ts.
 *
 * Keyed by uniqueName (= wiki InternalName), which is stable across renames.
 * Verified against wiki.warframe.com, 2026-06-01.
 *
 * KNOWN TRADEOFF: the build emits these with `isConclave = false`, which makes
 * them visible in the picker's PvE view (the goal) but hides them from the
 * Conclave view — even though they're legal in both. `isConclave` is a single
 * boolean, so it can't express "both"; PvE is the planner's primary mode, so we
 * optimize for that. To show them in both views, add a `pveUsable` flag to the
 * mod data (keep `isConclave = true`) and change the picker's PvE filter to
 * hide `isConclave && !pveUsable` instead. Not done — Conclave is niche here.
 */
export const PVE_USABLE_CONCLAVE_MODS: ReadonlySet<string> = new Set([
  // Weapon zoom mods — standard Exilus zoom, usable in PvE.
  "/Lotus/Upgrades/Mods/Rifle/WeaponZoomFovMod", // Eagle Eye
  "/Lotus/Upgrades/Mods/Pistol/WeaponPistolZoomFovMod", // Hawk Eye
  // Warframe ability augments usable in both PvE and Conclave.
  "/Lotus/Powersuits/Volt/ShieldPvPAugmentCard", // Recharge Barrier (Volt)
  "/Lotus/Powersuits/Rhino/IronSkinAugmentCard", // Iron Shrapnel (Rhino)
  "/Lotus/Powersuits/Ranger/RangerQuiverPvPAugmentCard", // Power of Three (Ivara)
  "/Lotus/Powersuits/Loki/DecoyPvPAugmentCard", // Deceptive Bond (Loki)
  // Singularity is Nyx's Absorb augment (compatName "Nyx"), but DE files it
  // under the /Jade/ powersuit folder — the path is correct, don't "fix" it.
  "/Lotus/Powersuits/Jade/SelfBulletAttractorPvPAugmentCard", // Singularity (Nyx)
  "/Lotus/Powersuits/Harlequin/PrismPvPAugmentCard", // Prism Guard (Mirage)
  "/Lotus/Powersuits/Frost/IceSpikeAugmentCard", // Ice Wave Impedance (Frost)
  "/Lotus/Powersuits/Excalibur/SlashDashPvPAugmentCard", // Purging Slash (Excalibur)
  "/Lotus/Powersuits/Ember/FireBlastPvPAugmentCard", // Purifying Flames (Ember)
  "/Lotus/Powersuits/Dragon/DragonBreathAugmentCard", // Afterburn (Chroma)
  "/Lotus/Powersuits/Cowgirl/GunFuPvPAugmentCard", // Mesa's Waltz (Mesa)
  "/Lotus/Powersuits/Brawler/BrawlerSummonPvPAugmentCard", // Rumbled (Atlas)
  // Mis-flagged: PvE-only augment with no Conclave variant — the wiki's
  // Conclave flag is simply wrong here, so it must show in PvE too.
  "/Lotus/Powersuits/Dragon/DragonScalesAugmentCard", // Vexing Retaliation (Chroma)
])
