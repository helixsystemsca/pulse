# Blueprint Designer Polish — integration.md

## CURSOR PROMPT
"Read handoff/integration.md. Execute phases in order.
CREATE new files as specified. MODIFY existing files as specified.
Do not substitute existing components unless instructed.
Commit after each phase with the message provided."

---

## ANALYSIS (read before executing)

### What works well
- Full Konva canvas with zones, devices, doors, symbols, connections
- Layers panel with drag reorder
- Task overlays linked to canvas elements
- Undo/redo via useBlueprintHistory
- PNG + PDF export
- Save/load to API with error handling
- Symbol library with recent tracking
- Immersive fullscreen mode

### Gaps identified
1. **Tool rail has no labels visible** — 10 icon-only buttons with no text. Non-technical users don't know what half of them do.
2. **Symbol library is tiny** — only 7 symbols: tree, bush, sprinkler, valve, pump, motor, filter. No arena/rink, HVAC, electrical, plumbing, or general facility symbols.
3. **Float context panel is a floating chip strip** — editing element name, notes, and zone happens in a cramped horizontal strip. Easy to miss, hard to use on mobile.
4. **No starter templates** — blank canvas every time. A "Start from template" option would cut friction dramatically for new users.
5. **Task panel is text-only** — tasks/instructions attached to elements but no visual indicator on the canvas element itself that it HAS instructions.
6. **No procedure linking** — procedures module exists in the app but blueprints can't reference a procedure by ID. High value connection.
7. **Mobile UX is poor** — tool rail is vertical on desktop only. Touch targets are too small. No pinch-to-zoom on mobile.
8. **Read-only view lacks instruction mode** — BlueprintReadOnlyCanvas renders the drawing but doesn't show task overlays. Workers using it as an operational guide can't see the instructions.

### Integration opportunities
- **Zones** — `assigned_zone_id` exists on elements but is a raw select. Should show zone name + color badge.
- **Procedures** — add `linked_procedure_id` to `TaskOverlay`. When set, clicking a task in read-only view opens the procedure.
- **Equipment** — `linked_device_id` exists but shows a plain `<select>`. Should show equipment name + PM status badge.
- **Telemetry** — beacon positions can be overlaid on the read-only canvas (already planned in UnifiedFacilityMap).

---

## PHASE 1 — Tool Rail Labels (Quick Win)
**Effort: 30min | Impact: High for non-technical users**

=== MODIFY: frontend/components/zones-devices/BlueprintToolRail.tsx ===
ACTION: add visible labels below each icon button

FIND the className on each motion.button:
```
className={`bp-tool-rail__btn${active ? " is-active" : ""}`}
```

REPLACE with:
```
className={`bp-tool-rail__btn${active ? " is-active" : ""}`}
```
Then inside each button, wrap the existing Icon with a label:
```tsx
<item.Icon className="bp-tool-rail__icon" strokeWidth={1.75} size={18} aria-hidden />
<span className="bp-tool-rail__label">{item.label}</span>
```

Do the same for the symbols button — add:
```tsx
<item.Icon className="bp-tool-rail__icon" strokeWidth={1.75} size={18} aria-hidden />
<span className="bp-tool-rail__label">{item.label}</span>
```

=== MODIFY: frontend/components/zones-devices/blueprint-designer.css ===
ACTION: add label styles to tool rail buttons

Add after the `.bp-tool-rail__icon` rule:
```css
.bp-tool-rail__label {
  display: block;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--bp-muted);
  text-align: center;
  line-height: 1.2;
  margin-top: 2px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 48px;
}

.bp-tool-rail__btn.is-active .bp-tool-rail__label {
  color: var(--bp-text);
}

.bp-tool-rail__btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px 6px;
  min-width: 52px;
}
```

Commit: `feat(blueprint): add visible tool labels to tool rail`

---

## PHASE 2 — Expand Symbol Library
**Effort: 45min | Impact: High — current library is too small**

=== MODIFY: frontend/components/zones-devices/blueprint-symbols-shared.ts ===
ACTION: replace entire SYMBOL_LIBRARY and SYMBOL_CATEGORIES

