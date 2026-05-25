import {
  uiPageDescription,
  uiPageStack,
  uiPageTitle,
  uiPremiumPanel,
  uiSectionDescription,
  uiSectionStack,
  uiSectionTitle,
} from "./ui-classes";

/** Layout & surface tokens for pages — prefer `pulse/Card` and `ui-classes` for new UI. */
export const UI = {
  page: "min-h-screen bg-ds-bg px-6 py-6",
  container: "max-w-7xl mx-auto",
  pageStack: uiPageStack,
  sectionStack: uiSectionStack,
  card: uiPremiumPanel + " p-5",
  section: uiPremiumPanel + " p-4",
  pageTitle: uiPageTitle,
  pageDescription: uiPageDescription,
  sectionTitle: uiSectionTitle,
  sectionDescription: uiSectionDescription,
  header: "text-xl font-semibold text-ds-foreground",
  subheader: "text-sm text-ds-muted",
  toggleGroup: "flex gap-2 mb-4",
};
