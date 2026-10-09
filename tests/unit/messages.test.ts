import { describe, it, expect } from "vitest";
import {
  messageEligible,
  validatePublish,
  messageInputSchema,
} from "../../src/lib/messages";
import type { CachedLetter } from "../../src/lib/db";
const base: CachedLetter = {
  id: "one",
  recipientUid: "wife",
  title: "Thư",
  zhText: "",
  pinyin: "",
  viText: "Chúc em vui",
  theme: "rose",
  deliveryType: "instant",
  status: "published",
  visibleAt: 1000,
  milestoneKind: "stories",
  milestoneCount: 2,
  createdAt: 1000,
  updatedAt: 1000,
};
const progress = { stories: 2, streak: 1, reviews: 4 };
describe("letter eligibility and composer", () => {
  it("only shows delivered letters for this recipient", () => {
    expect(messageEligible(base, "wife", 2000, progress)).toBe(true);
    expect(messageEligible(base, "other", 2000, progress)).toBe(false);
    expect(
      messageEligible({ ...base, status: "draft" }, "wife", 2000, progress),
    ).toBe(false);
    expect(
      messageEligible({ ...base, status: "archived" }, "wife", 2000, progress),
    ).toBe(false);
  });
  it("does not reveal a future scheduled demo letter", () => {
    const m = {
      ...base,
      status: "scheduled" as const,
      deliveryType: "scheduled" as const,
      visibleAt: 3000,
    };
    expect(messageEligible(m, "wife", 2999, progress)).toBe(false);
    expect(messageEligible(m, "wife", 3000, progress)).toBe(true);
  });
  it("implements UX milestones without claiming security", () => {
    expect(
      messageEligible(
        { ...base, deliveryType: "milestone" },
        "wife",
        2000,
        progress,
      ),
    ).toBe(true);
    expect(
      messageEligible(
        { ...base, deliveryType: "milestone", milestoneCount: 3 },
        "wife",
        2000,
        progress,
      ),
    ).toBe(false);
  });
  it("validates content and future scheduled publication", () => {
    expect(messageInputSchema.safeParse({ ...base, title: " " }).success).toBe(
      false,
    );
    expect(() =>
      validatePublish(
        { ...base, deliveryType: "scheduled", scheduledAt: 1000 },
        2000,
      ),
    ).toThrow();
    expect(
      validatePublish(
        { ...base, deliveryType: "scheduled", scheduledAt: 3000 },
        2000,
      ).scheduledAt,
    ).toBe(3000);
  });
  it("does not accept Pinyin without Chinese", () =>
    expect(
      messageInputSchema.safeParse({ ...base, pinyin: "Nǐ hǎo" }).success,
    ).toBe(false));
});
