import { z } from "zod";
import { musicPlaylistSchema } from "@/content/music-schema";
import { studyDaySchema, quizAnswerSchema, mergeStudyDay } from "./study";
import {
  cardSchema,
  progressSchema,
  activitySchema,
  reviewLogSchema,
  favoriteSchema,
} from "./db";
const updatedAt = z.number().finite().nonnegative();
const setting = <T extends z.ZodType>(id: string, value: T) =>
  z.object({ id: z.literal(id), value, updatedAt }).strict();
export const preferenceSchema = z.union([
  setting("autoLetters", z.boolean()),
  setting("pinyin", z.boolean()),
  setting("translation", z.boolean()),
  setting("sound", z.boolean()),
  setting("fontSize", z.number().min(20).max(36)),
  setting("theme", z.enum(["light", "dark", "system"])),
  setting(
    "quizDisplay",
    z
      .object({
        hanzi: z.boolean(),
        pinyin: z.boolean(),
        vietnamese: z.boolean(),
      })
      .strict()
      .refine((v) => v.hanzi || v.pinyin || v.vietnamese),
  ),
  setting("recipientUid", z.string().max(128)),
]);
export const draftSchema = z
  .object({
    id: z.string().min(1).max(100),
    raw: z.string().max(500000),
    updatedAt,
  })
  .strict();
export const accountSchemas = {
  musicPlaylists: musicPlaylistSchema,
  studyDays: studyDaySchema,
  quizAnswers: quizAnswerSchema,
  cards: cardSchema.strict(),
  progress: progressSchema.strict(),
  activities: activitySchema.strict(),
  reviews: reviewLogSchema.strict(),
  favorites: favoriteSchema.strict(),
  preferences: preferenceSchema,
  drafts: draftSchema,
};
export type AccountKind = keyof typeof accountSchemas;
export type AccountRecord = { id: string; [key: string]: unknown };
export function parseAccountRecord(
  kind: AccountKind,
  input: unknown,
): AccountRecord {
  const value = accountSchemas[kind].parse(input);
  if (value.id.length > 250) throw new Error("Mã dữ liệu tài khoản quá dài.");
  return value;
}
export function mergeAccountRecord(
  kind: AccountKind,
  prior: AccountRecord | undefined,
  incoming: AccountRecord,
): AccountRecord {
  const next = parseAccountRecord(kind, incoming);
  if (!prior) return next;
  const old = parseAccountRecord(kind, prior);
  if (old.id !== next.id)
    throw new Error("Không thể ghép hai mã dữ liệu khác nhau.");
  if (kind === "studyDays")
    return mergeStudyDay(studyDaySchema.parse(old), studyDaySchema.parse(next));
  if (kind === "activities" || kind === "reviews" || kind === "quizAnswers")
    return old;
  const chosen =
    Number(next.updatedAt) > Number(old.updatedAt) ||
    (Number(next.updatedAt) === Number(old.updatedAt) &&
      JSON.stringify(next) > JSON.stringify(old))
      ? next
      : old;
  if (kind === "progress")
    return {
      ...chosen,
      completed: !!old.completed || !!next.completed,
      ...(old.quizScore !== undefined || next.quizScore !== undefined
        ? {
            quizScore: Math.max(
              Number(old.quizScore ?? 0),
              Number(next.quizScore ?? 0),
            ),
          }
        : {}),
    };
  return chosen;
}
export const preferenceKeys = [
  "autoLetters",
  "pinyin",
  "translation",
  "sound",
  "fontSize",
  "theme",
  "quizDisplay",
] as const;
export const defaultPreferences = {
  autoLetters: true,
  pinyin: true,
  translation: false,
  sound: true,
  fontSize: 26,
  theme: "light" as const,
  quizDisplay: { hanzi: true, pinyin: true, vietnamese: true },
};
