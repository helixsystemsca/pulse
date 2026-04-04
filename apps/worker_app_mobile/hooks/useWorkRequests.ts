import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ListParams } from "@/services/workRequests";
import {
  createWorkRequest,
  fetchWorkRequestDetail,
  fetchWorkRequestList,
  patchWorkRequestAttachments,
  postWorkRequestComment,
  postWorkRequestStatus,
} from "@/services/workRequests";

export function useWorkRequestListQuery(params: ListParams) {
  return useQuery({
    queryKey: ["workRequests", "list", params],
    queryFn: () => fetchWorkRequestList({ limit: 80, ...params }),
  });
}

export function useWorkRequestDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: ["workRequests", "detail", id],
    queryFn: () => fetchWorkRequestDetail(id!),
    enabled: Boolean(id),
  });
}

export function usePostStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => postWorkRequestStatus(id, status),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["workRequests", "detail", id] });
      void qc.invalidateQueries({ queryKey: ["workRequests", "list"] });
    },
  });
}

export function usePostCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => postWorkRequestComment(id, message),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["workRequests", "detail", id] });
    },
  });
}

export function useCreateIssueMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWorkRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["workRequests", "list"] });
    },
  });
}

export function usePatchAttachmentsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, attachments }: { id: string; attachments: unknown[] }) =>
      patchWorkRequestAttachments(id, attachments),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["workRequests", "detail", id] });
    },
  });
}
