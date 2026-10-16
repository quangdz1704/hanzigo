import Dexie, { type EntityTable } from "dexie";
import { z } from "zod";
import type { AccountKind, AccountRecord } from "./account-data";
import { vocabulary, stories, quotes } from "@/content";
import {
  studyDaySchema,
  quizAnswerSchema,
  type StudyDay,
  type QuizAnswer,
  mergeStudyDay,
} from "./study";
import { DAY, localDay, scheduleReview, XP, type Rating } from "./learning";
const timestamp = z.number().finite().nonnegative();
export const cardSchema = z.object({
  id: z.string(),
  dueAt: timestamp,
  interval: z.number().finite().nonnegative().max(365),
  repetitions: z.number().int().nonnegative(),
  addedAt: timestamp,
  updatedAt: timestamp,
});
export const progressSchema = z.object({
  id: z.string(),
  sentence: z.number().int().nonnegative(),
  completed: z.boolean(),
  quizScore: z.number().int().nonnegative().optional(),
  updatedAt: timestamp,
});
export const activitySchema = z.object({
  id: z.string(),
  kind: z.enum(["story", "quiz", "review", "game"]),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const [y, m, d] = s.split("-").map(Number);
      const t = new Date(Date.UTC(y, m - 1, d));
      return (
        t.getUTCFullYear() === y &&
        t.getUTCMonth() === m - 1 &&
        t.getUTCDate() === d
      );
    }, "Invalid calendar date"),
  xp: z.number().int().nonnegative().max(30),
  at: timestamp,
});
export const reviewLogSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  rating: z.enum(["again", "hard", "good", "easy"]),
  at: timestamp,
});
export const favoriteSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  updatedAt: timestamp,
});
export type ReviewCard = z.infer<typeof cardSchema>;
export type ReadingProgress = z.infer<typeof progressSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ReviewLog = z.infer<typeof reviewLogSchema>;
export type Favorite = z.infer<typeof favoriteSchema>;
export interface CachedLetter {
  id: string;
  recipientUid: string;
  title: string;
  zhText: string;
  pinyin: string;
  viText: string;
  theme: "rose" | "sage" | "lavender";
  deliveryType: "instant" | "scheduled" | "milestone";
  status: "draft" | "scheduled" | "published" | "archived";
  visibleAt: number;
  milestoneKind: "stories" | "streak" | "reviews";
  milestoneCount: number;
  createdAt: number;
  updatedAt: number;
}
export interface Receipt {
  id: string;
  recipientUid: string;
  seenAt?: number;
  readAt?: number;
  heartedAt?: number;
  favoritedAt?: number;
  dismissedAt?: number;
  updatedAt: number;
  pending?: boolean;
}
export interface ContentDraft {
  id: string;
  raw: string;
  updatedAt: number;
}
export interface QueueItem {
  id: string;
  kind: AccountKind;
  value: AccountRecord;
  revision: string;
  initializeOnly?: boolean;
}
export const db = new Dexie("hanzigo") as Dexie & {
  studyDays: EntityTable<StudyDay, "id">;
  quizAnswers: EntityTable<QuizAnswer, "id">;
  cards: EntityTable<ReviewCard, "id">;
  progress: EntityTable<ReadingProgress, "id">;
  activities: EntityTable<Activity, "id">;
  reviews: EntityTable<ReviewLog, "id">;
  favorites: EntityTable<Favorite, "id">;
  letters: EntityTable<CachedLetter, "id">;
  receipts: EntityTable<Receipt, "id">;
  contentDrafts: EntityTable<ContentDraft, "id">;
  preferences: EntityTable<
    { id: string; value: unknown; updatedAt: number },
    "id"
  >;
  drafts: EntityTable<ContentDraft, "id">;
  syncQueue: EntityTable<QueueItem, "id">;
  meta: EntityTable<{ id: string; value: string }, "id">;
  libraryCache: EntityTable<{ id: string; raw: string }, "id">;
};
/** Claim before display, in one IndexedDB transaction, even across open tabs. */
export async function claimLetterPopup(uid: string, messageId: string) {
  return db.transaction("rw", db.receipts, async () => {
    const id = `${uid}:${messageId}`;
    const old = await db.receipts.get(id);
    if (old?.seenAt) return false;
    const now = Date.now();
    await db.receipts.put({
      ...old,
      id,
      recipientUid: uid,
      seenAt: now,
      updatedAt: now,
      pending: true,
    });
    return true;
  });
}
db.version(1).stores({
  cards: "id, dueAt",
  progress: "id, updatedAt",
  activities: "id, day, kind",
  reviews: "id, cardId, at",
  favorites: "id",
  letters: "id, recipientUid, visibleAt",
  receipts: "id, recipientUid",
});
// Additive migration; all v1 learning records remain intact.
db.version(2).stores({ letters: "id, recipientUid, visibleAt, status" });
db.version(3).stores({ contentDrafts: "id, updatedAt" });
db.version(4).stores({ libraryCache: "id" });
db.version(5).stores({
  preferences: "id",
  drafts: "id, updatedAt",
  syncQueue: "id",
  meta: "id",
});
db.version(6).stores({ studyDays: "id", quizAnswers: "id, storyId, at" });
export type AccountDatabase = typeof db;
const databases = new Map<string, AccountDatabase>();
let learningDb = db;
export const getLearningDatabase = () => learningDb;
export function getAccountDatabase(uid: string): AccountDatabase {
  let database = databases.get(uid);
  if (!database) {
    database = new Dexie(`hanzigo-account-${uid}`) as AccountDatabase;
    database.version(1).stores({
      cards: "id, dueAt",
      progress: "id, updatedAt",
      activities: "id, day, kind",
      reviews: "id, cardId, at",
      favorites: "id",
      preferences: "id",
      drafts: "id, updatedAt",
      syncQueue: "id",
      meta: "id",
    });
    database
      .version(2)
      .stores({ studyDays: "id", quizAnswers: "id, storyId, at" });
    databases.set(uid, database);
  }
  return database;
}
export function selectLearningDatabase(uid: string | null) {
  learningDb = uid ? getAccountDatabase(uid) : db;
  return learningDb;
}
export async function putAccountRecord<T extends { id: string }>(
  database: AccountDatabase,
  kind: AccountKind,
  value: T,
) {
  const clean = JSON.parse(JSON.stringify(value)) as AccountRecord;
  await database.table(kind).put(clean);
  if (database !== db)
    await database.syncQueue.put({
      id: `${kind}:${value.id}`,
      kind,
      value: clean,
      revision: crypto.randomUUID(),
    });
}
// Claim legacy browser data once. Never copy a signed-in account's cache into another account.
export async function migrateGuestLearning(uid: string, registration = false) {
  const target = getAccountDatabase(uid);
  await db.transaction(
    "rw",
    [
      db.meta,
      db.cards,
      db.progress,
      db.activities,
      db.reviews,
      db.favorites,
      db.preferences,
      db.studyDays,
      db.quizAnswers,
    ],
    async () => {
      const claimed = await db.meta.get("learningMigration");
      if (claimed && !registration) return;
      const data = await Promise.all(
        [
          "cards",
          "progress",
          "activities",
          "reviews",
          "favorites",
          "preferences",
          "studyDays",
          "quizAnswers",
        ].map(async (kind) => ({
          kind: kind as AccountKind,
          rows: await db.table(kind).toArray(),
        })),
      );
      await Dexie.waitFor(
        Dexie.ignoreTransaction(() =>
          target.transaction("rw", target.tables, async () => {
            for (const { kind, rows } of data)
              for (const item of rows)
                if (!(await target.table(kind).get(item.id))) {
                  await putAccountRecord(target, kind, item);
                  if (kind === "preferences")
                    await target.syncQueue.update(`${kind}:${item.id}`, {
                      initializeOnly: true,
                    });
                }
          }),
        ),
      );
      await db.meta.put({ id: "learningMigration", value: uid });
    },
  );
}
export async function saveVocabulary(id: string) {
  const db = learningDb;
  if (!vocabulary.some((v) => v.id === id))
    throw new Error("Không tìm thấy từ này.");
  await db.transaction("rw", db.cards, db.syncQueue, async () => {
    if (!(await db.cards.get(id))) {
      const now = Date.now();
      await putAccountRecord(db, "cards", {
        id,
        dueAt: now,
        interval: 0,
        repetitions: 0,
        addedAt: now,
        updatedAt: now,
      });
    }
  });
}
export async function awardActivity(
  id: string,
  kind: Activity["kind"],
  at = Date.now(),
  database = learningDb,
) {
  const db = database;
  return db.transaction("rw", db.activities, db.syncQueue, async () => {
    if (await db.activities.get(id)) return false;
    await putAccountRecord(db, "activities", {
      id,
      kind,
      day: localDay(at),
      xp: XP[kind],
      at,
    });
    return true;
  });
}
export async function completeStory(id: string, sentence: number) {
  const db = learningDb;
  await db.transaction(
    "rw",
    db.progress,
    db.activities,
    db.studyDays,
    db.syncQueue,
    async () => {
      const prior = await db.progress.get(id);
      await putAccountRecord(db, "progress", {
        id,
        sentence,
        completed: true,
        quizScore: prior?.quizScore,
        updatedAt: Date.now(),
      });
      const now = Date.now();
      const plan = await db.studyDays.get(localDay(now));
      if (plan?.storyId === id)
        await putAccountRecord(db, "studyDays", {
          ...plan,
          readAt: now,
          updatedAt: now,
        });
      await awardActivity(`story:${id}`, "story", now, db);
    },
  );
}
export async function saveReadingPosition(id: string, sentence: number) {
  const db = learningDb;
  await db.transaction("rw", db.progress, db.syncQueue, async () => {
    const old = await db.progress.get(id);
    await putAccountRecord(db, "progress", {
      id,
      sentence,
      completed: old?.completed ?? false,
      quizScore: old?.quizScore,
      updatedAt: Date.now(),
    });
  });
}
export async function recordQuiz(
  id: string,
  score: number,
  total: number,
  database = learningDb,
) {
  const db = database;
  await db.transaction(
    "rw",
    db.progress,
    db.activities,
    db.syncQueue,
    async () => {
      const prior = await db.progress.get(id);
      await putAccountRecord(db, "progress", {
        id,
        sentence: prior?.sentence ?? 0,
        completed: prior?.completed ?? false,
        quizScore: Math.max(prior?.quizScore ?? 0, score),
        updatedAt: Date.now(),
      });
      if (score === total)
        await awardActivity(`quiz:${id}`, "quiz", Date.now(), db);
    },
  );
}
export async function reviewVocabulary(
  id: string,
  rating: Rating,
  now = Date.now(),
) {
  const db = learningDb;
  return db.transaction(
    "rw",
    db.cards,
    db.reviews,
    db.activities,
    db.syncQueue,
    async () => {
      const card = await db.cards.get(id);
      if (!card || card.dueAt > now) return false;
      const logId = `${id}:${card.dueAt}`;
      if (await db.reviews.get(logId)) return false;
      await putAccountRecord(db, "cards", {
        ...card,
        ...scheduleReview(card, rating, now),
      });
      await putAccountRecord(db, "reviews", {
        id: logId,
        cardId: id,
        rating,
        at: now,
      });
      await awardActivity(`review:${logId}`, "review", now, db);
      return true;
    },
  );
}
export async function toggleFavorite(type: "story" | "quote", id: string) {
  const db = learningDb;
  const key = `${type}:${id}`;
  await db.transaction("rw", db.favorites, db.syncQueue, async () => {
    const old = await db.favorites.get(key);
    await putAccountRecord(db, "favorites", {
      id: key,
      active: !old?.active,
      updatedAt: Date.now(),
    });
  });
}
export const backupSchema = z.object({
  app: z.literal("HanziGo"),
  version: z.literal(1),
  exportedAt: timestamp,
  cards: z.array(cardSchema).max(10000),
  progress: z.array(progressSchema).max(10000),
  activities: z.array(activitySchema).max(100000),
  reviews: z.array(reviewLogSchema).max(100000),
  favorites: z.array(favoriteSchema).max(10000),
  studyDays: z.array(studyDaySchema).max(10000).default([]),
  quizAnswers: z.array(quizAnswerSchema).max(100000).default([]),
});
export async function exportLearning() {
  const db = learningDb;
  return {
    app: "HanziGo" as const,
    version: 1 as const,
    exportedAt: Date.now(),
    cards: await db.cards.toArray(),
    progress: await db.progress.toArray(),
    activities: await db.activities.toArray(),
    reviews: await db.reviews.toArray(),
    favorites: await db.favorites.toArray(),
    studyDays: await db.studyDays.toArray(),
    quizAnswers: await db.quizAnswers.toArray(),
  };
}
export async function importLearning(input: unknown, database = learningDb) {
  const db = database;
  const data = backupSchema.parse(input);
  const validCards = new Set(vocabulary.map((v) => v.id));
  if (
    data.cards.some((c) => !validCards.has(c.id)) ||
    data.reviews.some((c) => !validCards.has(c.cardId))
  )
    throw new Error(
      "Bản sao lưu chứa từ không có trong phiên bản nội dung này.",
    );
  for (const p of data.progress) {
    const s = stories.find((s) => s.id === p.id);
    if (
      !s ||
      p.sentence >= s.paragraphs.flat().length ||
      (p.quizScore ?? 0) > s.comprehensionQuestions.length
    )
      throw new Error("Tiến độ truyện không hợp lệ.");
  }
  if (
    data.favorites.some(
      (f) =>
        !stories.some((s) => f.id === `story:${s.id}`) &&
        !quotes.some((q) => f.id === `quote:${q.id}`),
    )
  )
    throw new Error("Mục yêu thích không hợp lệ.");
  for (const a of data.activities)
    if (a.xp !== XP[a.kind] || a.at > Date.now() + DAY)
      throw new Error("Hoạt động không hợp lệ.");
  await db.transaction(
    "rw",
    [
      db.cards,
      db.progress,
      db.activities,
      db.reviews,
      db.favorites,
      db.studyDays,
      db.quizAnswers,
      db.syncQueue,
    ],
    async () => {
      for (const item of data.studyDays) {
        const old = await db.studyDays.get(item.id);
        await putAccountRecord(
          db,
          "studyDays",
          old ? mergeStudyDay(old, item) : item,
        );
      }
      for (const item of data.quizAnswers)
        if (!(await db.quizAnswers.get(item.id)))
          await putAccountRecord(db, "quizAnswers", item);
      for (const item of data.cards) {
        const old = await db.cards.get(item.id);
        if (!old || item.updatedAt > old.updatedAt)
          await putAccountRecord(db, "cards", item);
      }
      for (const item of data.progress) {
        const old = await db.progress.get(item.id);
        if (!old || item.updatedAt > old.updatedAt)
          await putAccountRecord(db, "progress", {
            ...item,
            completed: item.completed || !!old?.completed,
            quizScore: Math.max(item.quizScore ?? 0, old?.quizScore ?? 0),
          });
      }
      for (const item of data.activities)
        if (!(await db.activities.get(item.id)))
          await putAccountRecord(db, "activities", item);
      for (const item of data.reviews)
        if (!(await db.reviews.get(item.id)))
          await putAccountRecord(db, "reviews", item);
      for (const item of data.favorites) {
        const old = await db.favorites.get(item.id);
        if (!old || item.updatedAt > old.updatedAt)
          await putAccountRecord(db, "favorites", item);
      }
    },
  );
}
