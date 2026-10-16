import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stories } from "../../src/content";
import {
  db,
  completeStory,
  exportLearning,
  importLearning,
  selectLearningDatabase,
  saveVocabulary,
  reviewVocabulary,
  migrateGuestLearning,
} from "../../src/lib/db";
import { ensureStudyDay, submitQuizAnswers } from "../../src/lib/study-db";
import {
  collectMistakes,
  questionVersion,
  studyDayProgress,
  mergeStudyDay,
} from "../../src/lib/study";
import { DAY, localDay } from "../../src/lib/learning";

const story = stories[0],
  q = story.comprehensionQuestions[0];
const now = new Date(2026, 9, 16, 10).getTime();
const wrong = (q.answer + 1) % q.options.length;
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  selectLearningDatabase(null);
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe("mistake learning history", () => {
  it("persists wrong answers with the quiz result and schedules spaced corrections", async () => {
    const choices = Object.fromEntries(
      story.comprehensionQuestions.map((x) => [x.id, x.answer]),
    );
    await submitQuizAnswers(story, { ...choices, [q.id]: wrong }, "story", now);
    db.close();
    await db.open();
    let mistakes = collectMistakes(stories, await db.quizAnswers.toArray());
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].dueAt).toBe(now + DAY);
    expect((await db.progress.get(story.id))?.quizScore).toBe(2);
    await submitQuizAnswers(story, { [q.id]: q.answer }, "mistake", now + DAY);
    await submitQuizAnswers(
      story,
      { [q.id]: q.answer },
      "mistake",
      now + DAY + 100,
    );
    mistakes = collectMistakes(stories, await db.quizAnswers.toArray());
    expect(mistakes[0].corrections).toBe(1);
    expect(mistakes[0].mastered).toBe(false);
    expect(mistakes[0].dueAt).toBe(now + 4 * DAY + 100);
    await submitQuizAnswers(
      story,
      { [q.id]: q.answer },
      "mistake",
      now + 4 * DAY + 100,
    );
    expect(
      collectMistakes(stories, await db.quizAnswers.toArray())[0].mastered,
    ).toBe(true);
    expect(await db.activities.count()).toBe(0); // Notebook retries never farm quiz XP.
    await submitQuizAnswers(story, { [q.id]: wrong }, "mistake", now + 5 * DAY);
    expect(
      collectMistakes(stories, await db.quizAnswers.toArray())[0].corrections,
    ).toBe(0);
  });
  it("does not apply old mistakes to edited or removed questions", async () => {
    await submitQuizAnswers(story, { [q.id]: wrong }, "mistake", now);
    const edited = {
      ...story,
      comprehensionQuestions: [{ ...q, prompt: "Câu hỏi mới?" }],
    };
    expect(questionVersion(edited.comprehensionQuestions[0])).not.toBe(
      questionVersion(q),
    );
    expect(collectMistakes([edited], await db.quizAnswers.toArray())).toEqual(
      [],
    );
    expect(collectMistakes([], await db.quizAnswers.toArray())).toEqual([]);
  });
  it("rejects partial and invalid quizzes atomically", async () => {
    await expect(submitQuizAnswers(story, { [q.id]: wrong })).rejects.toThrow();
    await expect(
      submitQuizAnswers(story, { [q.id]: 99 }, "mistake"),
    ).rejects.toThrow();
    expect(await db.quizAnswers.count()).toBe(0);
    expect(await db.progress.count()).toBe(0);
  });
  it("exports history, accepts legacy backups, and isolates signed-in accounts", async () => {
    await submitQuizAnswers(story, { [q.id]: wrong }, "mistake", now);
    const backup = await exportLearning();
    await db.quizAnswers.clear();
    await importLearning(backup);
    expect(await db.quizAnswers.count()).toBe(1);
    const { quizAnswers: _answers, studyDays: _days, ...legacy } = backup;
    await importLearning(legacy);
    const account = selectLearningDatabase(`study-${crypto.randomUUID()}`);
    expect(await account.quizAnswers.count()).toBe(0);
    await submitQuizAnswers(story, { [q.id]: wrong }, "mistake", now);
    expect(await account.syncQueue.count()).toBe(1);
    expect(await db.quizAnswers.count()).toBe(1);
    selectLearningDatabase(null);
    await account.delete();
  });
});
describe("stable daily path", () => {
  it("keeps a completed story for the rest of the day and starts a new day", async () => {
    const first = await ensureStudyDay(now);
    expect(first?.reviewIds).toEqual([]);
    await completeStory(first!.storyId, 9);
    expect((await ensureStudyDay(now))?.storyId).toBe(first?.storyId);
    expect((await ensureStudyDay(now + DAY))?.storyId).not.toBe(first?.storyId);
  });
  it("counts only planned distinct reviews and a submitted story quiz from today", async () => {
    const plan = {
      ...(await ensureStudyDay(now))!,
      reviewIds: ["a", "b"],
      readAt: now,
    };
    await submitQuizAnswers(
      story,
      Object.fromEntries(
        story.comprehensionQuestions.map((x) => [x.id, x.answer]),
      ),
      "story",
      now + 100,
    );
    const reviews = [
      { id: "r", cardId: "a", rating: "good" as const, at: now + 100 },
      { id: "r2", cardId: "a", rating: "good" as const, at: now + 200 },
    ];
    expect(
      studyDayProgress(plan, reviews, await db.quizAnswers.toArray(), story),
    ).toMatchObject({ reviewCount: 1, steps: [false, true, true] });
    expect(
      studyDayProgress(
        { ...plan, id: localDay(now + DAY) },
        reviews,
        await db.quizAnswers.toArray(),
        story,
      ).steps[2],
    ).toBe(false);
  });
  it("limits the due deck to five, completes each step, and preserves guest history on upgrade", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    for (const word of story.glossary) await saveVocabulary(word.id);
    const plan = (await ensureStudyDay(now))!;
    expect(plan.reviewIds).toHaveLength(5);
    for (const id of plan.reviewIds)
      await reviewVocabulary(id, "good", now + 100);
    await completeStory(story.id, 9);
    await submitQuizAnswers(
      story,
      Object.fromEntries(
        story.comprehensionQuestions.map((x) => [x.id, x.answer]),
      ),
      "story",
      now + 200,
    );
    const saved = (await db.studyDays.get(plan.id))!;
    expect(
      studyDayProgress(
        saved,
        await db.reviews.toArray(),
        await db.quizAnswers.toArray(),
        story,
      ).completed,
    ).toBe(3);
    const uid = `study-upgrade-${crypto.randomUUID()}`;
    await migrateGuestLearning(uid);
    const account = selectLearningDatabase(uid);
    expect(await account.studyDays.count()).toBe(1);
    expect(await account.quizAnswers.count()).toBe(3);
    expect(await account.syncQueue.get(`studyDays:${plan.id}`)).toBeDefined();
    selectLearningDatabase(null);
    await account.delete();
  });
  it("does not count an incomplete or edited quiz as the full daily quiz", async () => {
    const plan = (await ensureStudyDay(now))!;
    await submitQuizAnswers(
      story,
      Object.fromEntries(
        story.comprehensionQuestions.map((x) => [x.id, x.answer]),
      ),
      "story",
      now + 100,
    );
    const answers = await db.quizAnswers.toArray();
    expect(
      studyDayProgress(plan, [], answers.slice(0, 1), story).steps[2],
    ).toBe(false);
    const edited = {
      ...story,
      comprehensionQuestions: story.comprehensionQuestions.map((x, i) =>
        i ? x : { ...x, prompt: "Edited prompt" },
      ),
    };
    expect(studyDayProgress(plan, [], answers, edited).steps[2]).toBe(false);
  });
  it("converges competing devices to the earlier plan without losing reading completion", () => {
    const old = {
      id: localDay(now),
      storyId: story.id,
      reviewIds: [],
      startedAt: now,
      readAt: now + 200,
      updatedAt: now + 200,
    };
    const next = {
      ...old,
      startedAt: now + 100,
      readAt: 0,
      updatedAt: now + 300,
    };
    expect(mergeStudyDay(old, next)).toEqual(mergeStudyDay(next, old));
    expect(mergeStudyDay(old, next).readAt).toBe(now + 200);
    expect(
      mergeStudyDay(old, { ...next, storyId: stories[1].id }).storyId,
    ).toBe(story.id);
  });
});
