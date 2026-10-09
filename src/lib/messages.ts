import { z } from "zod";
import type { CachedLetter } from "./db";
export const messageInputSchema = z
  .object({
    recipientUid: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1, "Nhập tiêu đề thư.").max(120),
    zhText: z.string().max(500),
    pinyin: z.string().max(1000),
    viText: z.string().trim().min(1, "Nhập lời nhắn.").max(5000),
    theme: z.enum(["rose", "sage", "lavender"]),
    deliveryType: z.enum(["instant", "scheduled", "milestone"]),
    scheduledAt: z.number().finite().nonnegative().optional(),
    milestoneKind: z.enum(["stories", "streak", "reviews"]),
    milestoneCount: z.number().int().min(1).max(1000),
  })
  .superRefine((m, ctx) => {
    if (m.deliveryType === "scheduled" && !m.scheduledAt)
      ctx.addIssue({ code: "custom", message: "Chọn ngày và giờ gửi thư." });
    if (m.pinyin && !m.zhText)
      ctx.addIssue({
        code: "custom",
        message: "Pinyin cần đi cùng câu tiếng Trung.",
      });
  });
export type MessageInput = z.infer<typeof messageInputSchema>;
export function validatePublish(input: unknown, now = Date.now()) {
  const m = messageInputSchema.parse(input);
  if (m.deliveryType === "scheduled" && (m.scheduledAt ?? 0) <= now)
    throw new Error("Giờ hẹn phải ở trong tương lai.");
  return m;
}
export interface MilestoneProgress {
  stories: number;
  streak: number;
  reviews: number;
}
export function messageEligible(
  m: CachedLetter,
  uid: string,
  now: number,
  progress: MilestoneProgress,
) {
  return (
    m.recipientUid === uid &&
    (m.status === "published" || m.status === "scheduled") &&
    m.visibleAt <= now &&
    (m.deliveryType !== "milestone" ||
      progress[m.milestoneKind] >= m.milestoneCount)
  );
}
export const milestoneLabels = {
  stories: "truyện đã đọc",
  streak: "ngày học liên tiếp",
  reviews: "lượt ôn từ",
} as const;