```ts
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

export const SYMBOL_CATEGORIES: BlueprintSymbolCategory[] = [
  { id: "landscape",  label: "Landscape",  symbols: ["tree", "bush", "sprinkler", "flower_bed", "bench", "fence_section"] },
  { id: "water",      label: "Water / Pool", symbols: ["valve", "pump", "filter", "pool_ladder", "drain", "skimmer"] },
  { id: "mechanical", label: "Mechanical", symbols: ["motor", "boiler", "hvac_unit", "compressor", "fan", "generator"] },
  { id: "electrical", label: "Electrical", symbols: ["electrical_panel", "outlet", "light_fixture", "emergency_light", "switch"] },
  { id: "arena",      label: "Ice / Arena", symbols: ["ice_resurfacer", "penalty_box", "goal_net", "scoreboard", "player_bench"] },
  { id: "safety",     label: "Safety",     symbols: ["fire_extinguisher", "first_aid", "emergency_exit", "eyewash_station", "aed"] },
  { id: "facility",   label: "Facility",   symbols: ["camera", "lock", "storage_unit", "stairs", "elevator", "restroom"] },
  { id: "devices",    label: "Devices",    symbols: ["sprinkler"] },
];
```

Commit: `feat(blueprint): expand symbol library with facility, arena, safety categories`

---

## PHASE 3 — Task Indicator on Canvas Elements
**Effort: 45min | Impact: High — workers can't tell which elements have instructions**

=== MODIFY: frontend/components/zones-devices/BlueprintDesigner.tsx ===
ACTION: add a small indicator badge to elements that have linked tasks

Find the section where zones/elements are rendered on the Konva canvas
(look for `elements.map` or similar inside the Stage/Layer render).

For each element being rendered, check if it has linked tasks:
```tsx
const elementTaskCount = useMemo(() => {
  const map = new Map<string, number>();
  tasks.forEach(task => {
    task.linked_element_ids.forEach(id => {
      map.set(id, (map.get(id) ?? 0) + 1);
    });
  });
  return map;
}, [tasks]);
```

Then when rendering each element's label/name on canvas, if `elementTaskCount.get(el.id) > 0`:
- Add a small blue dot indicator (Konva Circle, radius 5, fill "#3b82f6")
- Position it at top-right corner of the element bounding box
- Add a tooltip-style text showing count: `elementTaskCount.get(el.id)` tasks

Commit: `feat(blueprint): show task count indicator on canvas elements with linked tasks`

---

## PHASE 4 — Starter Templates
**Effort: 1hr | Impact: High — removes blank canvas friction**

=== FILE: frontend/components/zones-devices/BlueprintTemplates.ts ===

