import { readdir, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { parseInterviewDeckDocument } from "@/lib/training/interviews/validate";
import type { InterviewDeckSummary } from "@/lib/training/interviews/types";

const INTERVIEWS_DIR = path.join(process.cwd(), "public", "training", "interviews");

/** Auto-discovers every `*.json` deck under `public/training/interviews/`. */
export async function GET() {
  let files: string[];
  try {
    files = await readdir(INTERVIEWS_DIR);
  } catch {
    return NextResponse.json([]);
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  const decks: InterviewDeckSummary[] = [];

  for (const sourceFile of jsonFiles) {
    try {
      const raw = await readFile(path.join(INTERVIEWS_DIR, sourceFile), "utf-8");
      const doc = parseInterviewDeckDocument(JSON.parse(raw), sourceFile);
      decks.push({
        ...doc.deck,
        cardCount: doc.cards.length,
        sourceFile,
      });
    } catch {
      // Skip invalid files — deck management can surface errors later if needed.
    }
  }

  return NextResponse.json(decks);
}
