import { describe, it, expect } from "vitest";
import {
  normalizeQuizDisplay,
  toggleQuizLanguage,
  quizTextLines,
  type QuizDisplay,
} from "../../src/lib/quiz-display";
import { stories } from "../../src/content";
import { storySchema } from "../../src/content/schema";
import { copyStory, readStoryJSON } from "../../src/lib/content-editor";
describe("quiz language display", () => {
  it("migrates missing or invalid preferences without hiding text", () => {
    expect(normalizeQuizDisplay(undefined)).toEqual({
      hanzi: true,
      pinyin: true,
      vietnamese: true,
    });
    expect(
      normalizeQuizDisplay({ hanzi: "false", pinyin: false, vietnamese: true }),
    ).toEqual({ hanzi: true, pinyin: false, vietnamese: true });
    expect(
      normalizeQuizDisplay({ hanzi: false, pinyin: false, vietnamese: false }),
    ).toEqual({ hanzi: false, pinyin: false, vietnamese: true });
  });
  it("prevents disabling the last visible language", () => {
    const onlyChinese = { hanzi: true, pinyin: false, vietnamese: false };
    expect(toggleQuizLanguage(onlyChinese, "hanzi")).toEqual(onlyChinese);
    expect(toggleQuizLanguage(onlyChinese, "pinyin")).toEqual({
      hanzi: true,
      pinyin: true,
      vietnamese: false,
    });
  });
  it("supports all seven nonempty combinations, keeping line order", () => {
    const translation = { hanzi: "下雨了。", pinyin: "Xià yǔ le." };
    for (let mask = 1; mask < 8; mask++) {
      const display: QuizDisplay = {
        hanzi: !!(mask & 1),
        pinyin: !!(mask & 2),
        vietnamese: !!(mask & 4),
      };
      const lines = quizTextLines("Trời mưa rồi.", translation, display);
      expect(lines.map((line) => line.language)).toEqual(
        (Object.keys(display) as (keyof QuizDisplay)[]).filter(
          (key) => display[key],
        ),
      );
      expect(lines.every((line) => line.text.length > 0)).toBe(true);
    }
  });
  it("falls back to Vietnamese for older questions without translations", () => {
    expect(
      quizTextLines("Trời mưa rồi.", undefined, {
        hanzi: true,
        pinyin: true,
        vietnamese: false,
      }),
    ).toEqual([{ language: "vietnamese", text: "Trời mưa rồi." }]);
    const legacy = structuredClone(stories[0]);
    legacy.comprehensionQuestions.forEach(
      (question) => delete question.chinese,
    );
    expect(storySchema.safeParse(legacy).success).toBe(true);
  });
  it("has complete aligned translations for every seeded prompt, option and explanation", () => {
    const questions = stories.flatMap((story) => story.comprehensionQuestions);
    expect(questions).toHaveLength(60);
    for (const question of questions) {
      const translation = question.chinese!;
      expect(translation).toBeDefined();
      expect(translation.options).toHaveLength(question.options.length);
      for (const text of [
        translation.prompt,
        ...translation.options,
        translation.explanation,
      ]) {
        expect(text.hanzi).toMatch(/[\u3400-\u9fff]/);
        expect(text.pinyin).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
        expect(text.pinyin).not.toMatch(/[\u3400-\u9fff]/);
      }
      expect(question.answer).toBeLessThan(translation.options.length);
    }
  });
  it("rejects missing pronunciation and mismatching translated option arrays", () => {
    const invalid = structuredClone(stories[0]);
    invalid.comprehensionQuestions[0].chinese!.options.push({
      hanzi: "另一个选择。",
      pinyin: "Lìng yí gè xuǎn zé.",
    });
    expect(storySchema.safeParse(invalid).success).toBe(false);
    const incomplete = structuredClone(stories[0]);
    incomplete.comprehensionQuestions[0].chinese!.prompt.pinyin = " ";
    expect(storySchema.safeParse(incomplete).success).toBe(false);
  });
  it("preserves translations and answer indexes through copy/export/import", () => {
    const copied = copyStory(stories[0], "new-quiz-story");
    const imported = readStoryJSON(JSON.stringify(copied));
    for (let i = 0; i < 3; i++) {
      expect(imported.comprehensionQuestions[i].chinese).toEqual(
        stories[0].comprehensionQuestions[i].chinese,
      );
      expect(imported.comprehensionQuestions[i].answer).toBe(
        stories[0].comprehensionQuestions[i].answer,
      );
    }
  });
});
