"use client";

import { ModCard } from "@/components/mod-card";
import type { Mod } from "@/lib/warframe/types";

interface ModsTestClientProps {
  sampleMods: {
    Common: Mod[];
    Uncommon: Mod[];
    Rare: Mod[];
    Legendary: Mod[];
    Peculiar: Mod[];
  };
}

type Rarity = keyof ModsTestClientProps["sampleMods"];

export function ModsTestClient({ sampleMods }: ModsTestClientProps) {
  const rarities: Rarity[] = [
    "Common",
    "Uncommon",
    "Rare",
    "Legendary",
    "Peculiar",
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mod Card Test Page</h1>
        <p className="text-muted-foreground">
          Testing mod card variants for all rarities
        </p>
      </div>

      {/* Mod Cards by Rarity */}
      <div className="space-y-12">
        {rarities.map((rarity) => (
          <section key={rarity}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span
                className={
                  rarity === "Common"
                    ? "text-amber-600"
                    : rarity === "Uncommon"
                    ? "text-slate-400"
                    : rarity === "Rare"
                    ? "text-yellow-500"
                    : rarity === "Legendary"
                    ? "text-white"
                    : "text-purple-500"
                }
              >
                ●
              </span>
              {rarity} Mods
              <span className="text-sm text-muted-foreground font-normal">
                ({sampleMods[rarity].length} samples)
              </span>
            </h2>

            <div className="flex flex-wrap gap-4">
              {sampleMods[rarity].length > 0 ? (
                sampleMods[rarity].map((mod) => (
                  <ModCard key={mod.uniqueName} mod={mod} />
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  No {rarity.toLowerCase()} mods found in the data
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
