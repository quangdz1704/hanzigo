import { z } from "zod";
import { musicCatalogSchema } from "./music-schema";
const identifier = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "ID chỉ dùng chữ thường, số và dấu gạch ngang",
  );
const audioUrl = z
  .url()
  .refine((url) => new URL(url).protocol === "https:", "Audio cần URL HTTPS");
export const vocabularySchema = z.object({
  id: identifier,
  hanzi: z.string().min(1),
  pinyin: z.string().min(1),
  meaning: z.string().min(1),
  example: z.string().min(1),
  examplePinyin: z.string().min(1),
  exampleVi: z.string().min(1),
  storyId: z.string().min(1),
  audioUrl: audioUrl.optional(),
});
export const sentenceSchema = z.object({
  id: identifier,
  hanzi: z.string().min(1),
  pinyin: z.string().min(1),
  vi: z.string().min(1),
  glossaryIds: z.array(z.string()),
  audioUrl: audioUrl.optional(),
});
export const questionSchema = z
  .object({
    id: identifier,
    prompt: z.string().min(1),
    options: z.array(z.string()).min(3).max(5),
    answer: z.number().int().nonnegative(),
    explanation: z.string().min(1),
    chinese: z
      .object({
        prompt: z.object({
          hanzi: z.string().trim().min(1).max(500),
          pinyin: z.string().trim().min(1).max(1500),
        }),
        options: z
          .array(
            z.object({
              hanzi: z.string().trim().min(1).max(500),
              pinyin: z.string().trim().min(1).max(1500),
            }),
          )
          .min(3)
          .max(5),
        explanation: z.object({
          hanzi: z.string().trim().min(1).max(1000),
          pinyin: z.string().trim().min(1).max(3000),
        }),
      })
      .optional(),
  })
  .refine((q) => q.answer < q.options.length, {
    message: "Answer index outside options",
  })
  .refine((q) => !q.chinese || q.chinese.options.length === q.options.length, {
    path: ["chinese", "options"],
    message: "Số lựa chọn Trung/Pinyin phải khớp với lựa chọn tiếng Việt",
  });
export const storySchema = z
  .object({
    id: identifier,
    titleZh: z.string().trim().min(1).max(150),
    titleVi: z.string().trim().min(1).max(150),
    subtitle: z.string().trim().min(1).max(300),
    difficulty: z.enum(["HSK 3", "HSK 4", "HSK 5"]),
    topic: z.string().trim().min(1).max(80),
    estimatedMinutes: z.number().int().positive().max(60),
    art: z.enum(["cafe", "books", "travel", "friends", "home"]),
    tags: z.array(z.string()),
    paragraphs: z.array(z.array(sentenceSchema).min(1).max(30)).min(3).max(30),
    glossary: z.array(vocabularySchema).min(10).max(100),
    comprehensionQuestions: z.array(questionSchema).min(3).max(10),
    wordOrder: z.object({
      words: z.array(z.string().min(1)).min(3).max(30),
      pinyin: z.string().min(1),
      vi: z.string().min(1),
    }),
    attribution: z.object({
      author: z.string(),
      license: z.string(),
      reviewStatus: z.literal("draft"),
    }),
  })
  .superRefine((story, ctx) => {
    const allIds = [
      story.id,
      ...story.glossary.map((v) => v.id),
      ...story.paragraphs.flat().map((s) => s.id),
      ...story.comprehensionQuestions.map((q) => q.id),
    ];
    if (new Set(allIds).size !== allIds.length)
      ctx.addIssue({
        code: "custom",
        message: "IDs trong truyện không được trùng",
      });
    const ids = new Set(story.glossary.map((v) => v.id));
    if (ids.size !== story.glossary.length)
      ctx.addIssue({ code: "custom", message: "Duplicate glossary IDs" });
    for (const v of story.glossary)
      if (v.storyId !== story.id)
        ctx.addIssue({
          code: "custom",
          message: "Incorrect vocabulary story source",
        });
    for (const v of story.glossary)
      if (!story.paragraphs.flat().some((s) => s.glossaryIds.includes(v.id)))
        ctx.addIssue({
          code: "custom",
          message: `Từ ${v.id} chưa được gắn vào câu nào`,
        });
    for (const sentence of story.paragraphs.flat())
      for (const id of sentence.glossaryIds) {
        const v = story.glossary.find((v) => v.id === id);
        if (!v || !sentence.hanzi.includes(v.hanzi))
          ctx.addIssue({
            code: "custom",
            message: `Invalid glossary mapping ${sentence.id}: ${id}`,
          });
      }
  });
export const quoteSchema = z.object({
  id: z.string(),
  hanzi: z.string(),
  pinyin: z.string(),
  vi: z.string(),
});
export const contentSchema = z
  .object({
    version: z.literal(1),
    music: musicCatalogSchema.optional(),
    stories: z.array(storySchema).min(5),
    quotes: z.array(quoteSchema).min(30),
  })
  .superRefine((data, ctx) => {
    const ids = [
      ...data.stories.map((s) => s.id),
      ...data.quotes.map((q) => q.id),
      ...data.stories.flatMap((s) => s.glossary.map((v) => v.id)),
      ...data.stories.flatMap((s) => s.paragraphs.flat().map((v) => v.id)),
      ...data.stories.flatMap((s) => s.comprehensionQuestions.map((q) => q.id)),
    ];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Content IDs must be globally unique",
      });
  });
export type Story = z.infer<typeof storySchema>;
export type Sentence = z.infer<typeof sentenceSchema>;
export type Vocabulary = z.infer<typeof vocabularySchema>;
export type Quote = z.infer<typeof quoteSchema>;
