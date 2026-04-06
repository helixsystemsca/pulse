import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../components/dashboard/OperationalDashboard.tsx");
let s = fs.readFileSync(p, "utf8");

const reps = [
  [/ring-offset-stealth-card/g, "ring-offset-white dark:ring-offset-[#111827]"],
  [/ring-stealth-card/g, "ring-white dark:ring-[#111827]"],
  [/ring-stealth-accent\/25/g, "ring-blue-300 dark:ring-blue-500/30"],
  [/ring-stealth-success\/45/g, "ring-emerald-400 dark:ring-emerald-500/45"],
  [/ring-stealth-success\/35/g, "ring-emerald-300 dark:ring-emerald-500/35"],
  [/ring-stealth-success\/20/g, "ring-emerald-300 dark:ring-emerald-500/25"],
  [/ring-stealth-success\/25/g, "ring-emerald-300 dark:ring-emerald-500/30"],
  [/ring-stealth-warning\/35/g, "ring-amber-300 dark:ring-amber-500/35"],
  [/ring-stealth-warning\/30/g, "ring-amber-300 dark:ring-amber-500/35"],
  [/ring-stealth-warning\/25/g, "ring-amber-300 dark:ring-amber-500/25"],
  [/ring-stealth-warning\/20/g, "ring-amber-200 dark:ring-amber-500/20"],
  [/ring-stealth-danger\/35/g, "ring-red-300 dark:ring-red-500/40"],
  [/ring-stealth-danger\/25/g, "ring-red-300 dark:ring-red-500/30"],
  [/ring-stealth-border/g, "ring-gray-200 dark:ring-[#1F2937]"],
  [/shadow-stealth-card/g, "shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"],
  [/hover:text-stealth-accent\/80/g, "hover:text-blue-700 dark:hover:text-blue-300"],
  [/text-stealth-warning\/90/g, "text-amber-700 dark:text-amber-400"],
  [/text-stealth-danger\/90/g, "text-red-700 dark:text-red-400"],
  [/bg-stealth-card\/40/g, "bg-white/80 dark:bg-[#111827]/50"],
  [/bg-stealth-main\/60/g, "bg-gray-100/90 dark:bg-[#0B0F14]/60"],
  [/bg-stealth-main\/50/g, "bg-gray-100 dark:bg-[#0F172A]/70"],
  [/bg-stealth-main\/40/g, "bg-gray-100/80 dark:bg-[#0B0F14]/45"],
  [/bg-stealth-main\/35/g, "bg-gray-100/70 dark:bg-[#0B0F14]/40"],
  [/bg-stealth-main\/30/g, "bg-gray-50 dark:bg-[#0B0F14]/35"],
  [/bg-stealth-warning\/\[0\.06\]/g, "bg-amber-100/60 dark:bg-amber-500/10"],
  [/bg-stealth-danger\/\[0\.06\]/g, "bg-red-100/60 dark:bg-red-500/10"],
  [/bg-stealth-success\/15/g, "bg-emerald-100/85 dark:bg-emerald-500/12"],
  [/bg-stealth-success\/10/g, "bg-emerald-100/90 dark:bg-emerald-500/15"],
  [/bg-stealth-success/g, "bg-emerald-500 dark:bg-emerald-400"],
  [/bg-stealth-warning\/12/g, "bg-amber-100/80 dark:bg-amber-500/12"],
  [/bg-stealth-warning\/10/g, "bg-amber-100/90 dark:bg-amber-500/12"],
  [/bg-stealth-warning\/20/g, "bg-amber-100 dark:bg-amber-500/18"],
  [/bg-stealth-danger\/15/g, "bg-red-100/90 dark:bg-red-500/15"],
  [/bg-stealth-danger\/10/g, "bg-red-100/85 dark:bg-red-500/12"],
  [/bg-stealth-accent\/15/g, "bg-blue-100 dark:bg-blue-500/20"],
  [/bg-stealth-accent\/10/g, "bg-blue-50 dark:bg-blue-500/15"],
  [/bg-stealth-danger\/80/g, "bg-red-500 dark:bg-red-500/90"],
  [/bg-stealth-warning\/80/g, "bg-amber-500 dark:bg-amber-400/90"],
  [/text-stealth-secondary/g, "text-gray-500 dark:text-gray-400"],
  [/text-stealth-muted/g, "text-gray-500 dark:text-gray-400"],
  [/text-stealth-primary/g, "text-gray-900 dark:text-gray-100"],
  [/text-stealth-accent/g, "text-blue-600 dark:text-blue-400"],
  [/text-stealth-success/g, "text-emerald-700 dark:text-emerald-400"],
  [/text-stealth-warning/g, "text-amber-700 dark:text-amber-400"],
  [/text-stealth-danger/g, "text-red-700 dark:text-red-400"],
  [/border-l-stealth-danger/g, "border-l-red-500 dark:border-l-red-400"],
  [/border-l-stealth-warning/g, "border-l-amber-500 dark:border-l-amber-400"],
  [/border-stealth-border/g, "border-gray-200 dark:border-[#1F2937]"],
  [/hover:bg-stealth-border\/40/g, "hover:bg-gray-200 dark:hover:bg-[#1F2937]/50"],
  [/hover:bg-stealth-border\/25/g, "hover:bg-gray-200/90 dark:hover:bg-[#1F2937]/40"],
  [/bg-stealth-card/g, "bg-white dark:bg-[#111827]"],
  [/bg-stealth-main/g, "bg-gray-50 dark:bg-[#0B0F14]"],
  [/bg-stealth-accent/g, "bg-blue-600 dark:bg-[#3B82F6]"],
  [/bg-stealth-danger/g, "bg-red-600 dark:bg-red-500"],
  [/bg-stealth-warning/g, "bg-amber-500 dark:bg-amber-500"],
];

for (const [a, b] of reps) s = s.replace(a, b);

s = s.replace(
  /bg-blue-600 dark:bg-\[#3B82F6\] px-3 py-1\.5 text-xs font-semibold text-gray-900 dark:text-gray-100/g,
  "bg-blue-600 dark:bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white",
);
s = s.replace(
  /bg-blue-600 dark:bg-\[#3B82F6\] px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100/g,
  "bg-blue-600 dark:bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white",
);
s = s.replace(
  /rounded-full bg-blue-600 dark:bg-\[#3B82F6\] text-\[9px\] font-bold leading-none text-gray-900 dark:text-gray-100 shadow-sm/g,
  "rounded-full bg-blue-600 dark:bg-[#3B82F6] text-[9px] font-bold leading-none text-white shadow-sm",
);

const left = [...new Set([...s.matchAll(/stealth-\w+/g)].map((m) => m[0]))];
if (left.length) {
  console.error("Remaining:", left);
  process.exit(1);
}

fs.writeFileSync(p, s);
console.log("OK OperationalDashboard.tsx");
