import data from "@/build-version.json";

function formatFromHundredths(n: number): string {
  return `v${(n / 100).toFixed(2)}`;
}

const fileHundredths = typeof data.hundredths === "number" ? data.hundredths : 101;

/** Login footer; production builds inject NEXT_PUBLIC_PULSE_BUILD_VERSION via scripts/next-build-with-version.mjs */
export const PULSE_BUILD_VERSION =
  process.env.NEXT_PUBLIC_PULSE_BUILD_VERSION?.trim() || formatFromHundredths(fileHundredths);
