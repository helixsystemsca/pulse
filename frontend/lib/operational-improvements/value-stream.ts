export type ValueStreamStep = {
  id: string;
  step_name: string;
  description: string;
  responsible_party: string;
  cycle_time_minutes: string;
  wait_time_minutes: string;
  pain_points: string;
  value_added: "yes" | "no" | "";
};

export type ValueStreamMapData = {
  map_type: "current" | "future";
  steps: ValueStreamStep[];
};

export function emptyValueStreamStep(): ValueStreamStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    step_name: "",
    description: "",
    responsible_party: "",
    cycle_time_minutes: "",
    wait_time_minutes: "",
    pain_points: "",
    value_added: "",
  };
}

export function parseMinutes(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function computeValueStreamTotals(steps: ValueStreamStep[]) {
  let totalCycle = 0;
  let totalWait = 0;
  let valueAdded = 0;
  let nonValueAdded = 0;
  for (const s of steps) {
    const cycle = parseMinutes(s.cycle_time_minutes);
    const wait = parseMinutes(s.wait_time_minutes);
    totalCycle += cycle;
    totalWait += wait;
    if (s.value_added === "yes") valueAdded += cycle;
    else if (s.value_added === "no") nonValueAdded += cycle;
  }
  return { totalCycle, totalWait, valueAdded, nonValueAdded };
}
