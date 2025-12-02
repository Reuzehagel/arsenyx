"use client";

import { useState } from "react";
import { ModCard } from "@/components/mod-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
  const [size, setSize] = useState<"compact" | "large">("large");
  const [showStats, setShowStats] = useState(true);
  const [selectedMod, setSelectedMod] = useState<string | null>(null);
  const [customRank, setCustomRank] = useState<number | null>(null);

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
          Testing compact and large mod card variants for all rarities
        </p>
      </div>

      {/* Controls */}
      <div className="mb-8 p-4 bg-card rounded-lg border space-y-4">
        <h2 className="text-lg font-semibold mb-4">Controls</h2>

        <div className="flex flex-wrap gap-6">
          {/* Size Toggle */}
          <div className="flex items-center gap-3">
            <Label htmlFor="size-toggle">Card Size:</Label>
            <div className="flex items-center gap-2">
              <span
                className={
                  size === "compact"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                Compact
              </span>
              <Switch
                id="size-toggle"
                checked={size === "large"}
                onCheckedChange={(checked) =>
                  setSize(checked ? "large" : "compact")
                }
              />
              <span
                className={
                  size === "large" ? "text-foreground" : "text-muted-foreground"
                }
              >
                Large
              </span>
            </div>
          </div>

          {/* Show Stats Toggle (large only) */}
          {size === "large" && (
            <div className="flex items-center gap-3">
              <Label htmlFor="stats-toggle">Show Stats:</Label>
              <Switch
                id="stats-toggle"
                checked={showStats}
                onCheckedChange={setShowStats}
              />
            </div>
          )}

          {/* Custom Rank Slider */}
          <div className="flex items-center gap-3 min-w-[200px]">
            <Label>Custom Rank:</Label>
            <Slider
              value={[customRank ?? 10]}
              onValueChange={(v) => setCustomRank(v[0])}
              min={0}
              max={10}
              step={1}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-8">
              {customRank ?? "Max"}
            </span>
          </div>
        </div>
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

            <div
              className={
                size === "compact"
                  ? "flex flex-wrap gap-3"
                  : "flex flex-wrap gap-4"
              }
            >
              {sampleMods[rarity].length > 0 ? (
                sampleMods[rarity].map((mod) => (
                  <ModCard
                    key={mod.uniqueName}
                    mod={mod}
                    size={size}
                    rank={
                      customRank !== null
                        ? Math.min(customRank, mod.fusionLimit)
                        : undefined
                    }
                    showStats={showStats}
                    isSelected={selectedMod === mod.uniqueName}
                    onClick={() =>
                      setSelectedMod(
                        selectedMod === mod.uniqueName ? null : mod.uniqueName
                      )
                    }
                  />
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

      {/* Selected Mod Details */}
      {selectedMod && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card border rounded-lg p-4 shadow-xl">
          <h3 className="font-semibold mb-2">Selected Mod</h3>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
            {JSON.stringify(
              [...Object.values(sampleMods)]
                .flat()
                .find((m) => m.uniqueName === selectedMod),
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
