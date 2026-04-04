/** Mock IoT / controller data for Monitoring → Systems (replace with live feeds later). */

export type Co2Tank = {
  id: number;
  name: string;
  location: string;
  /** Sensor range modeled as 250–1000; UI bar uses 0–1000 scale. */
  level: number;
};

export const co2Tanks: Co2Tank[] = [
  { id: 1, name: "Leisure Pool Tank A", location: "Leisure Pool", level: 280 },
  { id: 2, name: "Leisure Pool Tank B", location: "Leisure Pool", level: 650 },
  { id: 3, name: "Lap Pool Tank A", location: "Lap Pool", level: 920 },
  { id: 4, name: "Lap Pool Tank B", location: "Lap Pool", level: 310 },
  { id: 5, name: "Hot Tub Tank", location: "Hot Tub", level: 780 },
];

export type Co2TankStatus = "change_now" | "change_soon" | "ok";

export function getCo2TankStatus(level: number): Co2TankStatus {
  if (level < 300) return "change_now";
  if (level <= 350) return "change_soon";
  return "ok";
}

export function co2StatusLabel(status: Co2TankStatus): string {
  if (status === "change_now") return "Change now";
  if (status === "change_soon") return "Change soon";
  return "OK";
}

export type PoolController = {
  id: number;
  name: string;
  chlorine: number;
  ph: number;
  flow: number;
  temp: number;
  co2FeederActive: boolean;
  chlorineFeederActive: boolean;
};

export const poolControllers: PoolController[] = [
  {
    id: 1,
    name: "Leisure Pool Controller",
    chlorine: 2.1,
    ph: 7.4,
    flow: 120,
    temp: 28,
    co2FeederActive: true,
    chlorineFeederActive: false,
  },
  {
    id: 2,
    name: "Lap Pool Controller",
    chlorine: 1.8,
    ph: 7.6,
    flow: 140,
    temp: 26,
    co2FeederActive: false,
    chlorineFeederActive: true,
  },
  {
    id: 3,
    name: "Hot Tub Controller",
    chlorine: 3.5,
    ph: 7.2,
    flow: 90,
    temp: 38,
    co2FeederActive: true,
    chlorineFeederActive: true,
  },
];

export type PeopleMonitorRow = {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "offline";
};

export const mockPeopleRows: PeopleMonitorRow[] = [
  { id: "1", name: "Alex Chen", role: "Lifeguard", status: "active" },
  { id: "2", name: "Jordan Smith", role: "Maintenance", status: "idle" },
  { id: "3", name: "Sam Rivera", role: "Pool tech", status: "active" },
  { id: "4", name: "Taylor Brooks", role: "Supervisor", status: "offline" },
  { id: "5", name: "Riley Park", role: "Lifeguard", status: "active" },
];
