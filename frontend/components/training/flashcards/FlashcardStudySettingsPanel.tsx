"use client";

import { Settings2 } from "lucide-react";
import {
  DEFAULT_FLASHCARD_STUDY_SETTINGS,
  type FlashcardStudySettings,
} from "@/lib/training/flashcard-study-settings";
import { cn } from "@/lib/cn";

type Props = {
  settings: FlashcardStudySettings;
  onChange: (next: FlashcardStudySettings) => void;
  className?: string;
  /** When true, settings start expanded. */
  defaultOpen?: boolean;
};

type SettingRow = {
  key: keyof FlashcardStudySettings;
  label: string;
  description: string;
};

const SETTING_ROWS: SettingRow[] = [
  {
    key: "shuffleCards",
    label: "Shuffle cards",
    description: "Randomize card order each time you start studying.",
  },
  {
    key: "hideMasteredCards",
    label: "Hide mastered cards",
    description: "Skip cards you marked Got it that are not due for review yet.",
  },
  {
    key: "studyNewCardsOnly",
    label: "Study new cards only",
    description: "Only show cards you have not reviewed before.",
  },
  {
    key: "studyIncorrectCardsOnly",
    label: "Study incorrect cards",
    description: "Only show cards you last marked Again or Unsure.",
  },
  {
    key: "reverseQuestionAnswer",
    label: "Reverse question / answer",
    description: "Show the answer on the front and the question on the back.",
  },
  {
    key: "resumePreviousSession",
    label: "Resume previous session",
    description: "Continue where you left off in this section.",
  },
];

export function FlashcardStudySettingsPanel({
  settings,
  onChange,
  className,
  defaultOpen = false,
}: Props) {
  return (
    <details
      className={cn("rounded-xl border border-ds-border bg-ds-card", className)}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ds-foreground [&::-webkit-details-marker]:hidden">
        <Settings2 className="h-4 w-4 text-teal-600" aria-hidden />
        Study settings
      </summary>
      <div className="space-y-1 border-t border-ds-border px-4 py-3">
        {SETTING_ROWS.map((row) => (
          <label
            key={row.key}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-1 py-2 hover:bg-ds-muted/10"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ds-foreground">{row.label}</span>
              <span className="mt-0.5 block text-xs text-ds-muted">{row.description}</span>
            </span>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-teal-600"
              checked={settings[row.key]}
              onChange={(e) => onChange({ ...settings, [row.key]: e.target.checked })}
            />
          </label>
        ))}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FLASHCARD_STUDY_SETTINGS })}
            className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </details>
  );
}
