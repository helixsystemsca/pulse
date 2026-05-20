/**
 * Digital inspection sheets — shared UI in `inspection-sheet-ui.tsx`.
 * New sheets should compose: InspectionSheetLayout, InspectionSheetHeader,
 * GlassSection, ChecklistRow, InspectionSheetFooter.
 */
export { VehicleInspectionSheet, type VehicleInspectionArchivePayload } from "@/components/inspections/VehicleInspectionSheet";
export {
  HarnessInspectionSheet,
  HarnessInspectionForm,
  type HarnessInspectionArchivePayload,
  type HarnessInspectionSubmitPayload,
} from "@/components/inspections/HarnessInspectionSheet";
export {
  AutoGrowTextarea,
  ChecklistRow,
  Field,
  GlassSection,
  GradientPrimaryButton,
  InspectionSheetFooter,
  InspectionSheetHeader,
  InspectionSheetLayout,
  StatusPill,
  clampProgress,
  frostInset,
  nowStamp,
  uid,
  type InspectionSheetStatCard,
  type InspectionStatus,
  type PassFail,
} from "@/components/inspections/inspection-sheet-ui";
