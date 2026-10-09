import { describe, it, expect } from "vitest";
import { content, stories, vocabulary } from "../../src/content";
import { contentSchema, storySchema } from "../../src/content/schema";
describe("original, versioned content", () => {
  it("contains the required seeds and three quizzes per complete story", () => {
    expect(stories).toHaveLength(20);
    expect(content.quotes).toHaveLength(30);
    expect(vocabulary).toHaveLength(200);
    for (const story of stories) {
      expect(story.paragraphs.flat().length).toBeGreaterThanOrEqual(8);
      expect(story.comprehensionQuestions).toHaveLength(3);
      expect(story.attribution.reviewStatus).toBe("draft");
    }
  });
  it("validates every seed", () =>
    expect(contentSchema.safeParse(content).success).toBe(true));
  it("rejects incorrect phrase mappings", () => {
    const s = structuredClone(stories[0]);
    s.paragraphs[0][0].glossaryIds.push("not-a-word");
    expect(storySchema.safeParse(s).success).toBe(false);
  });
  it("rejects an invalid answer key", () => {
    const s = structuredClone(stories[0]);
    s.comprehensionQuestions[0].answer = 99;
    expect(storySchema.safeParse(s).success).toBe(false);
  });
  it("rejects duplicate content IDs", () => {
    const c = structuredClone(content);
    c.quotes[1].id = c.quotes[0].id;
    expect(contentSchema.safeParse(c).success).toBe(false);
  });
  it("includes tones in every pronunciation entry", () => {
    const toned = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
    expect(vocabulary.every((v) => toned.test(v.pinyin))).toBe(true);
  });
});
