import { beforeEach, describe, it, expect } from "vitest";
import {
  db,
  claimLetterPopup,
  saveReadingPosition,
  saveVocabulary,
  awardActivity,
  completeStory,
  recordQuiz,
  reviewVocabulary,
  exportLearning,
  importLearning,
} from "../../src/lib/db";
import { vocabulary, stories } from "../../src/content";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe("persisted meaningful activity", () => {
  it("deduplicates concurrent rewards", async () => {
    await Promise.all([
      awardActivity("story:a", "story"),
      awardActivity("story:a", "story"),
    ]);
    expect(await db.activities.count()).toBe(1);
  });
  it("autosaving a position never overwrites concurrent completion", async () => {
    await Promise.all([
      completeStory(stories[0].id, 9),
      saveReadingPosition(stories[0].id, 5),
    ]);
    expect((await db.progress.get(stories[0].id))?.completed).toBe(true);
  });
  it("does not farm XP when completing a story again", async () => {
    await completeStory(stories[0].id, 9);
    await completeStory(stories[0].id, 9);
    expect(await db.activities.count()).toBe(1);
    expect((await db.progress.get(stories[0].id))?.completed).toBe(true);
  });
  it("only rewards a fully correct quiz once", async () => {
    await recordQuiz(stories[0].id, 1, 3);
    expect(await db.activities.count()).toBe(0);
    await recordQuiz(stories[0].id, 3, 3);
    await recordQuiz(stories[0].id, 3, 3);
    expect(await db.activities.count()).toBe(1);
  });
  it("does not duplicate saved vocabulary", async () => {
    await Promise.all([
      saveVocabulary(vocabulary[0].id),
      saveVocabulary(vocabulary[0].id),
    ]);
    expect(await db.cards.count()).toBe(1);
  });
  it("cannot review a card twice before due", async () => {
    await saveVocabulary(vocabulary[0].id);
    const now = Date.now() + 1000;
    expect(await reviewVocabulary(vocabulary[0].id, "good", now)).toBe(true);
    expect(await reviewVocabulary(vocabulary[0].id, "good", now + 100)).toBe(
      false,
    );
    expect(await db.reviews.count()).toBe(1);
    expect(await db.activities.count()).toBe(1);
  });
  it("rejects unknown words", async () =>
    await expect(saveVocabulary("invalid")).rejects.toThrow());
});
describe("one popup per letter per device", () => {
  it("claims once across concurrent tabs and keeps the claim after reopen", async () => {
    const claims = await Promise.all([
      claimLetterPopup("wife", "letter"),
      claimLetterPopup("wife", "letter"),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    db.close();
    await db.open();
    expect(await claimLetterPopup("wife", "letter")).toBe(false);
  });
  it("another recipient has a separate receipt", async () => {
    expect(await claimLetterPopup("a", "same")).toBe(true);
    expect(await claimLetterPopup("b", "same")).toBe(true);
  });
});
describe("validated, atomic backup merge", () => {
  it("preserves learning across database reopen", async () => {
    await saveVocabulary(vocabulary[0].id);
    db.close();
    await db.open();
    expect(await db.cards.count()).toBe(1);
  });
  it("does not duplicate XP on repeated imports", async () => {
    await completeStory(stories[0].id, 9);
    await saveVocabulary(vocabulary[0].id);
    const exported = await exportLearning();
    await importLearning(exported);
    await importLearning(exported);
    expect(await db.activities.count()).toBe(1);
    expect(await db.cards.count()).toBe(1);
  });
  it("rejects malformed and newer format versions without mutation", async () => {
    const exported = await exportLearning();
    await expect(
      importLearning({ ...exported, version: 999 }),
    ).rejects.toThrow();
    expect(await db.activities.count()).toBe(0);
  });
  it("rejects unknown sources and impossible positions", async () => {
    const exported = await exportLearning();
    await expect(
      importLearning({
        ...exported,
        progress: [
          { id: stories[0].id, sentence: 999, completed: false, updatedAt: 1 },
        ],
      }),
    ).rejects.toThrow();
    expect(await db.progress.count()).toBe(0);
  });
  it("rejects impossible dates and forged reward amounts", async () => {
    const exported = await exportLearning();
    await expect(
      importLearning({
        ...exported,
        activities: [
          { id: "bad", kind: "story", day: "2026-02-31", xp: 30, at: 1 },
        ],
      }),
    ).rejects.toThrow();
    await expect(
      importLearning({
        ...exported,
        activities: [
          { id: "bad", kind: "story", day: "2026-10-09", xp: 25, at: 1 },
        ],
      }),
    ).rejects.toThrow();
  });
  it("never exports private letters, receipts, recordings or auth", async () => {
    const exported = await exportLearning();
    expect(Object.keys(exported).sort()).toEqual(
      [
        "app",
        "version",
        "exportedAt",
        "cards",
        "progress",
        "activities",
        "reviews",
        "favorites",
      ].sort(),
    );
  });
});
