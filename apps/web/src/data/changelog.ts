// Changelog content for the /changelog route. Data-only (no React/Tailwind)
// so edits here don't churn the route module. Add new entries at the TOP.

export interface ChangelogEntry {
  date: string
  changes: {
    type: "feat" | "fix" | "refactor" | "chore"
    description: string
  }[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-03",
    changes: [
      {
        type: "feat",
        description:
          "Organizations can now be marked verified by an admin. Verified orgs render in purple across build cards, the build viewer header, org pages, and the directory, and sort first in the directory. Everyone else now renders in a muted gray instead.",
      },
      {
        type: "fix",
        description:
          "Org members can now see their org's private and unlisted builds on the org page — they used to see only public builds, same as a logged-out visitor.",
      },
      {
        type: "feat",
        description:
          "Ctrl+K and the footer now have a Report an Issue shortcut that jumps straight to a GitHub issue template.",
      },
      {
        type: "fix",
        description:
          "Ability tooltips now render damage-type icons and line breaks correctly instead of showing raw tags like <br> and DT_SENTIENT_COLOR.",
      },
      {
        type: "fix",
        description:
          "Elements now combine in slot order instead of equip order, so modding elements out of sequence no longer shows the wrong combined element until you reload the build.",
      },
      {
        type: "fix",
        description:
          "Directory cards line up their member and build counts at the bottom of the card, even when one card has a longer description than its neighbors.",
      },
    ],
  },
  {
    date: "2026-07-01",
    changes: [
      {
        type: "fix",
        description:
          "The Ballistica, Ballistica Prime, and Rakta Ballistica mod picker now offers pistol mods instead of rifle mods. These sidearm crossbows were being routed to the primary mod pool, so the picker showed things like Serration and Metal Auger they can't actually equip.",
      },
    ],
  },
  {
    date: "2026-06-30",
    changes: [
      {
        type: "fix",
        description:
          "Arcanes Crepuscular, Sculptor, and Steadfast now show their correct art. Crepuscular used to come up as a blank blue glyph, and Sculptor and Steadfast were showing the wrong icons.",
      },
    ],
  },
  {
    date: "2026-06-28",
    changes: [
      {
        type: "feat",
        description:
          "Five more incarnons have their evolution trees in the planner: Vectis, Ballistica, Stug, Destreza, and Obex. Turn on Incarnon and you get the same tier-by-tier perk picker as the rest.",
      },
      {
        type: "fix",
        description:
          "The Incarnon Genesis adapter icon now shows when you enable Incarnon on a Steel Path weapon. Every genesis weapon used to fall back to a blank placeholder there.",
      },
      {
        type: "fix",
        description:
          "The mod picker no longer offers mods a weapon can't actually equip: beam-only mods like Ruinous Extension stay off non-beam pistols such as the Furis, and the semi-auto-only Cannonade mods stay off full-auto weapons.",
      },
      {
        type: "fix",
        description:
          "You can no longer stack two augments for the same ability — for example two of Loki's Decoy augments. Once you slot one, the others grey out, and existing builds that doubled up now flag the conflict.",
      },
    ],
  },
  {
    date: "2026-06-20",
    changes: [
      {
        type: "fix",
        description:
          "Sirius & Orion: you can now subsume a Helminth ability on Orion, not just Sirius. Each brother keeps his own subsume, so it lands on whoever's in front.",
      },
    ],
  },
  {
    date: "2026-06-19",
    changes: [
      {
        type: "feat",
        description:
          "Archon Shards are now per variant: every build variant keeps its own shard set, so changing one variant's shards no longer affects the others. They're saved in the share link too, so a build opens with each variant's shards intact.",
      },
      {
        type: "chore",
        description:
          "Build pages open faster for logged-out visitors — they're now served from a cache instead of being rebuilt on every view.",
      },
      {
        type: "chore",
        description:
          "Likes, edits, and new builds now show up across build lists (and for logged-out visitors) within about a minute, instead of taking several minutes to appear.",
      },
    ],
  },
  {
    date: "2026-06-18",
    changes: [
      {
        type: "feat",
        description:
          "Sirius & Orion — the new twin Warframe — is in the planner as a single frame with a form toggle above the variant tabs. Each form (Sirius and Orion) keeps its own abilities, Helminth, and set of build variants, so you can plan both loadouts side by side under one build and flip between them. Helminth stays on the primary form, matching how the frame works in game.",
      },
      {
        type: "feat",
        description:
          "The latest gear is in the catalog — Sirius & Orion, Styanax Prime, Afentis Prime, and the Pride and Wrath melees, among others. Brand-new weapons the Wiki hasn't documented yet still show up and can be modded; their detailed stats fill in automatically once the Wiki catches up.",
      },
      {
        type: "feat",
        description:
          "The home page now leads with the newest Warframe, and the “Recently added” list reliably shows the latest releases.",
      },
    ],
  },
  {
    date: "2026-06-13",
    changes: [
      {
        type: "feat",
        description:
          "Arsenyx pages are now properly visible to search engines: every item page, build page, and category gets its own title, description, and preview card (instead of one generic title for the whole site), there's a sitemap so Google can find all ~850 item pages, and arsenyx.com now redirects to www.arsenyx.com so links all count toward the same site. Sharing a build or item link anywhere — not just Discord — now shows a proper preview.",
      },
    ],
  },
  {
    date: "2026-06-12",
    changes: [
      {
        type: "feat",
        description:
          'Build guides can now reference mods and arcanes by name: type [[ in the guide editor and pick from the suggestions. Readers who hover the reference (or tap it on a phone) see the full mod card with Wiki and Market links — the same card build slots show — so a guide can say "swap in Adaptation here" without sending anyone off to look it up.',
      },
    ],
  },
  {
    date: "2026-06-11",
    changes: [
      {
        type: "feat",
        description:
          "Set mods (Gladiator, Augur, Vigilante, and the rest) now show their set bonus on the expanded card: the active tier based on how many pieces of the set your build has equipped, or the full-set bonus as a preview while you're still picking.",
      },
    ],
  },
  {
    date: "2026-06-09",
    changes: [
      {
        type: "feat",
        description:
          "Click any mod or arcane on a build to get quick links to the Warframe Wiki and (for tradable items) Warframe Market — so you can check what something does or where to get it without leaving the build. It only shows when viewing a build, never while you're editing.",
      },
      {
        type: "feat",
        description:
          "Community builds can now be sorted by Trending, which ranks them by the views they've picked up over the last 30 days — so builds gaining traction show up, not just the all-time leaders.",
      },
      {
        type: "chore",
        description:
          "The community builds page now opens on Recently Updated by default.",
      },
      {
        type: "chore",
        description:
          "The Ctrl+K quick search no longer shows a list of items before you type — it stays on the page shortcuts until you start searching.",
      },
      {
        type: "feat",
        description:
          "The build-guide editor is rebuilt around a real Markdown editor: a formatting toolbar (headings, bold/italic, lists, quotes, links, images, video embeds, code), a live side-by-side preview that renders exactly like the published guide, and templates — built-in starters plus ones you save yourself in this browser.",
      },
      {
        type: "feat",
        description:
          "Build guides now treat a single line break as an actual line break, so your write-up reads the way you typed it instead of collapsing separate lines into one paragraph.",
      },
      {
        type: "feat",
        description:
          "Keyboard-shortcut hints now show the modifier for your platform — ⌘ on Mac, Ctrl elsewhere — instead of listing both.",
      },
      {
        type: "fix",
        description:
          "Weapon and companion augment mods now show up on every variant of a weapon — Prime, Wraith, Vandal, and the like — instead of only the base version. For example, Velox Conclusion now appears when modding Velox Prime.",
      },
    ],
  },
  {
    date: "2026-06-07",
    changes: [
      {
        type: "chore",
        description: "Game data refreshed to the latest Warframe build.",
      },
    ],
  },
  {
    date: "2026-06-05",
    changes: [
      {
        type: "feat",
        description:
          "Overframe imports now have a paste-and-bookmarklet fallback for builds the server can't fetch directly, so Cloudflare-protected builds still come through.",
      },
      {
        type: "feat",
        description:
          "Overframe imports now pull in the build's guide and any YouTube embeds, not just the mods.",
      },
      {
        type: "fix",
        description:
          "Forma polarities now import from Overframe correctly across universal/Aya, zenurik, and umbra slots, so the forma count matches the original build.",
      },
      {
        type: "fix",
        description:
          "Melee stance, exilus, and arcane mods from Overframe now land in the right slots instead of each shifting down by one.",
      },
      {
        type: "fix",
        description:
          "Forma counts no longer come up short when an aura or exilus slot shares a polarity with a regular mod slot.",
      },
    ],
  },
  {
    date: "2026-06-03",
    changes: [
      {
        type: "feat",
        description:
          "Arsenyx now shows a one-click reload prompt when a new version ships, so you're not stuck on a stale tab.",
      },
      {
        type: "feat",
        description:
          "Embedded builds that don't match a curated highlight strip — plain primaries and secondaries, archwings, and the like — now show a header bar with the item name and a link back to Arsenyx.",
      },
      {
        type: "refactor",
        description:
          "Build embeds now load from a lightweight, router-free entry, so guide pages with many embedded builds load noticeably faster.",
      },
    ],
  },
  {
    date: "2026-06-02",
    changes: [
      {
        type: "feat",
        description:
          "Build cards now show a forma count, and build lists can be sorted by forma.",
      },
      {
        type: "feat",
        description:
          "Mods now settle into their slot with a subtle drop animation when placed.",
      },
    ],
  },
  {
    date: "2026-06-01",
    changes: [
      {
        type: "feat",
        description:
          "Mod validation now flags conflicting and incompatible mods directly in the editor, so you can see why a combination won't work.",
      },
      {
        type: "fix",
        description:
          "Base and Primed versions of the same mod now conflict correctly, and Bayonet stances route to the right slot.",
      },
      {
        type: "fix",
        description:
          "Exodia arcanes are now gated to Zaw melees instead of showing on every melee weapon.",
      },
      {
        type: "fix",
        description:
          "Slot fixes for exalted stances, beast-claw Posture slots, and PvE / Conclave mod visibility.",
      },
      {
        type: "fix",
        description: "Corrected a critical-chance calculation.",
      },
      {
        type: "refactor",
        description:
          "Data and assets are now cached at the edge for faster loads.",
      },
    ],
  },
  {
    date: "2026-05-31",
    changes: [
      {
        type: "feat",
        description: "The build editor now supports undo and redo.",
      },
      {
        type: "feat",
        description:
          "Editor drafts autosave to your browser, so you can pick up where you left off, with restore and reset controls.",
      },
      {
        type: "feat",
        description:
          "The search grid now explains why a mod is dimmed instead of leaving you guessing.",
      },
      {
        type: "refactor",
        description:
          "Build lists now show real empty states instead of a blank panel.",
      },
      {
        type: "refactor",
        description:
          "UI consistency pass: link-button cursors, icon sizing, and accessibility labels, plus Sonner toasts replacing the old hand-rolled feedback.",
      },
      {
        type: "fix",
        description:
          "Necramech exalted weapons (Arquebex, Ironbride, Mausolon) now show their Exilus and Arcane slots correctly.",
      },
      {
        type: "fix",
        description:
          "Frames with no innate aura polarity now show their aura slot.",
      },
      {
        type: "fix",
        description:
          "The editor re-hydrates correctly when you change a build's structure, and restored drafts re-resolve their mod images.",
      },
      {
        type: "chore",
        description: "Game data refreshed to the latest Warframe build.",
      },
    ],
  },
  {
    date: "2026-05-30",
    changes: [
      {
        type: "feat",
        description:
          "Kitguns are now buildable, with a grip and loader component picker in the editor and viewer that mirrors the Zaw flow.",
      },
      {
        type: "feat",
        description:
          "The mod picker gained a PvE / Conclave game-mode toggle and a working exilus filter, and the rarity, polarity, and game-mode filters now actually narrow the grid instead of just dimming.",
      },
      {
        type: "feat",
        description:
          "Arch-guns now have a Space / Atmosphere toggle on item detail when both stat sets exist.",
      },
      {
        type: "refactor",
        description:
          "Item, mod, and arcane images are now self-hosted and cached on the CDN, so they load faster and no longer break when upstream sources move.",
      },
      {
        type: "refactor",
        description:
          "Saved builds now resolve their images from the live catalog at view time, so old builds self-heal instead of showing broken cards.",
      },
      {
        type: "chore",
        description:
          "Game data is now sourced directly from the official Warframe export and the wiki, so items, mods, and arcanes stay accurate and up to date.",
      },
      {
        type: "fix",
        description:
          "Augment and modular arcane compatibility is now exact — augments only show on weapons and frames that can equip them, and Kitgun/Pax arcanes no longer appear on every primary and secondary.",
      },
      {
        type: "fix",
        description:
          "Universal (any) polarity mods now grant their capacity bonus on every polarized slot, and trade-off auras like Power Donation report the correct stat changes.",
      },
      {
        type: "fix",
        description:
          "The Plexus mod picker is populated again, Jade renders both of her aura slots, and the command palette no longer lists exalted weapons twice.",
      },
    ],
  },
  {
    date: "2026-05-27",
    changes: [
      {
        type: "feat",
        description: "Mod cards now show slot-type and set-crest badges.",
      },
      {
        type: "feat",
        description:
          "Auto-forma button now applies across every variant in a build.",
      },
      {
        type: "fix",
        description:
          "Tome mods are restricted to the Grimoire and Noctua instead of showing up for every secondary.",
      },
      {
        type: "fix",
        description:
          "Innate base elements now fold into the weapon's established element combinations instead of being counted separately.",
      },
      {
        type: "fix",
        description:
          "Weapon stats on item detail pages are capped to two decimals instead of showing long fractions.",
      },
    ],
  },
  {
    date: "2026-05-26",
    changes: [
      {
        type: "feat",
        description:
          "Arcane tooltips show element icons inline. Rarity badge removed.",
      },
      {
        type: "feat",
        description:
          "Mod search matches on target weapon/frame name and type, so you can search by what a mod fits.",
      },
      {
        type: "refactor",
        description:
          "Docs split into a Concepts guide and an API reference, with rewritten privacy and terms pages and a published LICENSE.",
      },
    ],
  },
  {
    date: "2026-05-24",
    changes: [
      {
        type: "feat",
        description:
          "Beast claws (Kavat and Kubrow) are now buildable, with innate element ordering fixed across companion weapons.",
      },
      {
        type: "feat",
        description:
          "Build links unfurl on Discord, Slack, and Twitter with the item, author, and org.",
      },
      {
        type: "feat",
        description:
          "Build headers show the author alongside the org, with a publish-time opt-out for authors who'd rather stay hidden.",
      },
      {
        type: "feat",
        description:
          "Mod pool now reflects the forma count you've actually spent.",
      },
    ],
  },
  {
    date: "2026-05-23",
    changes: [
      {
        type: "feat",
        description:
          "Build variants — pack up to 4 loadouts into a single build for steel-path / starchart / eidolon splits.",
      },
      {
        type: "fix",
        description:
          "Companion weapon mod pools fixed, and the variant guide editor is clearer about which loadout you're editing.",
      },
      {
        type: "fix",
        description:
          "Rank hotkeys now work while the mod picker is open instead of getting swallowed.",
      },
      {
        type: "refactor",
        description:
          "Security hardening pass: auth, image proxy, rate limits, and privileged user fields all locked down.",
      },
      {
        type: "refactor",
        description: "Refreshed the about and organizations copy.",
      },
    ],
  },
  {
    date: "2026-05-21",
    changes: [
      {
        type: "feat",
        description:
          "Zaws now have a dedicated Exodia arcane slot, separate from regular melee arcanes.",
      },
      {
        type: "feat",
        description:
          "YouTube and Vimeo links in build guides now embed inline as players.",
      },
      {
        type: "feat",
        description:
          "Ability stats are reorderable in the editor, and slots auto-advance/skip cleanly as you place mods.",
      },
      {
        type: "feat",
        description:
          "Ability stat order now defaults to Duration / Efficiency / Range / Strength.",
      },
      {
        type: "refactor",
        description:
          "Related-build chips are bigger and wider so titles get room to breathe.",
      },
      {
        type: "fix",
        description:
          "Navigating between builds now resets viewer state instead of carrying over the previous build's selections.",
      },
    ],
  },
  {
    date: "2026-05-17",
    changes: [
      {
        type: "feat",
        description:
          "Melee weapons now have a dedicated Stance mod slot, and Zaw strikes surface their stance slot too.",
      },
      {
        type: "feat",
        description: "Embed mode improvements.",
      },
      {
        type: "fix",
        description:
          "Exalted weapons now compute damage, mod pool, and arcane slot correctly.",
      },
      {
        type: "fix",
        description:
          "Editor regressions fixed: click-to-place, stance capacity, weapon damage calc, and mod-pool leaks between slots.",
      },
      {
        type: "chore",
        description: "Game data updated to the latest Warframe build.",
      },
    ],
  },
  {
    date: "2026-05-16",
    changes: [
      {
        type: "feat",
        description:
          "Mods can now be reordered via drag-and-drop in the editor.",
      },
      {
        type: "feat",
        description: "Partner builds.",
      },
    ],
  },
  {
    date: "2026-05-11",
    changes: [
      {
        type: "feat",
        description:
          "Weapon damage summary now includes combined-element mods.",
      },
      {
        type: "chore",
        description: "Game data updated to the latest Warframe build.",
      },
    ],
  },
  {
    date: "2026-05-10",
    changes: [
      {
        type: "refactor",
        description:
          "Expanded mod card assets preload while you browse, so opening a card no longer waits on images.",
      },
    ],
  },
  {
    date: "2026-05-09",
    changes: [
      {
        type: "fix",
        description:
          "Arch-gun arcane slots are now correctly typed as Primary and Secondary so the right arcanes are offered.",
      },
      {
        type: "feat",
        description:
          "Hovering a build's timestamp shows when it was last updated.",
      },
    ],
  },
  {
    date: "2026-05-08",
    changes: [
      {
        type: "feat",
        description:
          "Item detail pages have been redesigned, and browse lists and loading skeletons got an overhaul to feel snappier.",
      },
      {
        type: "feat",
        description:
          "Item, category, and author in the build header are now clickable links.",
      },
      {
        type: "refactor",
        description:
          "Author links stay neutral gray; purple is now reserved for organizations.",
      },
      {
        type: "fix",
        description:
          "Builds list no longer flashes empty on navigation — the prefetched data is reused correctly now.",
      },
    ],
  },
  {
    date: "2026-05-05",
    changes: [
      {
        type: "chore",
        description: "Game data updated to Warframe 42.0.9.",
      },
    ],
  },
  {
    date: "2026-05-04",
    changes: [
      {
        type: "feat",
        description:
          "Damage types and currency now use in-game icons instead of generic badges.",
      },
      {
        type: "fix",
        description:
          "Zaw images load again — refreshed to the latest canonical names.",
      },
      {
        type: "fix",
        description:
          "Zaw selector no longer flickers along the right edge on hover.",
      },
    ],
  },
  {
    date: "2026-05-03",
    changes: [
      {
        type: "feat",
        description:
          "Arch-guns now show their atmospheric deployment context where it applies.",
      },
      {
        type: "fix",
        description:
          "Deployment toggle now shows the selected option's label instead of its raw value.",
      },
    ],
  },
  {
    date: "2026-05-01",
    changes: [
      {
        type: "refactor",
        description:
          "Hardened API mutations and retired the standalone screenshot service.",
      },
    ],
  },
  {
    date: "2026-04-30",
    changes: [
      {
        type: "feat",
        description:
          "Redesigned landing page built around real game data instead of placeholder content.",
      },
      {
        type: "feat",
        description:
          "Unified keyboard shortcut system, with a cheat-sheet (press ?) so you can discover what's available.",
      },
      {
        type: "feat",
        description:
          "Embed mode improvements and a broader responsiveness pass.",
      },
      {
        type: "feat",
        description: "profit-taker.com can now embed Arsenyx builds.",
      },
      {
        type: "fix",
        description:
          "Builds sidebar scrolls again, and the embed button has been folded into a single share menu.",
      },
      {
        type: "refactor",
        description:
          "Security fixes across authorization, XSS, and CSRF, plus dependency advisory cleanup.",
      },
    ],
  },
  {
    date: "2026-04-29",
    changes: [
      {
        type: "feat",
        description:
          "Added a favicon and Apple touch icon so Arsenyx looks right in tabs and on home screens.",
      },
      {
        type: "fix",
        description:
          "Saved builds with stale image names now self-heal instead of showing broken cards.",
      },
      {
        type: "fix",
        description:
          "Innate exilus polarity is now counted toward forma usage and mod capacity.",
      },
    ],
  },
  {
    date: "2026-04-25",
    changes: [
      {
        type: "feat",
        description:
          "On tablets and smaller laptops, your stats and abilities now open in a popover so the mods get the full width of the page.",
      },
    ],
  },
  {
    date: "2026-04-24",
    changes: [
      {
        type: "feat",
        description: "Mobile compatibility pass across the app.",
      },
    ],
  },
  {
    date: "2026-04-19",
    changes: [
      {
        type: "feat",
        description:
          "Arsenyx rewrite — new stack, same build planner. More to come.",
      },
    ],
  },
]
