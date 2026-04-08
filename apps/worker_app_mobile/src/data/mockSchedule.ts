import type { ScheduleSlot } from "@/types/models";

export const MOCK_MY_SCHEDULE: ScheduleSlot[] = [
  {
    id: "s1",
    title: "Opening rounds",
    startLabel: "06:00",
    endLabel: "08:00",
    locationLabel: "Site-wide",
  },
  {
    id: "s2",
    title: "Pump inspection",
    startLabel: "09:00",
    endLabel: "11:30",
    locationLabel: "Boiler Room",
  },
  {
    id: "s3",
    title: "Vendor escort — HVAC",
    startLabel: "13:00",
    endLabel: "15:00",
    locationLabel: "Roof MECH-2",
  },
];

export const MOCK_TEAM_SCHEDULE: ScheduleSlot[] = [
  {
    id: "ts1",
    title: "Pool chemical check",
    startLabel: "07:00",
    endLabel: "07:45",
    locationLabel: "Aquatics",
    workerName: "Jordan Lee",
  },
  {
    id: "ts2",
    title: "Generator test",
    startLabel: "10:00",
    endLabel: "11:00",
    locationLabel: "Electrical yard",
    workerName: "Sam Rivera",
  },
  {
    id: "ts3",
    title: "Your shift overlap",
    startLabel: "14:00",
    endLabel: "22:00",
    locationLabel: "Command center",
    workerName: "You",
  },
];
