import { describe, it, expect, beforeEach } from "vitest";
import { content, stories } from "../../src/content";
import {
  copyStory,
  mergeStory,
  readStoryJSON,
} from "../../src/lib/content-editor";
import { db, completeStory, exportLearning } from "../../src/lib/db";
import { searchText } from "../../src/lib/utils";

describe("content workbench import and export", () => {
  it("copies all identity references and can add a complete new story", () => {
    const copy = copyStory(stories[0], "new-original");
    expect(copy.id).toBe("new-original");
    expect(copy.glossary.every((v) => v.storyId === copy.id)).toBe(true);
    const merged = mergeStory(content, copy);
    expect(merged.stories).toHaveLength(21);
    expect(content.stories).toHaveLength(20);
    expect(readStoryJSON(JSON.stringify(copy))).toEqual(copy);
  });
  it("updates an existing ID without duplicating the story", () => {
    const story = structuredClone(stories[0]);
    story.titleVi = "Tên đã chỉnh";
    const merged = mergeStory(content, story);
    expect(merged.stories).toHaveLength(20);
    expect(merged.stories[0].titleVi).toBe("Tên đã chỉnh");
    expect(content.stories[0].titleVi).not.toBe("Tên đã chỉnh");
  });
  it("rejects collisions with another story before library export", () => {
    const copy = copyStory(stories[0], "new-original");
    copy.paragraphs[0][0].id = stories[1].paragraphs[0][0].id;
    expect(() => mergeStory(content, copy)).toThrow();
  });
  it("reports malformed JSON and structural error paths", () => {
    expect(() => readStoryJSON("{bad")).toThrow("JSON chưa hợp lệ");
    const story = structuredClone(stories[0]);
    story.comprehensionQuestions[0].answer = 999;
    expect(() => readStoryJSON(JSON.stringify(story))).toThrow(
      "comprehensionQuestions.0",
    );
  });
  it("rejects invalid IDs, duplicate sentence IDs, and missing mappings", () => {
    const story = structuredClone(stories[0]);
    story.id = "../bad";
    expect(() => readStoryJSON(JSON.stringify(story))).toThrow();
    story.id = stories[0].id;
    story.paragraphs[0][1].id = story.paragraphs[0][0].id;
    expect(() => readStoryJSON(JSON.stringify(story))).toThrow("IDs");
    const unbound = structuredClone(stories[0]);
    unbound.paragraphs.flat().forEach((s) => {
      s.glossaryIds = [];
    });
    expect(() => readStoryJSON(JSON.stringify(unbound))).toThrow(
      "chưa được gắn",
    );
  });
  it("rejects oversized stories and non-HTTPS audio", () => {
    expect(() => readStoryJSON(" ".repeat(500_001))).toThrow("500 KB");
    const s = structuredClone(stories[0]);
    s.paragraphs[0][0].audioUrl = "javascript:alert(1)";
    expect(() => readStoryJSON(JSON.stringify(s))).toThrow("HTTPS");
  });
  it("matches Vietnamese without accents and tone-marked pinyin", () => {
    expect(
      searchText("Chuyến đi thật chậm").includes(searchText("chuyen di")),
    ).toBe(true);
    expect(searchText("zhǒngzi").includes("zhongzi")).toBe(true);
  });
});

describe("separate editorial drafts", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  it("keeps unfinished JSON on reopen without changing learning or exported backup", async () => {
    await completeStory(stories[0].id, 9);
    await db.contentDrafts.put({
      id: stories[0].id,
      raw: "{ unfinished",
      updatedAt: 1,
    });
    db.close();
    await db.open();
    expect((await db.contentDrafts.get(stories[0].id))?.raw).toBe(
      "{ unfinished",
    );
    expect((await db.progress.get(stories[0].id))?.completed).toBe(true);
    expect(await exportLearning()).not.toHaveProperty("contentDrafts");
  });
});