```ts
import type { BlueprintElement, BlueprintLayer } from "./blueprint-types";
import { v4 as uuid } from "uuid";

export type BlueprintTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  elements: () => BlueprintElement[];
  layers: () => BlueprintLayer[];
};

function baseLayer(): BlueprintLayer {
  return { id: uuid(), name: "Floor Plan" };
}

export const BLUEPRINT_TEMPLATES: BlueprintTemplate[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "Start from scratch",
    icon: "square-dashed",
    elements: () => [],
    layers: () => [baseLayer()],
  },
  {
    id: "pool-area",
    name: "Pool area",
    description: "Main pool, hot tub, and mechanical room",
    icon: "waves",
    elements: () => {
      const lid = uuid();
      return [
        { id: uuid(), type: "zone", x: 40,  y: 40,  width: 500, height: 350, name: "Main Pool",       layer_id: lid, cornerRadius: 8  },
        { id: uuid(), type: "zone", x: 580, y: 40,  width: 180, height: 180, name: "Hot Tub",         layer_id: lid, cornerRadius: 90 },
        { id: uuid(), type: "zone", x: 580, y: 260, width: 180, height: 130, name: "Mechanical Room", layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "symbol", symbol_type: "pump",   x: 610, y: 290, name: "Pool Pump"   },
        { id: uuid(), type: "symbol", symbol_type: "filter", x: 660, y: 290, name: "Filter"      },
        { id: uuid(), type: "symbol", symbol_type: "boiler", x: 700, y: 290, name: "Boiler"      },
      ] as BlueprintElement[];
    },
    layers: () => [{ id: uuid(), name: "Pool Level" }],
  },
  {
    id: "ice-rink",
    name: "Ice rink",
    description: "Standard hockey rink with benches and penalty boxes",
    icon: "snowflake",
    elements: () => {
      const lid = uuid();
      return [
        { id: uuid(), type: "zone",    x: 40,  y: 80,  width: 680, height: 300, name: "Ice Surface",    layer_id: lid, cornerRadius: 40 },
        { id: uuid(), type: "zone",    x: 40,  y: 20,  width: 200, height: 55,  name: "Home Bench",     layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "zone",    x: 260, y: 20,  width: 80,  height: 55,  name: "Penalty Box",    layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "zone",    x: 360, y: 20,  width: 80,  height: 55,  name: "Penalty Box",    layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "zone",    x: 460, y: 20,  width: 200, height: 55,  name: "Away Bench",     layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "zone",    x: 40,  y: 390, width: 200, height: 60,  name: "Zamboni Room",   layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "symbol",  symbol_type: "ice_resurfacer", x: 60, y: 405, name: "Zamboni" },
      ] as BlueprintElement[];
    },
    layers: () => [{ id: uuid(), name: "Rink Level" }],
  },
  {
    id: "maintenance-bay",
    name: "Maintenance bay",
    description: "Workshop with storage and equipment areas",
    icon: "wrench",
    elements: () => {
      const lid = uuid();
      return [
        { id: uuid(), type: "zone", x: 40,  y: 40,  width: 400, height: 300, name: "Workshop",      layer_id: lid, cornerRadius: 4 },
        { id: uuid(), type: "zone", x: 460, y: 40,  width: 200, height: 140, name: "Parts Storage", layer_id: lid, cornerRadius: 4 },
        { id: uuid(), type: "zone", x: 460, y: 200, width: 200, height: 140, name: "Tool Storage",  layer_id: lid, cornerRadius: 4 },
        { id: uuid(), type: "symbol", symbol_type: "electrical_panel", x: 60,  y: 60,  name: "Panel"      },
        { id: uuid(), type: "symbol", symbol_type: "fire_extinguisher", x: 400, y: 60,  name: "Extinguisher" },
        { id: uuid(), type: "symbol", symbol_type: "first_aid",         x: 400, y: 100, name: "First Aid"  },
      ] as BlueprintElement[];
    },
    layers: () => [{ id: uuid(), name: "Bay Level" }],
  },
  {
    id: "garden-grounds",
    name: "Garden / grounds",
    description: "Outdoor area with planted beds, irrigation, and paths",
    icon: "trees",
    elements: () => {
      const lid = uuid();
      return [
        { id: uuid(), type: "zone",   x: 40,  y: 40,  width: 600, height: 400, name: "Grounds Area",  layer_id: lid, cornerRadius: 8  },
        { id: uuid(), type: "zone",   x: 60,  y: 60,  width: 200, height: 120, name: "Flower Bed A", layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "zone",   x: 60,  y: 220, width: 200, height: 120, name: "Flower Bed B", layer_id: lid, cornerRadius: 4  },
        { id: uuid(), type: "symbol", symbol_type: "sprinkler", x: 100, y: 100, name: "Sprinkler 1" },
        { id: uuid(), type: "symbol", symbol_type: "sprinkler", x: 200, y: 100, name: "Sprinkler 2" },
        { id: uuid(), type: "symbol", symbol_type: "valve",     x: 60,  y: 380, name: "Main Valve"  },
        { id: uuid(), type: "symbol", symbol_type: "tree",      x: 450, y: 100, name: "Tree"        },
        { id: uuid(), type: "symbol", symbol_type: "tree",      x: 500, y: 200, name: "Tree"        },
        { id: uuid(), type: "symbol", symbol_type: "bench",     x: 450, y: 300, name: "Bench"       },
      ] as BlueprintElement[];
    },
    layers: () => [{ id: uuid(), name: "Grounds" }],
  },
];
```

=== FILE: frontend/components/zones-devices/BlueprintTemplateModal.tsx ===

