import { z } from "zod";
import { contentSchema, storySchema, type Story } from "@/content/schema";

export const MAX_STORY_BYTES = 500_000;
export function readStoryJSON(raw: string): Story {
  if (new TextEncoder().encode(raw).length > MAX_STORY_BYTES)
    throw new Error("Truyện quá lớn: tối đa 500 KB.");
  try {
    return storySchema.parse(JSON.parse(raw));
  } catch (e) {
    if (e instanceof z.ZodError)
      throw new Error(
        e.issues
          .slice(0, 12)
          .map((i) => `${i.path.join(".") || "story"}: ${i.message}`)
          .join("\n"),
      );
    if (e instanceof SyntaxError)
      throw new Error(
        "JSON chưa hợp lệ. Kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.",
      );
    throw e;
  }
}
export function mergeStory(base: z.infer<typeof contentSchema>, story: Story) {
  return contentSchema.parse({
    ...base,
    stories: base.stories.some((s) => s.id === story.id)
      ? base.stories.map((s) => (s.id === story.id ? story : s))
      : [...base.stories, story],
  });
}
export function copyStory(source: Story, id: string): Story {
  const s = structuredClone(source);
  s.id = id;
  s.titleVi += " (bản sao)";
  const map = new Map(s.glossary.map((v, i) => [v.id, `${id}-v${i}`]));
  s.glossary = s.glossary.map((v) => ({
    ...v,
    id: map.get(v.id)!,
    storyId: id,
  }));
  s.paragraphs.flat().forEach((sentence, i) => {
    sentence.id = `${id}-s${i}`;
    sentence.glossaryIds = sentence.glossaryIds.map((old) => map.get(old)!);
  });
  s.comprehensionQuestions.forEach((q, i) => {
    q.id = `${id}-q${i}`;
  });
  return storySchema.parse(s);
}
export function downloadJSON(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
