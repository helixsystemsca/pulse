/** Slugs for which organizational department owns a training program (matrix / roster scoping). */
export const TRAINING_PROGRAM_DEPARTMENT_SLUGS = [
  "maintenance",
  "reception",
  "communications",
  "aquatics",
  "fitness",
] as const;

export type TrainingProgramDepartmentSlug = (typeof TRAINING_PROGRAM_DEPARTMENT_SLUGS)[number];

const LABEL: Record<TrainingProgramDepartmentSlug, string> = {
  maintenance: "Maintenance",
  reception: "Reception",
  communications: "Communications",
  aquatics: "Aquatics",
  fitness: "Fitness",
};

export function trainingDepartmentCategoryLabel(slug: string): string {
  const s = slug.trim().toLowerCase() as TrainingProgramDepartmentSlug;
  return LABEL[s] ?? slug;
}

export function isKnownTrainingDepartmentSlug(raw: string | null | undefined): raw is TrainingProgramDepartmentSlug {
  return TRAINING_PROGRAM_DEPARTMENT_SLUGS.includes((raw ?? "").trim().toLowerCase() as TrainingProgramDepartmentSlug);
}

/** Values for leadership dashboard "department scope" filter (includes org-wide sentinel). */
export const PROGRAM_DEPARTMENT_SCOPE_FILTER_VALUES: readonly string[] = [
  "all",
  "__org__",
  ...TRAINING_PROGRAM_DEPARTMENT_SLUGS,
];

export function programDepartmentScopeFilterLabel(value: string): string {
  if (value === "all") return "All scopes";
  if (value === "__org__") return "Organization-wide";
  return trainingDepartmentCategoryLabel(value);
}
