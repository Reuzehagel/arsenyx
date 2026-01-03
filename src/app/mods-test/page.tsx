import { getAllMods } from "@/lib/warframe/mods";
import { ModsTestClient } from "./mods-test-client";

export default function ModsTestPage() {
  // Get sample mods for each rarity
  const allMods = getAllMods();

  // Find specific iconic mods
  const vitality = allMods.find((m) => m.name === "Vitality");

  const sampleMods = {
    Common: [
      vitality,
      ...allMods
        .filter((m) => m.rarity === "Common" && m.name !== "Vitality")
        .slice(0, 3),
    ].filter(Boolean) as typeof allMods,
    Uncommon: allMods.filter((m) => m.rarity === "Uncommon").slice(0, 4),
    Rare: allMods.filter((m) => m.rarity === "Rare").slice(0, 4),
    Legendary: allMods.filter((m) => m.rarity === "Legendary").slice(0, 4),
    Peculiar: allMods.filter((m) => m.rarity === "Peculiar").slice(0, 4),
    Amalgam: allMods.filter((m) => m.rarity === "Amalgam").slice(0, 4),
    Galvanized: allMods.filter((m) => m.rarity === "Galvanized").slice(0, 4),
  };

  return <ModsTestClient sampleMods={sampleMods} />;
}
