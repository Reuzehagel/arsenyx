import { getAllMods } from "@/lib/warframe/mods";
import { ModsTestClient } from "./mods-test-client";

export default function ModsTestPage() {
  // Get sample mods for each rarity
  const allMods = getAllMods();

  const sampleMods = {
    Common: allMods.filter((m) => m.rarity === "Common").slice(0, 4),
    Uncommon: allMods.filter((m) => m.rarity === "Uncommon").slice(0, 4),
    Rare: allMods.filter((m) => m.rarity === "Rare").slice(0, 4),
    Legendary: allMods.filter((m) => m.rarity === "Legendary").slice(0, 4),
    Peculiar: allMods.filter((m) => m.rarity === "Peculiar").slice(0, 4),
  };

  return <ModsTestClient sampleMods={sampleMods} />;
}
