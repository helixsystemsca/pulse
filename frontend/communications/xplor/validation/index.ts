import type { PublicationDocument, PublicationEntry, PublicationWarning } from "../schema/publication";

function warn(code: string, message: string, field?: string): PublicationWarning {
  return { code, message, severity: "warn", field };
}

function validateEntry(entry: PublicationEntry): PublicationEntry {
  const warnings = [...entry.warnings];
  let confidence = entry.confidence;

  if (!entry.title.trim()) {
    warnings.push(warn("missing_title", "Program title is empty", "title"));
    confidence -= 0.2;
  }
  if (!entry.ageRange.trim()) {
    warnings.push(warn("missing_age", "Age range is empty", "ageRange"));
    confidence -= 0.1;
  }
  if (!entry.location.trim()) {
    warnings.push(warn("missing_location", "Location not specified", "location"));
    confidence -= 0.05;
  }
  if (entry.sessions.length === 0) {
    warnings.push(warn("no_sessions", "No session rows parsed", "sessions"));
    confidence -= 0.25;
  }

  for (const session of entry.sessions) {
    warnings.push(...session.warnings);
    if (session.confidence < confidence) confidence = (confidence + session.confidence) / 2;
    if (!session.startDate && !session.days) {
      warnings.push(
        warn("malformed_schedule", `Session ${session.sessionLabel} lacks dates and days`, "sessions"),
      );
    }
  }

  return {
    ...entry,
    warnings,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

export function validatePublicationDocument(doc: PublicationDocument): PublicationDocument {
  const entries = doc.entries.map(validateEntry);
  const warnings = [...doc.warnings];
  let confidence =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
      : 0;

  if (entries.length === 0) {
    warnings.push({
      code: "empty_document",
      message: "No publication entries after parse",
      severity: "error",
    });
    confidence = 0;
  }

  return { ...doc, entries, warnings, confidence };
}
