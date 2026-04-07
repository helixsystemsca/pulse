/** Built-in map symbols — extend with `SymbolGlyph` / previews when adding ids. */
export const SYMBOL_LIBRARY = ["tree", "bush", "sprinkler", "valve", "pump", "motor", "filter"] as const;
export type SymbolLibraryId = (typeof SYMBOL_LIBRARY)[number];

export type BlueprintSymbolCategory = {
  id: string;
  label: string;
  symbols: SymbolLibraryId[];
};

export const SYMBOL_CATEGORIES: BlueprintSymbolCategory[] = [
  { id: "devices", label: "Devices", symbols: ["sprinkler"] },
  { id: "equipment", label: "Equipment", symbols: ["pump", "filter"] },
  { id: "landscape", label: "Landscape", symbols: ["tree", "bush"] },
  { id: "electrical", label: "Electrical", symbols: ["motor"] },
  { id: "plumbing", label: "Plumbing", symbols: ["valve"] },
];

export const BLUEPRINT_SYMBOL_RECENT_KEY = "bp-blueprint-symbols-recent";
