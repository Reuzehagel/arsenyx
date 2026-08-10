import type { Mod } from "@arsenyx/shared/warframe/types"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { ModCard } from "@/components/build-editor/mod-card"
import { ModCardMorph } from "@/components/build-editor/mod-card-morph"
import { modMaxRank } from "@/components/build-editor/slot-ranks"
import { DISPLAY_SIZE, normalizeRarity } from "@/lib/mod-card-config"

/* PROTOTYPE HARNESS — not linked from anywhere, delete with the prototype.
 * Renders the morphing card (mod-card-morph.tsx) two ways: a hover row for
 * feeling the motion, and a scrub strip that freezes the same morph at fixed
 * progress values so it can be screenshotted frame by frame. */

export const Route = createFileRoute("/proto/mod-card")({
  component: ProtoModCard,
})

const PICKS = [
  "Vitality",
  "Serration",
  "Streamline",
  "Primed Continuity",
  "Galvanized Diffusion",
  "Augur Secrets",
]

const STAGE = {
  width: DISPLAY_SIZE.expanded.width,
  height: DISPLAY_SIZE.expanded.height,
}

/** Where the compact card sits inside the 285-tall stage (see CY in
 * mod-card-morph.tsx — the compact state is centred in the stage). */
const COMPACT_WINDOW_TOP =
  (DISPLAY_SIZE.expanded.height - DISPLAY_SIZE.compact.height) / 2

/** Real grid-cell footprint: compact card + the 32px rank-dot overhang that
 * mod-card.tsx already extends the hover surface by. */
const COMPACT_HIT = {
  width: DISPLAY_SIZE.compact.width,
  height: DISPLAY_SIZE.compact.height + 32,
}

function useMods(names: string[]) {
  const [mods, setMods] = useState<Mod[] | null>(null)
  useEffect(() => {
    let alive = true
    void fetch("/data/mods-all.json")
      .then((r) => r.json() as Promise<Mod[]>)
      .then((all) => {
        if (!alive) return
        const by = new Map(all.map((m) => [m.name, m]))
        setMods(names.map((n) => by.get(n)).filter((m): m is Mod => !!m))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return mods
}

function HoverCard({
  mod,
  rails,
  corners,
}: {
  mod: Mod
  rails: boolean
  corners: boolean
}) {
  const [open, setOpen] = useState(false)
  const rarity = normalizeRarity(mod.rarity)
  // The hit area is the COMPACT card's footprint (plus the rank-dot overhang),
  // matching the real grid cell — hovering must not be triggered by the empty
  // space the expanded card will eventually occupy. The 285-tall stage is
  // offset upward so its compact window lands on this box, and is
  // pointer-events-none so only this wrapper is interactive.
  return (
    <div
      className="relative"
      style={{ width: COMPACT_HIT.width, height: COMPACT_HIT.height }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className="pointer-events-none absolute left-0"
        style={{ top: -COMPACT_WINDOW_TOP }}
      >
        <ModCardMorph
          mod={mod}
          rarity={rarity}
          rank={modMaxRank(mod)}
          open={open}
          showRails={rails}
          showCornerLights={corners}
        />
      </div>
    </div>
  )
}

const FRAMES = [0, 0.15, 0.3, 0.5, 0.75, 1]

function ProtoModCard() {
  const mods = useMods(PICKS)
  const [rails, setRails] = useState(false)
  const [corners, setCorners] = useState(false)
  const [scrub, setScrub] = useState(0)

  if (!mods) return <div className="p-10 text-white">loading mods…</div>

  const hero = mods[0]!
  const heroRarity = normalizeRarity(hero.rarity)

  return (
    <div className="min-h-screen bg-[#0d1117] p-10 text-white">
      <div className="mb-8 flex items-center gap-6 font-mono text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rails}
            onChange={(e) => setRails(e.target.checked)}
          />
          side rails
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={corners}
            onChange={(e) => setCorners(e.target.checked)}
          />
          corner lights
        </label>
        <label className="flex items-center gap-2">
          scrub
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={scrub}
            onChange={(e) => setScrub(Number(e.target.value))}
            className="w-64"
          />
          <span className="w-10 tabular-nums">{scrub.toFixed(2)}</span>
        </label>
      </div>

      <h2 className="mb-3 font-mono text-xs text-white/50">
        frame strip — same morph frozen at fixed progress
      </h2>
      <div id="strip" className="mb-12 flex gap-6 bg-[#0d1117] p-2">
        {FRAMES.map((t) => (
          <div key={t} className="flex flex-col items-center gap-2">
            <div style={{ width: STAGE.width, height: STAGE.height }}>
              <ModCardMorph
                mod={hero}
                rarity={heroRarity}
                rank={modMaxRank(hero)}
                open={false}
                progress={t}
                showRails={rails}
                showCornerLights={corners}
              />
            </div>
            <span className="font-mono text-[10px] text-white/40">t={t}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-mono text-xs text-white/50">
        parity — current ModCard vs morph endpoints (should be identical)
      </h2>
      <div className="mb-12 flex items-start gap-6 bg-[#0d1117] p-2">
        {(
          [
            ["current compact", <ModCard key="c" mod={hero} disableHover />],
            [
              "morph t=0",
              <div
                key="m0"
                style={{ width: STAGE.width, height: STAGE.height }}
              >
                <ModCardMorph
                  mod={hero}
                  rarity={heroRarity}
                  rank={modMaxRank(hero)}
                  open={false}
                  progress={0}
                  showRails={rails}
                  showCornerLights={corners}
                />
              </div>,
            ],
            ["current expanded", <ModCard key="e" mod={hero} alwaysExpanded />],
            [
              "morph t=1",
              <div
                key="m1"
                style={{ width: STAGE.width, height: STAGE.height }}
              >
                <ModCardMorph
                  mod={hero}
                  rarity={heroRarity}
                  rank={modMaxRank(hero)}
                  open={false}
                  progress={1}
                  showRails={rails}
                  showCornerLights={corners}
                />
              </div>,
            ],
          ] as const
        ).map(([label, node]) => (
          <div key={label} className="flex flex-col items-center gap-2">
            {node}
            <span className="font-mono text-[10px] text-white/40">{label}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-mono text-xs text-white/50">
        scrubbed — all rarities at t={scrub.toFixed(2)}
      </h2>
      <div id="rarities" className="mb-12 flex gap-6 bg-[#0d1117] p-2">
        {mods.map((m) => (
          <div
            key={m.name}
            style={{ width: STAGE.width, height: STAGE.height }}
          >
            <ModCardMorph
              mod={m}
              rarity={normalizeRarity(m.rarity)}
              rank={modMaxRank(m)}
              open={false}
              progress={scrub}
              showRails={rails}
              showCornerLights={corners}
            />
          </div>
        ))}
      </div>

      <h2 className="mb-3 font-mono text-xs text-white/50">
        live — hover to play the real transition (hit area = compact card only)
      </h2>
      <div className="flex gap-6 pt-[120px] pb-[120px]">
        {mods.map((m) => (
          <HoverCard key={m.name} mod={m} rails={rails} corners={corners} />
        ))}
      </div>
    </div>
  )
}