```tsx
"use client";

import { X } from "lucide-react";
import { BLUEPRINT_TEMPLATES, type BlueprintTemplate } from "./BlueprintTemplates";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (template: BlueprintTemplate) => void;
};

const ICON_MAP: Record<string, string> = {
  "square-dashed": "⬜",
  "waves":         "🏊",
  "snowflake":     "❄️",
  "wrench":        "🔧",
  "trees":         "🌳",
};

export function BlueprintTemplateModal({ open, onClose, onSelect }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Start from a template</h2>
            <p className="text-xs text-slate-400 mt-0.5">Or start blank and build your own</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {BLUEPRINT_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => { onSelect(t); onClose(); }}
              className="flex flex-col items-start gap-2 rounded-lg border border-slate-700 bg-slate-800 p-4 text-left hover:border-blue-500 hover:bg-slate-750 transition-colors group">
              <span className="text-2xl">{ICON_MAP[t.icon] ?? "📋"}</span>
              <div>
                <p className="text-sm font-semibold text-slate-100 group-hover:text-blue-300">
                  {t.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {t.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

=== MODIFY: frontend/components/zones-devices/BlueprintDesigner.tsx ===
ACTION: wire template modal into the designer

1. Add imports near top of file:
```tsx
import { BlueprintTemplateModal } from "./BlueprintTemplateModal";
import { BLUEPRINT_TEMPLATES, type BlueprintTemplate } from "./BlueprintTemplates";
```

2. Add state near other useState declarations:
```tsx
const [templateModalOpen, setTemplateModalOpen] = useState(false);
```

3. Add template apply handler near other callbacks:
```tsx
const applyTemplate = useCallback((template: BlueprintTemplate) => {
  const newElements = template.elements();
  const newLayers   = template.layers();
  commitElements(() => newElements);
  // TODO: also apply layers via commitLayers if that function exists, else set state directly
  setTemplateModalOpen(false);
}, [commitElements]);
```

4. Find the "New blueprint" button or the topbar area in the immersive header.
   Add a "Templates" button next to it:
```tsx
<button
  type="button"
  className="bp-btn bp-btn--ghost"
  onClick={() => setTemplateModalOpen(true)}
  title="Start from a template"
>
  Templates
</button>
```

5. Add the modal at the bottom of the return statement, before the closing tag:
```tsx
<BlueprintTemplateModal
  open={templateModalOpen}
  onClose={() => setTemplateModalOpen(false)}
  onSelect={applyTemplate}
/>
```

Commit: `feat(blueprint): add starter templates (pool, rink, maintenance, garden)`

---

## PHASE 5 — Read-Only Canvas Shows Task Instructions
**Effort: 45min | Impact: Critical for operational use**

=== MODIFY: frontend/components/zones-devices/FloorPlanBlueprintSection.tsx ===
ACTION: pass tasks to BlueprintReadOnlyCanvas and show instruction panel alongside

1. When loading blueprint detail, also parse tasks from the API response:
```tsx
// Add to BlueprintDetail type:
tasks?: Array<{ id: string; title: string; mode: string; content: string | string[]; linked_element_ids: string[] }>;
```

2. Add state for selected task element:
```tsx
const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
```

3. Below the `<BlueprintReadOnlyCanvas>` component, add a task panel:
```tsx
{selectedBlueprint?.tasks && selectedBlueprint.tasks.length > 0 && (
  <div className="mt-3 rounded-md border border-ds-border bg-ds-primary p-3">
    <p className="text-[10px] font-bold uppercase tracking-wider text-ds-muted mb-2">
      Instructions — tap an element to see its tasks
    </p>
    {selectedElementId && selectedBlueprint.tasks
      .filter(t => t.linked_element_ids.includes(selectedElementId))
      .map(task => (
        <div key={task.id} className="mb-3 last:mb-0">
          <p className="text-xs font-semibold text-ds-foreground mb-1">{task.title}</p>
          {task.mode === "steps" && Array.isArray(task.content)
            ? (task.content as string[]).map((step, i) => (
                <div key={i} className="flex gap-2 text-xs text-ds-muted mb-1">
                  <span className="shrink-0 font-bold text-ds-accent">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))
            : <p className="text-xs text-ds-muted">{task.content as string}</p>
          }
        </div>
      ))
    }
    {selectedElementId && selectedBlueprint.tasks.filter(t =>
      t.linked_element_ids.includes(selectedElementId)).length === 0 && (
      <p className="text-xs text-ds-muted">No instructions for this element.</p>
    )}
    {!selectedElementId && (
      <p className="text-xs text-ds-muted">Tap any room or element on the map above.</p>
    )}
  </div>
)}
```

Commit: `feat(blueprint): show task instructions in read-only view when element tapped`

---

---

## PHASE 6 — Lock Persistence + Unlock All Button
**Effort: 30min | Root cause: lock only toggled via selectedIds which clears on deselect**

### Root cause
`toggleLockSelection` only operates on `selectedIds`. Once you click away
selectedIds clears and there is no way to unlock without re-selecting the element.
Locked elements resist re-selection. Need: (a) locked elements still selectable
in select mode, and (b) a global Unlock All button.

=== MODIFY: frontend/components/zones-devices/BlueprintDesigner.tsx ===

Change A — Add unlockAll callback near toggleLockSelection (~line 1887):
```tsx
const unlockAll = useCallback(() => {
  commitElements((prev) => prev.map((e) => ({ ...e, locked: undefined })));
  batchLayer();
}, [commitElements, batchLayer]);
```

Change B — Allow selecting locked elements in select mode.
Find the pointer-down hit detection where locked elements are skipped.
Find this pattern:
```tsx
if (hitEl && isBlueprintElementEffectivelyLocked(cur, hitEl)) return;
```
Change to allow selection but not transform:
```tsx
if (hitEl && isBlueprintElementEffectivelyLocked(cur, hitEl)) {
  setSelectedIds([hitEl.id]);
  return;
}
```

Change C — Add Unlock All button to immersive topbar near line 3577.
Find the bp-immersive-topbar div. Add after the title span:
```tsx
{elements.some(e => e.locked) && (
  <button
    type="button"
    className="bp-btn bp-btn--ghost"
    onClick={unlockAll}
    title="Unlock all locked elements"
  >
    Unlock All
  </button>
)}
```

Commit: `fix(blueprint): lock persists after deselect, add Unlock All button`

---

## PHASE 7 — Finer Grid for Pen + Free Draw Tools
**Effort: 20min | GRID=32px too coarse for tracing underlay drawings**

=== MODIFY: frontend/components/zones-devices/BlueprintDesigner.tsx ===

Change A — Add fine grid constant and state near line 150:
```tsx
const GRID = 32;
const GRID_FINE = 8;
```
Add state near other useState declarations:
```tsx
const [fineGrid, setFineGrid] = useState(false);
```

Change B — Use fineGrid for pen path snapping (~lines 2610-2611).
FIND:
```tsx
const wx = Math.round(w0.x / GRID) * GRID;
const wy = Math.round(w0.y / GRID) * GRID;
```
REPLACE WITH:
```tsx
const activeGrid = fineGrid ? GRID_FINE : GRID;
const wx = Math.round(w0.x / activeGrid) * activeGrid;
const wy = Math.round(w0.y / activeGrid) * activeGrid;
```

Change C — Use fineGrid for pen anchor snapping (~lines 2746-2756).
Find the two instances of:
```tsx
x: Math.round(w.x / GRID) * GRID,
y: Math.round(w.y / GRID) * GRID,
```
Inside the draw-pen tool handler blocks, replace with:
```tsx
x: Math.round(w.x / (fineGrid ? GRID_FINE : GRID)) * (fineGrid ? GRID_FINE : GRID),
y: Math.round(w.y / (fineGrid ? GRID_FINE : GRID)) * (fineGrid ? GRID_FINE : GRID),
```

Change D — Add grid toggle button in topbar near Unlock All:
```tsx
<button
  type="button"
  className="bp-btn bp-btn--ghost"
  onClick={() => setFineGrid(f => !f)}
  title={fineGrid ? "Switch to coarse grid (32px)" : "Switch to fine grid (8px)"}
