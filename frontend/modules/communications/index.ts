/**
 * Communications workspace modules — tool pages and domain types.
 * Shared UI primitives live under `@/components/communications`.
 */

export type * from "@/modules/communications/types";
export { MOCK_CALENDAR_LAYER, MOCK_CAMPAIGNS, MOCK_CROSS_DEPT_REQUESTS, MOCK_FACILITY_WALLS } from "@/modules/communications/mock-data";
export { AdvertisingMapperPage } from "@/modules/communications/advertising-mapper/AdvertisingMapperPage";
export { PublicationBuilderPage } from "@/modules/communications/publication-builder/PublicationBuilderPage";
export { CampaignPlannerPage } from "@/modules/communications/campaign-planner/CampaignPlannerPage";
