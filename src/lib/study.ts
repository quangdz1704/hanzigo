import { z } from "zod";
import type { Story } from "@/content/schema";
import type { ReadingProgress, ReviewCard, ReviewLog } from "./db";
import { DAY, dailyIndex, localDay } from "./learning";

const time = z.number().finite().nonnegative();
const contentId = z.string().min(1).max(100);
export const studyDaySchema = z
  .object({
    id: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    storyId: contentId,
    reviewIds: z
      .array(contentId)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length),
    startedAt: time,
    readAt: time,
    updatedAt: time,
  })
  .strict();
export const quizAnswerSchema = z
  .object({
    id: z.string().min(1).max(250),
    attemptId: z.string().uuid(),
    storyId: contentId,
    questionId: contentId,
    version: z.string().min(1).max(40),
    choice: z.number().int().min(0).max(4),
    answer: z.number().int().min(0).max(4),
    source: z.enum(["story", "mistake"]),
    at: time,
  })
  .strict()
  .refine(
    (v) => v.id === `${v.attemptId}:${v.questionId}`,
    "Mã lần trả lời không khớp với câu hỏi.",
  );
export type StudyDay = z.infer<typeof studyDaySchema>;
export type QuizAnswer = z.infer<typeof quizAnswerSchema>;
export type Question = Story["comprehensionQuestions"][number];

// Content identity only: this hash is not an authorization or integrity check.
export function questionVersion(question: Question) {
  const text = JSON.stringify([
    question.prompt,
    question.options,
    question.answer,
    question.explanation,
    question.chinese ?? null,
  ]);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`;
}
export function chooseStudyDay(
  library: Story[],
  progress: ReadingProgress[],
  cards: ReviewCard[],
  now = Date.now(),
): StudyDay | null {
  if (!library.length) return null;
  const unfinished = progress
    .filter((p) => !p.completed)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const story =
    unfinished.map((p) => library.find((s) => s.id === p.id)).find(Boolean) ??
    library.find((s) => !progress.some((p) => p.id === s.id && p.completed)) ??
    library[dailyIndex(library.length, now)];
  const vocabularyIds = new Set(
    library.flatMap((s) => s.glossary.map((v) => v.id)),
  );
  return {
    id: localDay(now),
    storyId: story.id,
    reviewIds: cards
      .filter((c) => c.dueAt <= now && vocabularyIds.has(c.id))
      .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id))
      .slice(0, 5)
      .map((c) => c.id),
    startedAt: now,
    readAt: 0,
    updatedAt: now,
  };
}
export function mergeStudyDay(old: StudyDay, next: StudyDay): StudyDay {
  // Earliest plan wins across devices; completion only belongs to its story.
  const chosen =
    old.startedAt < next.startedAt ||
    (old.startedAt === next.startedAt &&
      JSON.stringify([old.storyId, old.reviewIds]) <
        JSON.stringify([next.storyId, next.reviewIds]))
      ? old
      : next;
  return {
    ...chosen,
    readAt:
      old.storyId === next.storyId
        ? Math.max(old.readAt, next.readAt)
        : chosen.readAt,
    updatedAt: Math.max(old.updatedAt, next.updatedAt),
  };
}
export function studyDayProgress(
  plan: StudyDay,
  reviews: ReviewLog[],
  answers: QuizAnswer[],
  story: Story,
) {
  const reviewed = new Set(
    reviews
      .filter((r) => r.at >= plan.startedAt && localDay(r.at) === plan.id)
      .map((r) => r.cardId),
  );
  const reviewCount = plan.reviewIds.filter((id) => reviewed.has(id)).length;
  const versions = new Map(
    story.comprehensionQuestions.map((q) => [q.id, questionVersion(q)]),
  );
  const attempts = new Map<string, Set<string>>();
  for (const a of answers) {
    if (
      a.storyId !== plan.storyId ||
      a.source !== "story" ||
      a.at < plan.startedAt ||
      localDay(a.at) !== plan.id ||
      versions.get(a.questionId) !== a.version
    )
      continue;
    const questions = attempts.get(a.attemptId) ?? new Set<string>();
    questions.add(a.questionId);
    attempts.set(a.attemptId, questions);
  }
  const steps = [
    reviewCount === plan.reviewIds.length,
    plan.readAt > 0,
    [...attempts.values()].some(
      (questions) => questions.size === versions.size,
    ),
  ];
  return { reviewCount, steps, completed: steps.filter(Boolean).length };
}
export interface Mistake {
  story: Story;
  question: Question;
  lastWrong: QuizAnswer;
  latest: QuizAnswer;
  wrongCount: number;
  corrections: number;
  dueAt: number;
  mastered: boolean;
}
export function collectMistakes(
  library: Story[],
  answers: QuizAnswer[],
): Mistake[] {
  const history = new Map<string, QuizAnswer[]>();
  for (const answer of answers) {
    const key = `${answer.storyId}:${answer.questionId}:${answer.version}`;
    const group = history.get(key) ?? [];
    group.push(answer);
    history.set(key, group);
  }
  const result: Mistake[] = [];
  for (const story of library)
    for (const question of story.comprehensionQuestions) {
      const group = (
        history.get(
          `${story.id}:${question.id}:${questionVersion(question)}`,
        ) ?? []
      )
        .filter(
          (a) =>
            a.answer === question.answer && a.choice < question.options.length,
        )
        .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
      const wrong = group.filter((a) => a.choice !== a.answer);
      if (!wrong.length) continue;
      const lastWrong = wrong[wrong.length - 1];
      const lastWrongIndex = group.indexOf(lastWrong);
      // Multiple retries in one sitting count as one correction day.
      const corrections = new Set(
        group.slice(lastWrongIndex + 1).map((a) => localDay(a.at)),
      ).size;
      const latest = group[group.length - 1];
      result.push({
        story,
        question,
        lastWrong,
        latest,
        wrongCount: wrong.length,
        corrections,
        dueAt: latest.at + (corrections ? 3 : 1) * DAY,
        mastered: corrections >= 2,
      });
    }
  return result.sort(
    (a, b) =>
      Number(a.mastered) - Number(b.mastered) ||
      a.dueAt - b.dueAt ||
      a.question.id.localeCompare(b.question.id),
  );
}
