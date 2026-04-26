/** Built-in map symbols — extend with `SymbolGlyph` / previews when adding ids. */
export const SYMBOL_LIBRARY = [
  // Landscape
  "tree", "bush", "sprinkler", "flower_bed", "bench", "fence_section",
  // Water / Pool
  "valve", "pump", "filter", "pool_ladder", "drain", "skimmer",
  // Mechanical
  "motor", "boiler", "hvac_unit", "compressor", "fan", "generator",
  // Electrical
  "electrical_panel", "outlet", "light_fixture", "emergency_light", "switch",
  // Ice / Arena
  "ice_resurfacer", "penalty_box", "goal_net", "scoreboard", "player_bench",
  // Safety
  "fire_extinguisher", "first_aid", "emergency_exit", "eyewash_station", "aed",
  // General Facility
  "camera", "lock", "storage_unit", "stairs", "elevator", "restroom",
] as const;
export type SymbolLibraryId = (typeof SYMBOL_LIBRARY)[number];

export type BlueprintSymbolCategory = {
  id: string;
  label: string;
  symbols: SymbolLibraryId[];
};

export const SYMBOL_CATEGORIES: BlueprintSymbolCategory[] = [
  { id: "landscape", label: "Landscape", symbols: ["tree", "bush", "sprinkler", "flower_bed", "bench", "fence_section"] },
  { id: "water", label: "Water / Pool", symbols: ["valve", "pump", "filter", "pool_ladder", "drain", "skimmer"] },
  { id: "mechanical", label: "Mechanical", symbols: ["motor", "boiler", "hvac_unit", "compressor", "fan", "generator"] },
  { id: "electrical", label: "Electrical", symbols: ["electrical_panel", "outlet", "light_fixture", "emergency_light", "switch"] },
  { id: "arena", label: "Ice / Arena", symbols: ["ice_resurfacer", "penalty_box", "goal_net", "scoreboard", "player_bench"] },
  { id: "safety", label: "Safety", symbols: ["fire_extinguisher", "first_aid", "emergency_exit", "eyewash_station", "aed"] },
  { id: "facility", label: "Facility", symbols: ["camera", "lock", "storage_unit", "stairs", "elevator", "restroom"] },
  { id: "devices", label: "Devices", symbols: ["sprinkler"] },
];

export const BLUEPRINT_SYMBOL_RECENT_KEY = "bp-blueprint-symbols-recent";