>
  {fineGrid ? "Grid: Fine (8px)" : "Grid: Coarse (32px)"}
</button>
```

Commit: `feat(blueprint): add fine grid toggle (8px) for pen and free-draw tracing`

---

## PHASE 8 — Remove Room Tool, All Shapes Are Rooms by Default
**Effort: 45min | rectangle/ellipse/polygon should have same door-snap as zones**

### What makes zone different from rectangle/ellipse/polygon
- type zone enables wall attachment for doors
- type zone enables door snapping via ZONE_EDGE_HIT_PX logic
- type zone renders with special zone fill + outline style
- rectangle/ellipse/polygon are generic with no door snap

### Strategy
- Remove draw-room from tool rail
- Make draw-rectangle, draw-ellipse, draw-polygon create type zone by default
- All drawn shapes get room interactivity automatically
- Add is_room boolean to allow decorative-only shapes when needed

=== MODIFY: frontend/components/zones-devices/blueprint-types.ts ===

In BlueprintElement add after locked field:
```ts
is_room?: boolean;
```

In BlueprintDesignerTool remove "draw-room":
```ts
export type BlueprintDesignerTool =
  | "select"
  | "draw-rectangle"
  | "draw-ellipse"
  | "draw-polygon"
  | "place-device"
  | "place-door"
  | "free-draw"
  | "draw-pen"
  | "place-symbol";
