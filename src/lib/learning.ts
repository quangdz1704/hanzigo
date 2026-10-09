import { z } from "zod";
export const DAY = 86_400_000;
export const localDay = (time = Date.now()) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dayOrdinal = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
};
export const dailyIndex = (length: number, time = Date.now()) =>
  ((dayOrdinal(localDay(time)) % length) + length) % length;
export const ratingSchema = z.enum(["again", "hard", "good", "easy"]);
export type Rating = z.infer<typeof ratingSchema>;
export function scheduleReview(
  previous: { interval: number; repetitions: number },
  rating: Rating,
  now = Date.now(),
) {
  let interval: number;
  if (rating === "again") interval = 10 / 1440;
  else if (previous.repetitions === 0 || previous.interval < 1)
    interval = { hard: 1, good: 3, easy: 7 }[rating];
  else
    interval = Math.max(
      { hard: 1, good: 3, easy: 7 }[rating],
      Math.round(previous.interval * { hard: 1.2, good: 2, easy: 2.5 }[rating]),
    );
  interval = Math.min(365, interval);
  return {
    interval,
    repetitions: rating === "again" ? 0 : previous.repetitions + 1,
    dueAt: now + interval * DAY,
    updatedAt: now,
  };
}
export function streakForDays(days: string[], now = Date.now()) {
  const sorted = [...new Set(days.map(dayOrdinal))].sort((a, b) => b - a);
  const today = dayOrdinal(localDay(now));
  if (!sorted.length || sorted[0] < today - 1 || sorted[0] > today) return 0;
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] - 1) break;
    count++;
  }
  return count;
}
export const XP = { story: 30, quiz: 15, review: 5, game: 10 } as const;
