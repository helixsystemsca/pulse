import { apiFetch, apiPostFormData } from "./client";

export type ProcedureStep = {
  text: string;
  image_url?: string | null;
  recommended_workers?: number | null;
  tools?: string[] | null;
};

export type ProcedureRow = {
  id: string;
  company_id: string;
  title: string;
  steps: ProcedureStep[];
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  review_required?: boolean;
  reviewed_by_user_id?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  revised_by_user_id?: string | null;
  revised_by_name?: string | null;
  revised_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcedureAssignmentKind = "complete" | "revise" | "create";
export type ProcedureAssignmentStatus = "pending" | "in_progress" | "completed";

export type ProcedureAssignmentRow = {
  id: string;
  company_id: string;
  procedure_id: string;
  procedure_title: string;
  assigned_to_user_id: string;
  assigned_by_user_id?: string | null;
  kind: ProcedureAssignmentKind;
  status: ProcedureAssignmentStatus;
  notes?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcedureAssignmentPhoto = { id: string; url: string; created_at: string };

export type ProcedureAssignmentDetail = ProcedureAssignmentRow & {
  procedure: ProcedureRow;
  photos: ProcedureAssignmentPhoto[];
};

export async function listMyProcedureAssignments(
  token: string,
  params?: { status?: ProcedureAssignmentStatus | null },
): Promise<ProcedureAssignmentRow[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  const qs = sp.toString();
  return apiFetch<ProcedureAssignmentRow[]>(`/api/v1/cmms/procedure-assignments/my${qs ? `?${qs}` : ""}`, { token });
}

export async function getProcedureAssignment(token: string, assignmentId: string): Promise<ProcedureAssignmentDetail> {
  return apiFetch<ProcedureAssignmentDetail>(`/api/v1/cmms/procedure-assignments/${encodeURIComponent(assignmentId)}`, { token });
}

export async function uploadProcedureAssignmentPhoto(token: string, assignmentId: string, file: { uri: string; name: string; type: string }) {
  const fd = new FormData();
  // React Native FormData file shape.
  fd.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return apiPostFormData<{ id: string; url: string; created_at: string }>(
    `/api/v1/cmms/procedure-assignments/${encodeURIComponent(assignmentId)}/photos`,
    fd,
    { token },
  );
}

export async function completeProcedureAssignment(token: string, assignmentId: string): Promise<{ ok: boolean; assignment_id: string; completed_at: string }> {
  return apiFetch<{ ok: boolean; assignment_id: string; completed_at: string }>(
    `/api/v1/cmms/procedure-assignments/${encodeURIComponent(assignmentId)}/complete`,
    { method: "POST", token },
  );
}

export async function patchProcedure(
  token: string,
  procedureId: string,
  body: { title?: string; steps?: { text: string; image_url?: string | null; recommended_workers?: number | null; tools?: string[] | null }[] },
): Promise<ProcedureRow> {
  return apiFetch<ProcedureRow>(`/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}`, {
    method: "PATCH",
    token,
    body,
  });
}

export async function uploadProcedureStepImage(
  token: string,
  procedureId: string,
  stepIndex: number,
  file: { uri: string; name: string; type: string },
): Promise<{ image_url: string }> {
  const fd = new FormData();
  fd.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return apiPostFormData<{ image_url: string }>(
    `/api/v1/cmms/procedures/${encodeURIComponent(procedureId)}/steps/${stepIndex}/image`,
    fd,
    { token },
  );
}