```

=== MODIFY: frontend/components/zones-devices/BlueprintToolRail.tsx ===

FIND and DELETE from RAIL_ITEMS:
```tsx
{ kind: "tool", tool: "draw-room", label: "Draw room", Icon: LayoutGrid },
```
Remove LayoutGrid from lucide-react import if no longer used.

=== MODIFY: frontend/components/zones-devices/BlueprintDesigner.tsx ===

Change A — All drawn shapes create type zone.
Find (~line 4009):
```tsx
const mode = tool === "draw-room" ? "zone" : tool === "draw-rectangle" ? "rectangle" : "ellipse";
```
Replace with:
```tsx
const mode = "zone";
```

Find where draw-rectangle creates element with type: "rectangle" (~line 2540).
Replace with type: "zone".
Find where draw-ellipse creates element. Replace type with "zone".

Change B — Add Is room toggle in float context panel for zone elements.
After the name input in the float context panel, add:
```tsx
{selected.type === "zone" && (
  <label className="bp-float-context__compact">
    <span>Is a room</span>
    <input
      type="checkbox"
      checked={selected.is_room !== false}
      onChange={(e) => updateSelectedField({ is_room: e.target.checked })}
    />
  </label>
)}
```

Change C — Door snap respects is_room flag.
Find the door snapping zone check (~line 443):
```tsx
if (z.type !== "zone") continue;
```
Replace with:
```tsx
if (z.type !== "zone" || z.is_room === false) continue;
```

Change D — Replace all tool === "draw-room" occurrences.
Search the entire file for tool === "draw-room".
Replace each occurrence with tool === "draw-rectangle".
There are approximately 8-10 occurrences. Replace ALL of them.

Commit: `feat(blueprint): all shapes are rooms by default, remove redundant draw-room tool`

---

## EXECUTION STEPS
1. Modify BlueprintToolRail.tsx + blueprint-designer.css (Phase 1)
2. Modify blueprint-symbols-shared.ts (Phase 2)
3. Modify BlueprintDesigner.tsx — elementTaskCount + canvas indicators (Phase 3)
4. Create BlueprintTemplates.ts (Phase 4)
5. Create BlueprintTemplateModal.tsx (Phase 4)
6. Modify BlueprintDesigner.tsx — wire template modal (Phase 4)
7. Modify FloorPlanBlueprintSection.tsx — read-only task panel (Phase 5)
8. Modify BlueprintDesigner.tsx — unlockAll + lock select fix (Phase 6)
9. Modify BlueprintDesigner.tsx — GRID_FINE + fineGrid toggle (Phase 7)
10. Modify blueprint-types.ts — add is_room, remove draw-room tool type (Phase 8)
11. Modify BlueprintToolRail.tsx — remove draw-room from RAIL_ITEMS (Phase 8)
12. Modify BlueprintDesigner.tsx — all shapes to zone type + door snap fix (Phase 8)
13. git add -A && git commit -m "feat(blueprint): tool labels, symbols, templates, task indicators, lock fix, fine grid, unified room shapes"
14. git push origin main

---

## VALIDATION
- [ ] Tool rail shows text labels under each icon
- [ ] Symbol panel has 7 categories with new symbols
- [ ] Templates button visible in blueprint topbar
- [ ] Template modal opens and selecting populates canvas
- [ ] Elements with linked tasks show blue dot indicator
- [ ] Read-only view shows instruction panel below canvas
- [ ] Tapping element in read-only view shows linked tasks
- [ ] Unlock All button appears in topbar when locked elements exist
- [ ] Locked elements can be selected (to unlock via context panel)
- [ ] Grid toggle button switches between 32px and 8px snap
- [ ] Pen tool snaps to 8px grid when fine mode active
- [ ] draw-room tool no longer appears in tool rail
- [ ] Drawing a rectangle/ellipse/polygon creates a zone (door-snappable)
- [ ] Is room checkbox visible in context panel for zone elements
- [ ] Unchecking Is room disables door snapping for that shape
- [ ] Vercel build passes

---

## MVP UPGRADE ROADMAP (for reference, not in this integration.md)

DO FIRST (this integration.md):
- Tool labels ✓
- Expanded symbol library ✓
- Starter templates ✓
- Task indicators on canvas ✓
- Read-only instruction panel ✓

THEN (next session):
- Procedure linking on TaskOverlay (linked_procedure_id field)
- Element side panel replacing float chip strip (proper name/notes/zone editor)
- Mobile toolbar (horizontal bottom rail on small screens)

LATER:
- Blueprint as a widget in the dashboard
- Beacon position overlay on read-only canvas
- Print-optimised export with task list appended
