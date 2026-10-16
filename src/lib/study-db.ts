import { stories } from "@/content";
import type { Story } from "@/content/schema";
import { getLearningDatabase, putAccountRecord, recordQuiz } from "./db";
import { localDay } from "./learning";
import {
  chooseStudyDay,
  questionVersion,
  type QuizAnswer,
  type StudyDay,
} from "./study";

export async function ensureStudyDay(
  now = Date.now(),
): Promise<StudyDay | null> {
  const db = getLearningDatabase();
  return db.transaction(
    "rw",
    [db.studyDays, db.cards, db.progress, db.syncQueue],
    async () => {
      const prior = await db.studyDays.get(localDay(now));
      if (prior) return prior;
      const plan = chooseStudyDay(
        stories,
        await db.progress.toArray(),
        await db.cards.toArray(),
        now,
      );
      if (plan) await putAccountRecord(db, "studyDays", plan);
      return plan;
    },
  );
}
export async function submitQuizAnswers(
  story: Story,
  choices: Record<string, number>,
  source: QuizAnswer["source"] = "story",
  now = Date.now(),
) {
  const db = getLearningDatabase();
  const questions = story.comprehensionQuestions.filter((q) =>
    Object.hasOwn(choices, q.id),
  );
  if (
    !questions.length ||
    (source === "story" &&
      questions.length !== story.comprehensionQuestions.length) ||
    Object.keys(choices).length !== questions.length ||
    questions.some(
      (q) =>
        !Number.isInteger(choices[q.id]) ||
        choices[q.id] < 0 ||
        choices[q.id] >= q.options.length,
    )
  )
    throw new Error("Em chọn đủ đáp án hợp lệ trước khi lưu nhé.");
  const attemptId = crypto.randomUUID();
  const answers: QuizAnswer[] = questions.map((q) => ({
    id: `${attemptId}:${q.id}`,
    attemptId,
    storyId: story.id,
    questionId: q.id,
    version: questionVersion(q),
    choice: choices[q.id],
    answer: q.answer,
    source,
    at: now,
  }));
  await db.transaction(
    "rw",
    [db.quizAnswers, db.progress, db.activities, db.syncQueue],
    async () => {
      for (const answer of answers)
        await putAccountRecord(db, "quizAnswers", answer);
      if (source === "story")
        await recordQuiz(
          story.id,
          answers.filter((a) => a.choice === a.answer).length,
          questions.length,
          db,
        );
    },
  );
}
