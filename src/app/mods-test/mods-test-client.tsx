"use client";

import { useState } from "react";
import { ModCard } from "@/components/mod-card";
import type { Mod, Polarity } from "@/lib/warframe/types";
import type { ModRarity } from "@/lib/warframe/mod-card-config";

interface ModsTestClientProps {
  sampleMods: {
    Common: Mod[];
    Uncommon: Mod[];
    Rare: Mod[];
    Legendary: Mod[];
    Peculiar: Mod[];
    Amalgam: Mod[];
    Galvanized: Mod[];
  };
}

// Mock mods for special rarity types that don't exist in WFCD data
const createMockMod = (
  name: string,
  rarity: ModRarity,
  polarity: Polarity = "madurai"
): Mod => ({
  uniqueName: `/Mock/${rarity}/${name.replace(/\s/g, "")}`,
  name,
  rarity: rarity as Mod["rarity"],
  polarity,
  baseDrain: 4,
  fusionLimit: 5,
  type: `${rarity} Mod`,
  tradable: true,
  imageName: "placeholder-item.png",
  levelStats: [
    { stats: ["+10% Placeholder Effect"] },
    { stats: ["+20% Placeholder Effect"] },
    { stats: ["+30% Placeholder Effect"] },
    { stats: ["+40% Placeholder Effect"] },
    { stats: ["+50% Placeholder Effect"] },
    { stats: ["+60% Placeholder Effect"] },
  ],
});

// Only Riven mods need mocking - Amalgam/Galvanized come from real data now
const MOCK_SPECIAL_MODS = {
  Riven: [
    createMockMod("Visi-critacan", "Riven", "madurai"),
    createMockMod("Acri-hexalis", "Riven", "naramon"),
    createMockMod("Toxi-critadex", "Riven", "vazarin"),
  ],
};

const RARITY_COLORS: Record<string, string> = {
  Common: "text-amber-600",
  Uncommon: "text-slate-400",
  Rare: "text-yellow-500",
  Legendary: "text-white",
  Peculiar: "text-purple-500",
  Riven: "text-purple-400",
  Amalgam: "text-cyan-400",
  Galvanized: "text-blue-400",
};

export function ModsTestClient({ sampleMods }: ModsTestClientProps) {
  const [selectedRank, setSelectedRank] = useState<Record<string, number>>({});

  const allRarities = [
    "Common",
    "Uncommon",
    "Rare",
    "Legendary",
    "Peculiar",
    "Riven",
    "Amalgam",
    "Galvanized",
  ] as const;

  const getMods = (rarity: (typeof allRarities)[number]): Mod[] => {
    if (rarity in sampleMods) {
      return sampleMods[rarity as keyof typeof sampleMods];
    }
    if (rarity in MOCK_SPECIAL_MODS) {
      return MOCK_SPECIAL_MODS[rarity as keyof typeof MOCK_SPECIAL_MODS];
    }
    return [];
  };

  const isMockRarity = (rarity: string) => rarity === "Riven";

  const handleRankChange = (modId: string, rank: number) => {
    setSelectedRank((prev) => ({ ...prev, [modId]: rank }));
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mod Card Test Page</h1>
        <p className="text-muted-foreground mb-4">
          Testing mod card variants for all rarities with Framer Motion
          animations
        </p>
        <div className="text-sm bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">Instructions:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Hover over any mod to see the expanded view with animation</li>
            <li>
              Use <kbd className="px-1 bg-muted rounded">+</kbd> /{" "}
              <kbd className="px-1 bg-muted rounded">-</kbd> keys while hovering
              to adjust rank
            </li>
            <li>
              Riven mods are mock data for testing frames (no real Riven data)
            </li>
          </ul>
        </div>
      </div>

      {/* Mod Cards by Rarity */}
      <div className="space-y-12">
        {allRarities.map((rarity) => {
          const mods = getMods(rarity);
          const isMock = isMockRarity(rarity);

          return (
            <section key={rarity}>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className={RARITY_COLORS[rarity]}>●</span>
                {rarity} Mods
                <span className="text-sm text-muted-foreground font-normal">
                  ({mods.length} samples)
                  {isMock && (
                    <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                      Mock Data
                    </span>
                  )}
                </span>
              </h2>

              <div className="flex flex-wrap gap-6 pb-8">
                {mods.length > 0 ? (
                  mods.map((mod) => (
                    <div key={mod.uniqueName} className="relative">
                      <ModCard
                        mod={mod}
                        rank={selectedRank[mod.uniqueName] ?? mod.fusionLimit}
                        onRankChange={(rank) =>
                          handleRankChange(mod.uniqueName, rank)
                        }
                      />
                      <div className="mt-2 text-xs text-center text-muted-foreground">
                        Rank:{" "}
                        {selectedRank[mod.uniqueName] ?? mod.fusionLimit ?? 0}/
                        {mod.fusionLimit ?? 0}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No {rarity.toLowerCase()} mods found in the data
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Match State Tests */}
      <section className="mt-12 pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Match State Tests</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Testing polarity match/mismatch visual feedback
        </p>

        <div className="flex flex-wrap gap-6">
          {sampleMods.Rare.slice(0, 1).map((mod) => (
            <div key={`${mod.uniqueName}-states`} className="flex gap-6">
              <div>
                <ModCard mod={mod} matchState="neutral" />
                <div className="mt-2 text-xs text-center text-muted-foreground">
                  Neutral
                </div>
              </div>
              <div>
                <ModCard mod={mod} matchState="match" />
                <div className="mt-2 text-xs text-center text-green-500">
                  Match
                </div>
              </div>
              <div>
                <ModCard mod={mod} matchState="mismatch" />
                <div className="mt-2 text-xs text-center text-red-500">
                  Mismatch
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
