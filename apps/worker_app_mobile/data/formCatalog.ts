export type FormField =
  | { id: string; type: "check"; label: string }
  | { id: string; type: "note"; label: string; placeholder?: string };

export type FormDefinition = {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
};

export const FORM_CATALOG: FormDefinition[] = [
  {
    id: "vehicle",
    name: "Vehicle Inspection",
    description: "Quick pre-trip checks — tap to confirm.",
    fields: [
      { id: "lights", type: "check", label: "Lights & signals OK" },
      { id: "tires", type: "check", label: "Tires & pressure OK" },
      { id: "fluids", type: "check", label: "Fluids & leaks OK" },
      { id: "cab", type: "check", label: "Cab clean / safety kit present" },
      { id: "notes", type: "note", label: "Notes", placeholder: "Optional details" },
    ],
  },
  {
    id: "daily",
    name: "Daily Facility Checklist",
    description: "Pool & mechanical walkthrough.",
    fields: [
      { id: "pumps", type: "check", label: "Pump room visual OK" },
      { id: "chemicals", type: "check", label: "Chemical storage secure" },
      { id: "deck", type: "check", label: "Deck / gates safe" },
      { id: "sensors", type: "check", label: "Sensor panels responding" },
      { id: "notes", type: "note", label: "Handover notes", placeholder: "Anything for the next shift?" },
    ],
  },
];

export function getFormById(id: string): FormDefinition | undefined {
  return FORM_CATALOG.find((f) => f.id === id);
}
