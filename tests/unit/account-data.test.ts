import { loadAccountPreferences } from "../../src/lib/account-preferences";
import { usePreferences } from "../../src/lib/store";
import { beforeEach, describe, it, expect } from "vitest";
import {
  db,
  getAccountDatabase,
  selectLearningDatabase,
  saveVocabulary,
  completeStory,
  exportLearning,
  migrateGuestLearning,
  putAccountRecord,
} from "../../src/lib/db";
import {
  mergeAccountRecord,
  parseAccountRecord,
} from "../../src/lib/account-data";
import { packLibrary, unpackLibrary } from "../../src/lib/cloud-content";
import { bundledContent, stories, vocabulary } from "../../src/content";
beforeEach(async () => {
  selectLearningDatabase(null);
  await Promise.all(db.tables.map((t) => t.clear()));
  for (const uid of ["account-A", "account-B"]) {
    const data = getAccountDatabase(uid);
    await Promise.all(data.tables.map((t) => t.clear()));
  }
});
describe("account learning caches and persistent outbox", () => {
  it("guests stay local and first migration preserves work once without cloning account A into B", async () => {
    await completeStory(stories[0].id, 9);
    await saveVocabulary(vocabulary[0].id);
    expect(await db.syncQueue.count()).toBe(0);
    await migrateGuestLearning("account-A");
    selectLearningDatabase("account-A");
    const a = getAccountDatabase("account-A");
    expect(await a.progress.count()).toBe(1);
    expect(await a.syncQueue.count()).toBe(3);
    await completeStory(stories[1].id, 9);
    await migrateGuestLearning("account-B");
    selectLearningDatabase("account-B");
    expect((await exportLearning()).progress).toHaveLength(0);
    selectLearningDatabase(null);
    expect((await exportLearning()).progress.map((p) => p.id)).toEqual([
      stories[0].id,
    ]);
    selectLearningDatabase("account-A");
    expect((await exportLearning()).progress).toHaveLength(2);
    selectLearningDatabase(null);
  });
  it("ignores settings loaded by a stale account activation", async () => {
    const a = getAccountDatabase("account-A");
    await a.preferences.put({ id: "fontSize", value: 34, updatedAt: 1 });
    usePreferences.setState({ fontSize: 26 });
    await loadAccountPreferences(a, () => false);
    expect(usePreferences.getState().fontSize).toBe(26);
    await loadAccountPreferences(a);
    expect(usePreferences.getState().fontSize).toBe(34);
  });
  it("persists unsent edits through reopening the account cache", async () => {
    const a = getAccountDatabase("account-A");
    await a.transaction("rw", a.preferences, a.syncQueue, () =>
      putAccountRecord(a, "preferences", {
        id: "theme",
        value: "dark",
        updatedAt: 123,
      }),
    );
    a.close();
    await a.open();
    expect((await a.syncQueue.get("preferences:theme"))?.value.value).toBe(
      "dark",
    );
    expect(await getAccountDatabase("account-B").syncQueue.count()).toBe(0);
  });
});
describe("cloud record reconciliation", () => {
  it("preserves completion and highest quiz score while taking the newer reading position", () => {
    const a = {
      id: "s",
      sentence: 8,
      completed: true,
      quizScore: 3,
      updatedAt: 10,
    };
    const b = {
      id: "s",
      sentence: 2,
      completed: false,
      quizScore: 1,
      updatedAt: 20,
    };
    expect(mergeAccountRecord("progress", a, b)).toEqual({
      ...b,
      completed: true,
      quizScore: 3,
    });
    expect(mergeAccountRecord("progress", b, a)).toEqual({
      ...b,
      completed: true,
      quizScore: 3,
    });
  });
  it("deduplicates activities and converges favorite removals including timestamp ties", () => {
    const earned = {
      id: "story:s",
      kind: "story",
      day: "2026-10-14",
      xp: 30,
      at: 1,
    };
    expect(
      mergeAccountRecord("activities", earned, { ...earned, at: 2 }).at,
    ).toBe(1);
    const a = { id: "story:s", active: true, updatedAt: 1 };
    const b = { ...a, active: false, updatedAt: 2 };
    expect(mergeAccountRecord("favorites", a, b).active).toBe(false);
    const tie = { ...b, updatedAt: 1 };
    expect(mergeAccountRecord("favorites", a, tie)).toEqual(
      mergeAccountRecord("favorites", tie, a),
    );
  });
  it("rejects malformed remote settings and records with extra fields", () => {
    expect(() =>
      parseAccountRecord("preferences", {
        id: "theme",
        value: "neon",
        updatedAt: 1,
      }),
    ).toThrow();
    expect(() =>
      parseAccountRecord("progress", {
        id: "s",
        sentence: 0,
        completed: false,
        updatedAt: 1,
        role: "admin",
      }),
    ).toThrow();
  });
});
describe("published library format", () => {
  it("round-trips all stories, translations and quotes, rejects oversized or malformed publication", () => {
    expect(unpackLibrary(packLibrary(bundledContent))).toEqual(bundledContent);
    expect(() => unpackLibrary("{broken}")).toThrow();
    expect(() => unpackLibrary(" ".repeat(800001))).toThrow();
  });
});
