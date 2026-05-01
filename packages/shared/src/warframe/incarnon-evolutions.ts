// Auto-stable: full incarnon evolution trees. This file is large (~70KB) and
// is imported only by the build pipeline (scripts/build-items-index.ts), which
// emits it as apps/web/public/data/incarnon-evolutions.json for lazy fetch by
// the editor sidebar. The web bundle never imports this directly — keep it
// that way to preserve tree-shaking.

export interface IncarnonPerk {
  name: string
  description: string
}

export interface IncarnonTier {
  tier: 1 | 2 | 3 | 4 | 5
  perks: IncarnonPerk[]
}

export interface IncarnonEvolution {
  source: string
  /**
   * Genesis adapter icon (Steel Path Circuit weapons only). Innate incarnons
   * come incarnon by default — no separate adapter image — so this is omitted.
   */
  genesisImage?: string
  tiers: IncarnonTier[]
}

export const INCARNON_EVOLUTIONS: Record<string, IncarnonEvolution> = {
  // ─── INNATE ZARIMAN INCARNONS ───────────────────────────────────────────────

  Felarx: {
    source: "Innate (Zariman — Son Token vendor)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into semi-auto dual pistols firing large energy projectiles with 3.0x crit multiplier, Impact + Radiation damage.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Attuned Accuracy",
            description: "+40% Accuracy while aiming.",
          },
          {
            name: "Kinetic Baffle",
            description: "-50% Weapon Recoil while aiming.",
          },
          {
            name: "Frictionless Flight",
            description: "+50% Projectile Speed while aiming.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Dual-Mode Chamber",
            description:
              "Reload toggles between +100% Projectile Speed and +4m Punch Through.",
          },
          {
            name: "Evolved Autoloader",
            description: "+50% Magazine Reloaded/s when holstered.",
          },
          {
            name: "Mounting Momentum",
            description:
              "Each reload increases Fire Rate by +10% per shell. Resets on next reload.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Brutal Edge",
            description: "+10% Critical Chance, +10% Status Chance.",
          },
          {
            name: "Incarnon Catalyst",
            description:
              "Headshots build +50% more Incarnon Transmutation charge (requires 20 headshots instead of 40).",
          },
          {
            name: "Racking Wrath",
            description: "+20% Status Chance, -10% Critical Chance.",
          },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Devastating Attrition",
            description:
              "50% chance to deal +2000% Damage on non-critical hits.",
          },
          {
            name: "Ruptured Plentitude",
            description:
              "On punch through 3 enemies: +70% Ammo Efficiency for 20s.",
          },
          {
            name: "Agile Executor",
            description: "50% Ammo Efficiency while aim-gliding and sliding.",
          },
        ],
      },
    ],
  },

  Phenmor: {
    source: "Innate (Zariman — Son Token vendor)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Switching back expends remaining charge.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Void's Guidance",
            description: "+50% Accuracy and -50% Recoil while aiming.",
          },
          { name: "Rapid Wrath", description: "+20% Fire Rate." },
          { name: "Swift Deliverance", description: "+80% Projectile Speed." },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Retribution's Vessel",
            description: "+50% Magazine Capacity.",
          },
          {
            name: "Ready Retaliation",
            description:
              "On Reload From Empty: +100% Reload Speed for 6 seconds.",
          },
          {
            name: "Executioner's Fortune",
            description: "On Headshot Kill: 20% chance to Instant Reload.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Survivor's Edge",
            description: "+10% Critical Chance, +10% Status Chance.",
          },
          {
            name: "Incarnon Efficiency",
            description:
              "Headshots build +50% more Incarnon Transmutation charge (reduces full charge to 8 hits).",
          },
          {
            name: "Elemental Excess",
            description: "+20% Status Chance, -10% Critical Chance.",
          },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Devouring Attrition",
            description:
              "50% chance to deal +2000% Damage on non-critical hits.",
          },
          {
            name: "Spiteful Defilement",
            description:
              "Enemies with fewer than 3 status effects receive +100% Critical Damage.",
          },
          {
            name: "Lingering Judgement",
            description:
              "On 2 headshots within 2 seconds: +50% Headshot Damage for 8 seconds.",
          },
        ],
      },
    ],
  },

  Laetum: {
    source: "Innate (Zariman — Son Token vendor)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Switching back expends remaining charge.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          { name: "Marksman's Hand", description: "-40% Weapon Recoil." },
          { name: "Rapid Wrath", description: "+20% Fire Rate." },
          {
            name: "Raptor's Chase",
            description: "+50% Movement Speed while aiming.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Lethal Rearmament",
            description:
              "On Headshot: +30% Reload Speed for 12s, stacking up to 3x.",
          },
          {
            name: "Awakened Readiness",
            description: "+30% Magazine Reloaded/s while holstered.",
          },
          {
            name: "Feather of Justice",
            description: "+60% Ammo Efficiency during aim-gliding or sliding.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          { name: "Caput Mortuum", description: "+50% Headshot Damage." },
          {
            name: "Incarnon Efficiency",
            description:
              "Headshots build +50% more Incarnon Transmutation charge.",
          },
          {
            name: "Elemental Excess",
            description: "+20% Status Chance, -10% Critical Chance.",
          },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Devouring Attrition",
            description:
              "50% chance to deal +2000% Damage on non-critical hits.",
          },
          {
            name: "Reaper's Plenty",
            description: "On Headshot: +40% Ammo Efficiency for 6 seconds.",
          },
          {
            name: "Overwhelming Attrition",
            description:
              "Non-critical, non-status hits grant +400% Damage for 10s, stacking up to 3x.",
          },
        ],
      },
    ],
  },

  Innodem: {
    source: "Innate (Zariman — Son Token vendor)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Reach 5x Combo and Heavy Attack to activate. +3 Range and +40% Attack Speed when active.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          { name: "Orokin Reach", description: "+0.5 Range." },
          { name: "Bladed Harmony", description: "+25% Attack Speed." },
          { name: "Striking Swiftness", description: "+30% Sprint Speed." },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Hawk Momentum",
            description: "Gain 5 Combo for every 10m of continuous slide.",
          },
          {
            name: "Skyborne Hunter",
            description: "+0.5m Range on aerial melee attacks.",
          },
          { name: "Blade Twister", description: "+60% Finisher Damage." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Incarnon Imago",
            description:
              "Reach 3x Combo and Heavy Attack to activate Incarnon Form (instead of 5x).",
          },
          {
            name: "Swooping Lunge",
            description:
              "On Airborne Melee Kill: +50% Melee Damage for 10s, stacking up to 3x.",
          },
          {
            name: "Protracted Execution",
            description: "+20 Combo on Finisher.",
          },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Blood Anointed",
            description: "On Finisher: +40% Heavy Attack Efficiency for 40s.",
          },
          {
            name: "Stunning Brutality",
            description: "On Finisher: stun aware enemies in a 10m radius.",
          },
          {
            name: "Armed Inspiration",
            description: "Collecting ammo grants 5 Melee Combo counter.",
          },
        ],
      },
    ],
  },

  Praedos: {
    source: "Innate (Zariman — Son Token vendor)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Reach 5x Combo and Heavy Attack to activate. +3 Range and +40% Attack Speed when active.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          { name: "Seismic Slam", description: "+50% Slam Radius." },
          { name: "Whirling Flurry", description: "+20% Attack Speed." },
          {
            name: "Drifting Grace",
            description: "+20% Sprint Speed and +20% Slide.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Shockwave Synergy",
            description:
              "For each enemy hit by Slam radius, gain 4 Combo Count.",
          },
          { name: "Reaching Lunge", description: "+1.5m Slide Attack Range." },
          { name: "Adept Reflexes", description: "+20 Initial Combo." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Swift Transmute",
            description:
              "Reach 3x Combo and Heavy Attack to activate Incarnon Form (instead of 5x).",
          },
          { name: "Evolved Ascension", description: "+30% Parkour Velocity." },
          { name: "Vaulting Leap", description: "+100% Double Jump strength." },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Transfigured Momentum",
            description: "On Slide Kill: +50% Heavy Attack Efficiency for 30s.",
          },
          {
            name: "Kinetic Harmony",
            description: "+100% Heavy Attack Wind Up Speed.",
          },
          {
            name: "Universal Readiness",
            description: "Collecting ammo grants 5 Melee Combo counter.",
          },
        ],
      },
    ],
  },

  // ─── INNATE SANCTUM ANATOMICA INCARNONS ────────────────────────────────────

  Onos: {
    source: "Innate (Sanctum Anatomica — Cavia Standing vendor)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Switching back expends remaining charge.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          { name: "Marksman's Hand", description: "-30% Weapon Recoil." },
          { name: "Rapid Wrath", description: "+25% Fire Rate." },
          { name: "Swift Deliverance", description: "+50% Projectile Speed." },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Extended Volley",
            description: "+10 Magazine Capacity (untransformed only).",
          },
          { name: "Rapid Reinforcement", description: "+30% Reload Speed." },
          {
            name: "Hunter's Rearmament",
            description:
              "On Kill: 10% chance to replenish 10 Ammo (untransformed only).",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Lethal Lance",
            description: "On Kill: +2.5 Punch Through for 20s.",
          },
          {
            name: "Incarnon Efficiency",
            description:
              "Headshots build +50% more Incarnon Transmutation charge.",
          },
          {
            name: "Elemental Excess",
            description: "+20% Status Chance, -10% Critical Chance.",
          },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Sequential Skullbuster",
            description:
              "On Consecutive Weakpoint Hits: +30% Headshot Damage, stacking up to 4x.",
          },
          {
            name: "Impaler's Ferocity",
            description: "On Punch Through Hit: +200% Damage for 10s.",
          },
          {
            name: "Devastation Cascade",
            description:
              "Hitting enemies in Incarnon Form increases Critical Chance and Critical Damage of fully charged blast by +5%, stacking up to 50 times.",
          },
        ],
      },
    ],
  },

  Ruvox: {
    source: "Innate (Sanctum Anatomica — Cavia Standing vendor)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Reach 6x Combo and Heavy Attack to activate. Heavy Slam attacks impale enemies within 8m on Void spikes. +3 Range, -35% Max Melee Attack Speed, +100% Impact Damage converted to Puncture.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          { name: "Orokin Reach", description: "+1 Range." },
          {
            name: "Lethal Impetus",
            description:
              "On Kill: +15% Attack Speed for 15s, stacking up to 3x.",
          },
          {
            name: "Gathering Momentum",
            description: "+5% Movement Speed per Melee Combo Multiplier.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Shockwave Synergy",
            description:
              "For each enemy hit by Slam radius, gain 4 Combo Count.",
          },
          { name: "Seismic Slam", description: "+60% Slam Radius." },
          { name: "Adept Reflexes", description: "+20 Initial Combo." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Swift Transmute",
            description:
              "Reach 3x Combo and Heavy Attack to activate Incarnon Form (instead of 6x).",
          },
          { name: "Ternary Vault", description: "+1 Mid-air Jump." },
          {
            name: "Inspiring Execution",
            description: "+30% Combo Count Chance on Finishers for 20s.",
          },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Brutal Efficiency",
            description:
              "+40% Heavy Attack Efficiency for 20s when impaling 5 or more enemies.",
          },
          {
            name: "Vulnerability Serum",
            description:
              "Impaled enemies are 35% more vulnerable to Status Chance effects.",
          },
          {
            name: "Permanent Perforation",
            description: "Enemies suffer 5 Puncture Status while impaled.",
          },
        ],
      },
    ],
  },

  // ─── INNATE ISLEWEAVER INCARNON ────────────────────────────────────────────

  Thalys: {
    source: "Innate (Isleweaver — Update 39.0, 2025)",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Kill 100 enemies to unlock. Reach 6x Combo and Heavy Attack to activate. +3 Range and +40% Attack Speed. Attacks embed damaging shards in enemies.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Dreadful Reach",
            description:
              "On weapon Status Effect: +0.1 Range for 8s, stacking up to 20x.",
          },
          { name: "Whirling Flurry", description: "+20% Attack Speed." },
          {
            name: "Raging Drift",
            description: "+80% Attack Speed while sliding and +20% Slide.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Nimble Scythe",
            description:
              "For each enemy hit by Slide Attack, gain +5 Combo Count.",
          },
          {
            name: "Echoes of Rage",
            description: "+1 Combo Count on Shard Damage.",
          },
          { name: "Adept Reflexes", description: "+20 Initial Combo." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Swift Transmute",
            description:
              "Reach 3x Combo and Heavy Attack to activate Incarnon Form (instead of 6x).",
          },
          {
            name: "Vaulting Leap",
            description: "+100% Jump and Double Jump Height.",
          },
          {
            name: "Devastating Mercy",
            description: "Ground Finishers knock enemies down in a 6m radius.",
          },
        ],
      },
      {
        tier: 5,
        perks: [
          {
            name: "Explosive Growth",
            description:
              "Shards grow up to 3 stages; fully grown shards deal 2x damage and impale stuns targets for 5 seconds.",
          },
          {
            name: "Chain Shatter",
            description:
              "Heavy Attacks detonate shards, dealing 200% of Thalys's base damage with chain detonation.",
          },
          {
            name: "Void Splinters",
            description:
              "Shard duration increases to 30s; shards gain +100% Critical Chance; shard damage reduced by -50%.",
          },
        ],
      },
    ],
  },

  // ─── INCARNON GENESIS — PRIMARIES ──────────────────────────────────────────

  Boar: {
    source: "Steel Path Circuit",
    genesisImage: "BoarIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into 3 short-range chaining beams that auto-target enemies within 10° of the reticle.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Reified Bane",
            description:
              "+10 Base Damage. On Reload From Empty: +14 Base Damage.",
          },
          {
            name: "Fortress Salvo",
            description:
              "+16 Base Damage. With Armor over 450: +4 Punch Through.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Ready Retaliation",
            description: "On Reload From Empty: +100% Reload Speed.",
          },
          {
            name: "Mercenary Chamber",
            description: "Increase Base Ammo Capacity to 195.",
          },
          { name: "Practiced Grip", description: "+50% Accuracy." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Elemental Balance",
            description:
              "+12% Base Status Chance per projectile; +96% Base Status Chance for Incarnon Form.",
          },
          {
            name: "Critical Parallel",
            description:
              "+20% Base Critical Chance, +0.5x Base Critical Damage Multiplier.",
          },
          {
            name: "Survivor's Edge",
            description:
              "+10% Base Critical Chance; +6% Base Status Chance per projectile / +48% for Incarnon Form.",
          },
        ],
      },
    ],
  },

  Boltor: {
    source: "Steel Path Circuit",
    genesisImage: "BoltorIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Form prioritizes Slash Damage and gains 3 base Multishot.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Hunter's Mantra",
            description:
              "+18 Base Damage (Boltor). With Channeled Ability active: +4 Punch Through and +40% Accuracy.",
          },
          {
            name: "Crimson Overture",
            description:
              "+12 Base Damage (Boltor). On Kill: +2 Damage and +20% Ammo Efficiency for 5s, stacking up to 4x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Swift Deliverance", description: "+60% Projectile Speed." },
          {
            name: "Extended Volley",
            description: "+20 Base Magazine Capacity.",
          },
          { name: "Rapid Reinforcement", description: "+60% Reload Speed." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Elemental Balance",
            description: "+20% Base Status Chance.",
          },
          {
            name: "Survivor's Edge",
            description: "+8% Base Critical Chance, +8% Base Status Chance.",
          },
          {
            name: "Commodore's Fortune",
            description: "+12% Base Critical Chance.",
          },
        ],
      },
    ],
  },

  Braton: {
    source: "Steel Path Circuit",
    genesisImage: "BratonIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Each shot in Incarnon Form gains Radial Heat damage.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Daring Reverie",
            description:
              "+24 Base Damage (Braton). With Channeled Ability active: +30 additional Damage and +50% Ammo Efficiency.",
          },
          {
            name: "Munitions Grit",
            description:
              "+24 Base Damage (Braton). Multishot consumes ammo from Capacity and increases Damage by +60% with +20% Multishot bonus.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Mercenary Chamber",
            description: "Increases Base Ammo Capacity (variant-dependent).",
          },
          {
            name: "Void's Guidance",
            description: "+60% Accuracy and -60% Weapon Recoil.",
          },
          {
            name: "Gunsmoke Pick Up",
            description:
              "On Punch Through Hit: 20% chance to restore 10% Ammo.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Critical Parallel",
            description:
              "+16% Base Critical Chance (Braton), +0.4x Base Critical Damage Multiplier.",
          },
          {
            name: "Prelude of Might",
            description:
              "With Critical Chance below 50%: significantly increases Base Critical Damage Multiplier.",
          },
          {
            name: "Survivor's Edge",
            description: "+8% Base Critical Chance, +8% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Burston: {
    source: "Steel Path Circuit",
    genesisImage: "BurstonIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Forceful Finality",
            description:
              "+42 Base Damage. +5 Base Multishot on final magazine burst.",
          },
          {
            name: "Fortress Salvo",
            description:
              "+42 Base Damage. With Armor over 450: +2 Punch Through.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Extended Volley",
            description: "+21 Base Magazine Capacity.",
          },
          {
            name: "Ready Retaliation",
            description: "On Reload From Empty: +100% Reload Speed.",
          },
          { name: "Kinetic Battle", description: "-50% Weapon Recoil." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Reaver's Rapture",
            description:
              "On Full Burst Hit: +20% Damage, resets on Reload. Stacks up to 5x for +100%.",
          },
          { name: "Absolute Valor", description: "+22% Base Critical Chance." },
          {
            name: "Fatal Affliction",
            description:
              "+40% Direct Damage per Status Type affecting the target.",
          },
        ],
      },
    ],
  },

  Dera: {
    source: "Steel Path Circuit",
    genesisImage: "DeraIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into high-power Magnetic damage beams.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Crimson Overture",
            description:
              "+8 Base Damage (Dera). On Kill: +20% Ammo Efficiency for 5s, stacking up to 4x.",
          },
          {
            name: "Paragon Essence",
            description:
              "+6 Base Damage (Dera). On inflicting Status Effect: +5% Fire Rate for 5s, stacking up to 6x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Swift Deliverance", description: "+50% Projectile Speed." },
          {
            name: "Extended Volley",
            description: "+22 Base Magazine Capacity (Dera).",
          },
          {
            name: "Evolved Autoloader",
            description: "+50% Magazine Reloaded/s when holstered.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Deathtrap Trigger",
            description:
              "+14% Base Critical Chance (Dera), +0.6x Critical Damage Multiplier.",
          },
          {
            name: "High Ground",
            description:
              "+25% Base Critical Chance based on current Status Chance, up to +35%.",
          },
          {
            name: "Elemental Balance",
            description: "+18% Base Status Chance (Dera).",
          },
        ],
      },
    ],
  },

  Dread: {
    source: "Steel Path Circuit",
    genesisImage: "DreadIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Incarnon Form sacrifices silence for increased projectile size, Heat Damage, infinite body punch through, and increased critical multiplier.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Hitman's Opportunity",
            description:
              "+70 Base Damage. +100% Damage if enemy has less than half Health.",
          },
          {
            name: "Stalker's Resentment",
            description:
              "+50 Base Damage. With Hate and Despair equipped: hits increase Base Damage by +10 and Fire Rate by 10%, stacking up to 5x. Resets on missed shot.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Swift Deliverance", description: "+30% Projectile Speed." },
          { name: "Marksman's Focus", description: "-30% Zoom." },
          {
            name: "Hitman's Hoard",
            description: "Increase Ammo Capacity to 144.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Survivor's Edge",
            description: "+10% Base Critical Chance, +10% Base Status Chance.",
          },
          {
            name: "Elemental Balance",
            description: "+24% Base Status Chance.",
          },
          { name: "Zeroed In", description: "+1x Critical Damage Multiplier." },
        ],
      },
    ],
  },

  Gorgon: {
    source: "Steel Path Circuit",
    genesisImage: "GorgonIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into a weapon that fires embedding projectiles that explode with Heat Damage.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Hunter's Mantra",
            description:
              "+10 Base Damage (Gorgon). With Channeled Ability active: +3 Punch Through and +40% Accuracy.",
          },
          {
            name: "Hoplite's Virtue",
            description:
              "+10 Base Damage (Gorgon). On Shield Break: +13 Damage for 8s.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Resonant Restore",
            description:
              "On Reload From Empty: +15 Base Magazine Capacity, stacking up to 3x.",
          },
          { name: "Rapid Reinforcement", description: "+50% Reload Speed." },
          { name: "Void's Guidance", description: "-50% Weapon Recoil." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Survivor's Edge",
            description: "+8% Base Critical Chance, +9% Base Status Chance.",
          },
          {
            name: "Elemental Balance",
            description: "+16% Base Status Chance.",
          },
          { name: "Absolute Valor", description: "+14% Base Critical Chance." },
        ],
      },
    ],
  },

  Latron: {
    source: "Steel Path Circuit",
    genesisImage: "LatronIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Riddled Target",
            description:
              "+48 Base Damage (Latron). +25% Multishot for 8s on Puncture Status Effect, stacking up to 4x.",
          },
          {
            name: "Evasive Shot",
            description:
              "+48 Base Damage (Latron). +30% Direct Damage per Status Type affecting the target with Sprint Speed 1.2 or higher.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Marksman's Hand", description: "-60% Weapon Recoil." },
          {
            name: "Extended Volley",
            description: "+15 Base Magazine Capacity.",
          },
          { name: "Marksman's Focus", description: "-30% Zoom." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Flensing Spikes",
            description:
              "Remove 20% of enemy Armor per Puncture Status effect.",
          },
          { name: "Headhunter", description: "+100% Headshot Damage." },
          {
            name: "Critical Parallel",
            description:
              "+30% Base Critical Chance (Latron), +0.6x Critical Damage Multiplier.",
          },
        ],
      },
    ],
  },

  Miter: {
    source: "Steel Path Circuit",
    genesisImage: "MiterIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Swift Sawblades",
            description:
              "+77 Base Damage. With Channeled Ability active: +70% Fire Rate.",
          },
          {
            name: "Plentiful Mayhem",
            description:
              "+57 Base Damage. Multishot consumes ammo from Capacity and increases Damage by +20.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Swift Deliverance", description: "+50% Projectile Speed." },
          {
            name: "Ready Retaliation",
            description: "On Reload From Empty: +100% Reload Speed.",
          },
          {
            name: "Mercenary Chamber",
            description: "Increase Ammo Capacity to 160.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Sawblade Storm",
            description:
              "Hold charged shot for 1s to increase area of effect; fully charged produces 1400 Blast in a 5m AoE.",
          },
          {
            name: "Commodore's Fortune",
            description: "+22% Base Critical Chance.",
          },
          {
            name: "Critical Parallel",
            description: "+12% Base Critical Chance, +12% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Paris: {
    source: "Steel Path Circuit",
    genesisImage: "ParisIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Deadly Pace",
            description:
              "+40 Base Damage (Paris). +80% Fire Rate with Sprint Speed 1.2 or higher.",
          },
          {
            name: "Guardian's Might",
            description:
              "+40 Base Damage (Paris). With Overshields: +52 additional Base Damage.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Ardent Trigger",
            description: "On Punch Through Hit: +40% Fire Rate for 6s.",
          },
          { name: "Marksman's Focus", description: "-30% Zoom." },
          { name: "Swift Deliverance", description: "+60% Projectile Speed." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Vicious Promise",
            description:
              "+40% Base Critical Chance on undamaged enemies, +2x Base Critical Damage Multiplier.",
          },
          {
            name: "Elemental Balance",
            description: "+60% Base Status Chance.",
          },
          {
            name: "Striking Succession",
            description: "On Hit: +15 Base Damage for 3s, stacking up to 4x.",
          },
        ],
      },
    ],
  },

  Soma: {
    source: "Steel Path Circuit",
    genesisImage: "SomaIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Fortress Salvo",
            description:
              "+12 Base Damage per pellet. With Armor over 450: +4 Punch Through.",
          },
          {
            name: "Fortifying Bloodshed",
            description:
              "+10 Base Damage per pellet. On Bleed Kill: +100 Overshield.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Kinetic Battle", description: "-50% Weapon Recoil." },
          { name: "Practiced Grip", description: "+50% Accuracy." },
          { name: "Rapid Reinforcement", description: "+50% Reload Speed." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Fresh Havoc",
            description:
              "On Reload From Empty: +6 Base Damage, stacking up to 2x (max +12 per pellet).",
          },
          {
            name: "Fatal Affliction",
            description:
              "+40% Direct Damage per Status Type affecting the target.",
          },
          {
            name: "Zeroed In",
            description: "+0.6x Critical Damage Multiplier.",
          },
        ],
      },
    ],
  },

  Strun: {
    source: "Steel Path Circuit",
    genesisImage: "StrunIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into staggering explosive projectiles with 4m AoE dealing primarily Blast damage.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Tenno Targeting",
            description:
              "+54 Base Damage (Strun). With Channeled Ability active: +4 Punch Through.",
          },
          {
            name: "Blazing Barrel",
            description:
              "+54 Base Damage (Strun). On Firing: +0.05 Base Multishot, stacking up to 5x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Rapid Reinforcement", description: "+60% Reload Speed." },
          {
            name: "Galvanic Reload",
            description:
              "On hitting a target affected by Electricity status: 40% chance to restore 1 round in magazine.",
          },
          { name: "Swift Deliverance", description: "+30% Projectile Speed." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Elemental Balance",
            description: "+11% Base Status Chance; +132% in Incarnon Form.",
          },
          {
            name: "Commodore's Fortune",
            description: "+16% Base Critical Chance.",
          },
          {
            name: "Brutal Edge",
            description:
              "+4% Base Critical Chance; +4% Base Status Chance; +48% Base Status Chance in Incarnon Form.",
          },
        ],
      },
    ],
  },

  Sybaris: {
    source: "Steel Path Circuit",
    genesisImage: "SybarisIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into 4-round bursts with Blast Status, increased damage, crit multiplier, and status chance.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Well Rehearsed",
            description:
              "+20 Base Damage (Sybaris). On Consecutive Weakpoint Hits: +5 Base Damage, stacking up to 3x.",
          },
          {
            name: "Blazing Barrel",
            description:
              "+20 Base Damage (Sybaris). On Firing: +5% Multishot, stacking up to 10x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Extended Volley",
            description: "+8 Base Magazine Capacity (Sybaris).",
          },
          {
            name: "Ready Retaliation",
            description: "On Reload From Empty: +60% Reload Speed.",
          },
          { name: "Marksman's Hand", description: "-60% Weapon Recoil." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Elemental Dominance",
            description:
              "+15% Base Status Chance (Sybaris); effect doubles in Incarnon Form.",
          },
          {
            name: "Reaver's Rapture",
            description:
              "On Full Burst Hit: +20% Damage, resets on Reload. Stacks up to 4x.",
          },
          {
            name: "Survivor's Edge",
            description: "+5% Base Critical Chance, +10% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Torid: {
    source: "Steel Path Circuit",
    genesisImage: "ToridIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into a long-range Toxin beam.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Final Fusillade",
            description:
              "+51 Base Damage. +3 Multishot on last shot in magazine.",
          },
          {
            name: "Plentiful Mayhem",
            description:
              "+31 Base Damage. Multishot consumes ammo from Capacity and increases Damage by +60%.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Swift Deliverance", description: "+50% Projectile Speed." },
          {
            name: "Renewed Horror",
            description:
              "On Reload From Empty: Lingering damage field duration doubles on first shot.",
          },
          {
            name: "Extended Volley",
            description: "+9 Base Magazine Capacity.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Commodore's Fortune",
            description: "+20% Base Critical Chance.",
          },
          {
            name: "Survivor's Edge",
            description: "+15% Base Critical Chance, +15% Base Status Chance.",
          },
          {
            name: "Elemental Balance",
            description: "+34% Base Status Chance.",
          },
        ],
      },
    ],
  },

  // ─── INCARNON GENESIS — SECONDARIES ────────────────────────────────────────

  Angstrum: {
    source: "Steel Path Circuit",
    genesisImage: "AngstrumIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Direct hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Haven Foray",
            description:
              "+50 Base Damage. With Overshields: +50 additional Base Damage.",
          },
          {
            name: "Paladin Virtue",
            description:
              "+75 Base Damage. With Energy Max over 700: +0.5x Critical Damage Multiplier.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Swift Deliverance", description: "+30% Projectile Speed." },
          { name: "Rapid Reinforcement", description: "+50% Reload Speed." },
          { name: "Hitman's Hoard", description: "+9 Base Ammo Maximum." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Critical Parallel",
            description:
              "+14% Base Critical Chance (Angstrum), +0.2x Critical Damage Multiplier.",
          },
          {
            name: "Survivor's Edge",
            description: "+9% Base Critical Chance, +9% Base Status Chance.",
          },
          {
            name: "Fatal Affliction",
            description:
              "+40% Direct Damage per Status Type affecting the target.",
          },
        ],
      },
    ],
  },

  Atomos: {
    source: "Steel Path Circuit",
    genesisImage: "AtomosIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Paladin Virtue",
            description:
              "+24 Base Damage. With Energy Max over 700: +1x Critical Damage Multiplier.",
          },
          {
            name: "Hoplite Virtue",
            description: "+24 Base Damage. On Shield Break: +30 Damage for 8s.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Moonrise Velocity", description: "+7 Range." },
          {
            name: "Mercenary Chamber",
            description: "Increase Ammo Capacity to 560.",
          },
          {
            name: "Resonant Restore",
            description:
              "On Reload From Empty: +5 Magazine Capacity, stacking up to 7x.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Elemental Balance",
            description: "+20% Base Status Chance.",
          },
          {
            name: "Commodore's Fortune",
            description: "+19% Base Critical Chance.",
          },
          {
            name: "Survivor's Edge",
            description: "+10% Base Critical Chance, +10% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Bronco: {
    source: "Steel Path Circuit",
    genesisImage: "BroncoIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Increases Range and Ricochet with enhanced crit/status in Incarnon Form.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Speeding Bullet",
            description:
              "+36 Base Damage (Bronco). With Sprint Speed 1.2 or higher: +60% Projectile Speed.",
          },
          {
            name: "Infused Shots",
            description:
              "+20 Base Damage (Bronco). On spending 50 Energy: +10 Damage for 10s, stacking up to 4x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Kinetic Battle", description: "-50% Weapon Recoil." },
          { name: "Practiced Grip", description: "+30% Accuracy." },
          {
            name: "Extended Volley",
            description: "+2 Base Magazine Capacity.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Enough for Everyone",
            description:
              "+80% Ammo Efficiency when 6 enemies are within 6 meters.",
          },
          {
            name: "Commodore's Fortune",
            description: "+20% Base Critical Chance.",
          },
          { name: "Rain of Lead", description: "+2 Multishot." },
        ],
      },
    ],
  },

  Cestra: {
    source: "Steel Path Circuit",
    genesisImage: "CestraIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Steadfast Grit",
            description:
              "+10 Base Damage. On Shield/Overguard Break: 3x Critical Damage for 6s.",
          },
          {
            name: "Fortress Salvo",
            description:
              "+10 Base Damage. With Armor over 450: +80% Multishot.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Rapid Reinforcement", description: "+50% Reload Speed." },
          {
            name: "Slayer's Nerve",
            description:
              "On Hit: +6% Accuracy and -6% Weapon Recoil for 6s, stacking up to 10x.",
          },
          { name: "Swift Deliverance", description: "+50% Projectile Speed." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Survivor's Edge",
            description: "+18% Base Critical Chance.",
          },
          {
            name: "Deathtrap Trigger",
            description: "+2x Base Critical Damage Multiplier.",
          },
          {
            name: "Wiseman's Regard",
            description:
              "+30% Base Status Chance based on current Critical Chance, up to +40%.",
          },
        ],
      },
    ],
  },

  Despair: {
    source: "Steel Path Circuit",
    genesisImage: "DespairIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into embedding projectiles that explode with Heat Damage in a 4.9m radius after 0.5s.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Fatal Affliction",
            description:
              "+50 Base Damage. +40% Direct Damage per Status Type affecting the target.",
          },
          {
            name: "Stalker's Vendetta",
            description:
              "+60 Base Damage. With Dread and Hate equipped: Multishot consumes ammo from Capacity, increases Damage by +100%, +30% Multishot.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Marksman's Focus", description: "-30% Zoom." },
          { name: "Swift Deliverance", description: "+50% Projectile Speed." },
          { name: "Rapid Reinforcement", description: "+100% Reload Speed." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Elemental Balance",
            description: "+24% Base Status Chance.",
          },
          {
            name: "Survivor's Edge",
            description: "+12% Base Critical Chance, +12% Base Status Chance.",
          },
          {
            name: "Critical Parallel",
            description:
              "+18% Base Critical Chance, +0.4x Critical Damage Multiplier.",
          },
        ],
      },
    ],
  },

  "Dual Toxocyst": {
    source: "Steel Path Circuit",
    genesisImage: "DualToxocystIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into a fully automatic mode with enhanced crit, fire rate, reduced recoil, and ricochet to 1 nearby enemy within 5m.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Carnage Reign",
            description:
              "+60 Base Damage. +33% Direct Damage per Status Type affecting the target (requires Energy Max ≥ 200).",
          },
          {
            name: "Fevered Frenzy",
            description:
              "+50 Base Damage. On Ability Cast: +5% Multishot, stacking up to 20x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Ready Retaliation",
            description: "On Reload From Empty: +100% Reload Speed.",
          },
          {
            name: "Evolved Autoloader",
            description: "+50% Magazine Reloaded/s when holstered.",
          },
          { name: "Marksman's Hand", description: "-50% Weapon Recoil." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Commodore's Fortune",
            description: "+20% Base Critical Chance.",
          },
          {
            name: "Neurotoxin",
            description:
              "On Headshot: +70% Toxin for 3s. (Note: flagged as non-functional as of last wiki check.)",
          },
          {
            name: "Ripper Rounds",
            description: "On Kill: +3 Punch Through for 7s.",
          },
        ],
      },
    ],
  },

  Furis: {
    source: "Steel Path Circuit",
    genesisImage: "FurisIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into a wide Heat Damage beam.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Haven Foray",
            description:
              "+28 Base Damage (Furis). With Overshields: +30 additional Base Damage.",
          },
          {
            name: "Stormburst",
            description:
              "+34 Base Damage (Mk1-Furis only). On hitting an enemy with Electricity status: +0.4 Multishot for 2s, stacking up to 3x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Practiced Grip", description: "+50% Accuracy." },
          {
            name: "Extended Volley",
            description:
              "+25 Base Magazine Capacity (does not affect Incarnon Form).",
          },
          {
            name: "Executioner's Fortune",
            description: "On Headshot: 10% chance for Instant Reload.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Headcracker",
            description:
              "On Headshot: +5% Fire Rate for 2s, stacking up to 10x.",
          },
          {
            name: "Prelude of Might",
            description:
              "With Critical Chance below 40%: +3x Base Critical Damage Multiplier.",
          },
          {
            name: "Elemental Balance",
            description: "+28% Base Status Chance (Furis).",
          },
        ],
      },
    ],
  },

  Gammacor: {
    source: "Steel Path Circuit",
    genesisImage: "GammacorIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into projectiles that pull enemies into a Cold Damage explosion.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Sage's Resolve",
            description:
              "+10 Base Damage. With Channeled Ability active: +25% Multishot.",
          },
          {
            name: "Infused Shots",
            description:
              "+6 Base Damage. On spending 50 Energy: +5 Base Damage for 10s, stacking up to 4x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Evolved Autoloader",
            description: "+50% Magazine Reloaded/s when holstered.",
          },
          { name: "Moonrise Velocity", description: "+8 Range." },
          {
            name: "Extended Volley",
            description: "+40 Base Magazine Capacity.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Critical Parallel",
            description:
              "+20% Base Critical Chance, +0.2x Critical Damage Multiplier.",
          },
          {
            name: "Survivor's Edge",
            description: "+12% Base Critical Chance, +10% Base Status Chance.",
          },
          {
            name: "Elemental Balance",
            description: "+20% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Kunai: {
    source: "Steel Path Circuit",
    genesisImage: "KunaiIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Projectiles seek Headshots and have 2 base Multishot, increased Slash damage, crit chance, and crit multiplier.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Swift Conclusion",
            description:
              "+70 Base Damage (Kunai). +200% Damage if enemy has less than half Health.",
          },
          {
            name: "Sage's Resolve",
            description:
              "+70 Base Damage (Kunai). With Channeled Ability active: +100% Multishot.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Swift Deliverance", description: "+60% Projectile Speed." },
          {
            name: "Extended Volley",
            description: "+10 Base Magazine Capacity.",
          },
          { name: "Rapid Reinforcement", description: "+50% Reload Speed." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Deathtrap Trigger",
            description:
              "On Equip: +40% Critical Chance for 4s and +1.4x Critical Damage Multiplier for 4s.",
          },
          {
            name: "Accelerating Volley",
            description: "+20% Fire Rate for 0.5s on fire, stacking up to 5x.",
          },
          {
            name: "Survivor's Edge",
            description: "+12% Base Critical Chance, +12% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Lato: {
    source: "Steel Path Circuit",
    genesisImage: "LatoIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Gains Punch Through, Ricochet to 1 nearby enemy within 10m, 2 base Multishot, and 0.8m Punch Through.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Haven Foray",
            description:
              "+40 Base Damage (Lato). With Overshields: +40 additional Base Damage.",
          },
          {
            name: "Reified Bane",
            description:
              "+30 Base Damage (Lato). On Reload From Empty: +30 additional Base Damage.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Void's Guidance",
            description: "+50% Accuracy, -50% Weapon Recoil.",
          },
          {
            name: "Marksman's Gain",
            description:
              "On Headshot: 20% chance for +50% Ammo Efficiency for 6s.",
          },
          {
            name: "Exact Penance",
            description: "On Kill: 50% chance for Instant Reload.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Survivor's Edge",
            description:
              "+10% Base Critical Chance, +10% Base Status Chance (Lato).",
          },
          {
            name: "Deathtrap Trigger",
            description:
              "On Equip from Primary: temporary Critical Chance and Critical Damage Multiplier boost for 4s.",
          },
          {
            name: "Carnage Reign",
            description:
              "+40% Direct Damage per Status Type affecting the target.",
          },
        ],
      },
    ],
  },

  Lex: {
    source: "Steel Path Circuit",
    genesisImage: "LexIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Hoplite Virtue",
            description:
              "+80 Base Damage (Lex). On Shield Break: +80 Base Damage for 8s.",
          },
          {
            name: "Trusty Sidearm",
            description:
              "+80 Base Damage (Lex). With Channeled Ability active: +60% Ammo Efficiency.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Lex Talionis",
            description:
              "On Headshot: -20% Weapon Recoil and +20% Accuracy for 4s, stacking up to 4x.",
          },
          {
            name: "Extended Volley",
            description: "+10 Base Magazine Capacity.",
          },
          {
            name: "Ready Retaliation",
            description: "On Reload From Empty: +100% Reload Speed.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Executioner's Dawn",
            description: "On Equip: +100% Headshot Damage for 4s.",
          },
          {
            name: "Elemental Balance",
            description: "+40% Base Status Chance (Lex).",
          },
          {
            name: "Critical Parallel",
            description:
              "+20% Base Critical Chance (Lex), +0.4x Critical Damage Multiplier.",
          },
        ],
      },
    ],
  },

  Sicarus: {
    source: "Steel Path Circuit",
    genesisImage: "SicarusIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes. Bullets ricochet to 1 nearby enemy within 6m, increased damage, crit chance, and crit multiplier.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Feigned Retreat",
            description:
              "+50 Base Damage (Sicarus). +40% Damage to enemies below half Health.",
          },
          {
            name: "King's Gambit",
            description:
              "+50 Base Damage (Sicarus). 0x Critical Chance on Bodyshots; +150% Critical Chance on Weakpoint Hits.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Void's Guidance",
            description: "+40% Accuracy, -40% Weapon Recoil.",
          },
          { name: "Rapid Reinforcement", description: "+50% Reload Speed." },
          {
            name: "Extended Volley",
            description: "+9 Base Magazine Capacity (Sicarus).",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Commodore's Fortune",
            description: "+18% Base Critical Chance (Sicarus).",
          },
          {
            name: "Survivor's Edge",
            description: "+12% Base Critical Chance, +12% Base Status Chance.",
          },
          {
            name: "Wiseman's Regard",
            description:
              "+30% Base Status Chance based on current Critical Chance, up to +40%.",
          },
        ],
      },
    ],
  },

  Vasto: {
    source: "Steel Path Circuit",
    genesisImage: "VastoIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes into a 6-round burst with increased Critical Chance and Critical Multiplier.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Lone Gun",
            description:
              "+66 Base Damage (Vasto). With no Primary equipped: +40 Damage and +14 Magazine Capacity.",
          },
          {
            name: "Deathtrap Trigger",
            description:
              "+66 Base Damage (Vasto). On Equip from Primary: +30% Critical Chance for 3s and +2.2x Critical Multiplier for 3s.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Extended Volley",
            description: "+6 Base Magazine Capacity.",
          },
          { name: "Marksman's Hand", description: "-50% Weapon Recoil." },
          {
            name: "Awakened Readiness",
            description: "+20% Magazine Reloaded/s when holstered.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Commodore's Fortune",
            description: "+16% Base Critical Chance (Vasto).",
          },
          {
            name: "Survivor's Edge",
            description: "+10% Base Critical Chance, +10% Base Status Chance.",
          },
          {
            name: "Reaper's Plenty",
            description: "On Headshot: +100% Ammo Efficiency for 2s.",
          },
        ],
      },
    ],
  },

  Zylok: {
    source: "Steel Path Circuit",
    genesisImage: "ZylokPrimeIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Weakpoint hits charge Incarnon Transmutation; Alt Fire transmutes.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Precision's Payoff",
            description:
              "+76 Base Damage (Zylok). Burst Headshots grant +20 Base Damage, stacking up to 3x.",
          },
          {
            name: "Mauler's Magazine",
            description:
              "+76 Base Damage (Zylok). Reload From Empty grants +1x Critical Damage Multiplier, stacking up to 2x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Extended Volley",
            description: "+12 Base Magazine Capacity (Zylok).",
          },
          { name: "Rapid Reinforcement", description: "+50% Reload Speed." },
          {
            name: "Void's Guidance",
            description: "+60% Accuracy, -60% Weapon Recoil.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Survivor's Edge",
            description:
              "+20% Base Critical Chance, +20% Base Status Chance (Zylok).",
          },
          {
            name: "Commodore's Fortune",
            description: "+32% Base Critical Chance (Zylok).",
          },
          {
            name: "Fatal Affliction",
            description:
              "+40% Direct Damage per Status Type affecting the target.",
          },
        ],
      },
    ],
  },

  // ─── INCARNON GENESIS — MELEES ──────────────────────────────────────────────

  "Ack & Brunt": {
    source: "Steel Path Circuit",
    genesisImage: "AckBruntIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +20% Sprint Speed, +20% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Templar's Wrath",
            description:
              "+150 Base Damage. With Armor over 450: +70% Heavy Attack Efficiency.",
          },
          {
            name: "Shieldmaiden's Rush",
            description:
              "+150 Base Damage. On Shield Break: +300% Combo Count Chance while Blocking for 11s.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+0.7 Range." },
          {
            name: "Abiding Hold",
            description: "Combo Timer pauses when weapon is holstered.",
          },
          {
            name: "Swift Break",
            description: "+70% Heavy Attack Wind Up Speed.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Rogue Readiness",
            description:
              "On Kill: 50% chance for Primary and Secondary weapons to instantly reload.",
          },
          { name: "Absolute Valor", description: "+17% Base Critical Chance." },
          {
            name: "Versatile Creed",
            description: "+9% Base Critical Chance, +9% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Anku: {
    source: "Steel Path Circuit",
    genesisImage: "AnkuIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. Successful slide attacks grant +3 Range and inflict Bleed Status for all attacks for 6s. +100% Melee Damage, +20% Sprint Speed, +20% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Edge of Justice",
            description:
              "+50 Base Damage. With Melee Weapon Equipped: +40% Attack Speed.",
          },
          {
            name: "Guardian's Promise",
            description:
              "+50 Base Damage. With Overshields: +80% Heavy Attack Efficiency.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Standoff",
            description: "Combo Timer pauses when weapon is holstered.",
          },
          {
            name: "Swordsman's Celerity",
            description: "+20% Movement Speed (permanent).",
          },
          {
            name: "Swift Break",
            description: "+60% Heavy Attack Wind Up Speed.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Absolute Dominion",
            description: "+20% Base Status Chance.",
          },
          {
            name: "Subtle Force",
            description: "+6% Base Critical Chance, +14% Base Status Chance.",
          },
          { name: "Absolute Valor", description: "+12% Base Critical Chance." },
        ],
      },
    ],
  },

  Bo: {
    source: "Steel Path Circuit",
    genesisImage: "BoIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +20% Sprint Speed, +20% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Stalwart Oak",
            description:
              "+110 Base Damage (Bo). With Armor over 450: +30 Parry Angle and +300% Combo Count Chance while Blocking.",
          },
          {
            name: "Swordsman's Flourish",
            description:
              "+100 Base Damage (Bo). With Melee Weapon Equipped: +100% Combo Count Chance.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+0.5 Range." },
          {
            name: "Overhand",
            description: "Base Heavy Attack Efficiency set to 20%.",
          },
          {
            name: "Swordsman's Celerity",
            description: "+20% Movement Speed (permanent).",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Flashing Bleed",
            description: "+40% chance of Bleed on Impact Status Effect.",
          },
          {
            name: "Subtle Force",
            description:
              "+12% Base Critical Chance (Bo), +12% Base Status Chance.",
          },
          {
            name: "Absolute Dominion",
            description: "+34% Base Status Chance (Bo).",
          },
        ],
      },
    ],
  },

  "Ceramic Dagger": {
    source: "Steel Path Circuit",
    genesisImage: "CeramicDaggerIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +25% Sprint Speed, +25% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Gun and Blade",
            description:
              "+100 Base Damage. On Primary Kill: +1 Initial Combo, stacking up to 100x.",
          },
          {
            name: "Breacher's Opportunity",
            description:
              "+120 Base Damage. On Shield Break: +80 Damage for 8s.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+1 Range." },
          { name: "Adept Reflexes", description: "+20 Initial Combo." },
          {
            name: "Rogue Readiness",
            description:
              "On Kill: 40% chance to instantly reload Primary and Secondary weapons.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Red Right Hand",
            description:
              "On First Attack with Primary Equipped: +2x Base Critical Damage Multiplier.",
          },
          {
            name: "Absolute Dominion",
            description: "+30% Base Status Chance.",
          },
          { name: "Absolute Valor", description: "+30% Base Critical Chance." },
        ],
      },
    ],
  },

  "Dual Ichor": {
    source: "Steel Path Circuit",
    genesisImage: "DualIchorIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Alchemist's Wrath",
            description:
              "+90 Base Damage. +5 additional Combos on targets affected by Toxin.",
          },
          {
            name: "Ronin's Rush",
            description:
              "+90 Base Damage. On striking target with final move of Neutral Combo: +30% Attack Speed for 33s.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+0.6 Range." },
          { name: "Resolute Force", description: "+7s Combo Duration." },
          {
            name: "Swift Break",
            description: "+100% Heavy Attack Wind Up Speed.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          { name: "Absolute Valor", description: "+34% Base Status Chance." },
          {
            name: "Poison Parasite",
            description:
              "On killing an enemy with 3+ Toxin Stacks: +33 Health Regeneration/s for 9s.",
          },
          {
            name: "Universal Readiness",
            description: "Collecting ammo grants 5 Melee Combo counter.",
          },
        ],
      },
    ],
  },

  Furax: {
    source: "Steel Path Circuit",
    genesisImage: "FuraxIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. Heavy Slams receive 90% Heavy Attack Efficiency and create a field dealing 50 Heat damage/s for 7s. +100% Melee Damage, +25% Sprint Speed, +25% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Swordsman's Flourish",
            description:
              "+110 Base Damage (Furax). With Melee Weapon Equipped: +100% Combo Count Chance.",
          },
          {
            name: "Kill Joy",
            description:
              "+90 Base Damage (Furax). +10% Attack Speed per enemy within 6m, stacking up to 5x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Moonrise Velocity", description: "+1 Range." },
          {
            name: "Overhand",
            description: "Heavy Attack Efficiency set at 20%.",
          },
          {
            name: "Standoff",
            description: "Combo Timer pauses when weapon is holstered.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Flashing Bleed",
            description: "+40% chance of Bleed on Impact Status Effect.",
          },
          {
            name: "Kinetic Killer",
            description:
              "Increase Critical Damage Multiplier to 4x on Slide Attacks.",
          },
          {
            name: "Absolute Dominion",
            description: "+24% Base Status Chance (Furax).",
          },
        ],
      },
    ],
  },

  Hate: {
    source: "Steel Path Circuit",
    genesisImage: "HateIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +20% Sprint Speed, +20% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Swordsman's Flourish",
            description:
              "+30 Base Damage. With Melee Weapon Equipped: +100% Combo Count Chance.",
          },
          {
            name: "Stalker's Legacy",
            description:
              "+30 Base Damage. With Dread and Despair equipped: +30 Initial Combo.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+0.8 Range." },
          {
            name: "Swift Break",
            description: "+60% Heavy Attack Wind Up Speed.",
          },
          { name: "Resolute Force", description: "+10s Combo Duration." },
        ],
      },
      {
        tier: 4,
        perks: [
          { name: "Absolute Valor", description: "+10% Base Critical Chance." },
          {
            name: "Absolute Dominion",
            description: "+20% Base Status Chance.",
          },
          {
            name: "Subtle Force",
            description: "+6% Base Critical Chance, +10% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Magistar: {
    source: "Steel Path Circuit",
    genesisImage: "MagistarIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +30 Initial Combo, +50% Heavy Attack Wind Up Speed, +10% Sprint Speed, +10% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Crushing Verdict",
            description:
              "+100 Base Damage (Magistar). With Channeled Ability active: +40% Follow Through.",
          },
          {
            name: "Edge of Justice",
            description:
              "+100 Base Damage (Magistar). With Melee Weapon Equipped: +40% Attack Speed.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Seismic Slam", description: "+100% Slam Radius." },
          { name: "Orokin Reach", description: "+1.4 Range." },
          {
            name: "Swift Break",
            description: "+30% Heavy Attack Wind Up Speed.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Flashing Bleed",
            description: "+50% chance of Bleed on Impact Status Effect.",
          },
          {
            name: "Subtle Force",
            description: "+8% Base Critical Chance, +8% Base Status Chance.",
          },
          {
            name: "Critical Parallel",
            description:
              "+16% Base Critical Chance (Magistar), +1x Critical Damage Multiplier.",
          },
        ],
      },
    ],
  },

  "Nami Solo": {
    source: "Steel Path Circuit",
    genesisImage: "NamiIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +3 Range, +100% Melee Damage, +20% Sprint Speed, +20% Bullet Jump. Duration 180s.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Brigand's Frenzy",
            description: "+80 Base Damage. On Equip: +30% Attack Speed for 4s.",
          },
          {
            name: "Master's Flourish",
            description:
              "+80 Base Damage. On Finisher Kill: +40 Health Regeneration/s for 10s.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          {
            name: "Lone Blade",
            description:
              "With Melee Weapon Equipped: +60% Base Follow Through.",
          },
          {
            name: "Swift Break",
            description: "+50% Heavy Attack Wind Up Speed.",
          },
          { name: "Resolute Force", description: "+6s Combo Duration." },
        ],
      },
      {
        tier: 4,
        perks: [
          { name: "Absolute Valor", description: "+21% Base Critical Chance." },
          {
            name: "Versatile Creed",
            description: "+14% Base Critical Chance, +14% Base Status Chance.",
          },
          {
            name: "Absolute Dominion",
            description: "+30% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Okina: {
    source: "Steel Path Circuit",
    genesisImage: "OkinaIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +20% Sprint Speed, +20% Parkour Velocity.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Seeing Red",
            description:
              "+60 Base Damage (Okina). +5 additional Combos on targets affected by Slash Status.",
          },
          {
            name: "Synergist Surety",
            description:
              "+60 Base Damage (Okina). On Critical Hit: +8% Status Damage for 10s, stacking up to 5x.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+1 Range." },
          {
            name: "Standoff",
            description: "Combo Timer pauses when weapon is holstered.",
          },
          {
            name: "Swordsman's Celerity",
            description: "+30% Movement Speed (permanent).",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Commodore's Fortune",
            description: "+12% Base Critical Chance (Okina).",
          },
          {
            name: "Alchemy of War",
            description:
              "+16% Base Status Chance (Okina), +25% Status Duration.",
          },
          {
            name: "Survivor's Edge",
            description:
              "+6% Base Critical Chance (Okina), +10% Base Status Chance.",
          },
        ],
      },
    ],
  },

  Sibear: {
    source: "Steel Path Circuit",
    genesisImage: "SibearIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +50% Heavy Attack Wind Up Speed, +10% Sprint Speed, +10% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Master's Shatter",
            description:
              "+20 Base Damage. +10 additional Combo on targets affected by Cold Status.",
          },
          {
            name: "Thane's Wrath",
            description:
              "+20 Base Damage. With Armor over 450: +40 additional Damage.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+1 Range." },
          {
            name: "Kinetic Harmony",
            description: "+60% Heavy Attack Wind Up Speed.",
          },
          { name: "Resolute Force", description: "+6s Combo Duration." },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Mounting Avalanche",
            description:
              "On killing an enemy with 3+ Cold Stacks: +15 Initial Combo for 10s, stacking up to 4x.",
          },
          { name: "Absolute Valor", description: "+25% Base Critical Chance." },
          {
            name: "Red Right Hand",
            description:
              "On First Attack with Primary Equipped: +2x Critical Damage Multiplier.",
          },
        ],
      },
    ],
  },

  Skana: {
    source: "Steel Path Circuit",
    genesisImage: "SkanaIncarnonAdapter.png",
    tiers: [
      {
        tier: 1,
        perks: [
          {
            name: "Incarnon Form",
            description:
              "Reach 6x Combo and Heavy Attack to activate. +100% Melee Damage, +20% Sprint Speed, +20% Bullet Jump.",
          },
        ],
      },
      {
        tier: 2,
        perks: [
          {
            name: "Guardian's Promise",
            description:
              "+100 Base Damage (Skana). With Overshields: +80% Heavy Attack Efficiency.",
          },
          {
            name: "Wartime Nerve",
            description:
              "+90 Base Damage (Skana). +9 Combo Count on undamaged enemies.",
          },
        ],
      },
      {
        tier: 3,
        perks: [
          { name: "Orokin Reach", description: "+0.4 Range." },
          { name: "Resolute Force", description: "+6s Combo Duration." },
          {
            name: "Swift Break",
            description: "+50% Heavy Attack Wind Up Speed.",
          },
        ],
      },
      {
        tier: 4,
        perks: [
          {
            name: "Survivor's Edge",
            description:
              "+12% Base Critical Chance (Skana), +10% Base Status Chance.",
          },
          {
            name: "Elemental Excess",
            description: "+20% Base Status Chance (Skana).",
          },
          {
            name: "Absolute Valor",
            description: "+25% Base Critical Chance (Skana).",
          },
        ],
      },
    ],
  },
}
