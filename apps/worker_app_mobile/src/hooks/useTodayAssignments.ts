import { useQuery } from "@tanstack/react-query";
import { MOCK_ASSIGNMENTS } from "@/data/mockAssignments";

/** Swap queryFn for `assignmentsApi.listToday()` when backend is ready. */
export function useTodayAssignments() {
  return useQuery({
    queryKey: ["assignments", "today"],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 450));
      return MOCK_ASSIGNMENTS;
    },
  });
}
