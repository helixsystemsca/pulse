import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "@/types/navigation";

/** Deep links — extend when auth flows and tab routes are finalized. */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["helix-field://", "exp+helix-field://"],
  config: {
    screens: {
      Login: "login",
      Main: "",
    },
  },
};
