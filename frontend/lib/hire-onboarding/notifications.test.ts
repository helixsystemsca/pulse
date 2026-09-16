import { describe, expect, it } from "vitest";
import { operationalNotificationHref } from "@/lib/dashboard/operational-notifications";
import {
  HIRE_ONBOARDING_LIST_HREF,
  hireOnboardingNotificationItems,
  hireOnboardingPacketHref,
} from "@/lib/hire-onboarding/notifications";

describe("hire onboarding notifications", () => {
  it("stays quiet when nothing is incomplete", () => {
    expect(
      hireOnboardingNotificationItems({
        open_hires: 0,
        incomplete_required_items: 0,
        hires: [],
      }),
    ).toEqual([]);
  });

  it("deep-links a single incomplete hire", () => {
    const items = hireOnboardingNotificationItems({
      open_hires: 1,
      incomplete_required_items: 4,
      hires: [
        {
          packet_id: "p1",
          user_id: "u1",
          full_name: "Alex Rivera",
          email: "alex@vernon.example",
          required_total: 7,
          required_completed: 3,
          percent: 43,
          incomplete_titles: ["WHMIS / OH&S acknowledgment", "PPE acknowledgment"],
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("hire-onboarding-u1");
    expect(items[0].title).toContain("Alex Rivera");
    expect(operationalNotificationHref(items[0])).toBe(hireOnboardingPacketHref("u1"));
  });

  it("digests multiple open hires to the onboarding list", () => {
    const items = hireOnboardingNotificationItems({
      open_hires: 2,
      incomplete_required_items: 6,
      hires: [
        {
          packet_id: "p1",
          user_id: "u1",
          full_name: "Alex Rivera",
          email: "alex@vernon.example",
          required_total: 7,
          required_completed: 3,
          percent: 43,
          incomplete_titles: ["PPE acknowledgment"],
        },
        {
          packet_id: "p2",
          user_id: "u2",
          full_name: null,
          email: "sam@vernon.example",
          required_total: 7,
          required_completed: 5,
          percent: 71,
          incomplete_titles: ["Code of conduct"],
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("hire-onboarding-digest");
    expect(items[0].subtitle).toContain("Alex Rivera");
    expect(operationalNotificationHref(items[0])).toBe(HIRE_ONBOARDING_LIST_HREF);
  });
});
