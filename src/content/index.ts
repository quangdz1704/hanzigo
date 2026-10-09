import seed from "./seed.json";
import { contentSchema } from "./schema";
export const content = contentSchema.parse(seed);
export const stories = content.stories;
export const quotes = content.quotes;
export const vocabulary = stories.flatMap((s) => s.glossary);
export const findStory = (id: string | undefined) =>
  stories.find((s) => s.id === id);
