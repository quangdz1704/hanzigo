import seed from "./seed.json";
import musicSeed from "./music-seed.json";
import { contentSchema } from "./schema";
import { create } from "zustand";
export const bundledContent = contentSchema.parse({
  ...seed,
  music: musicSeed,
});
export let content = bundledContent;
export let stories = content.stories;
export let quotes = content.quotes;
export let vocabulary = stories.flatMap((s) => s.glossary);
export const useLibraryState = create<{
  revision: number;
  source: "bundled" | "cache" | "firebase";
  status: "loading" | "ready" | "empty" | "error";
}>(() => ({ revision: 0, source: "bundled", status: "loading" }));
export const useLibraryRevision = () => useLibraryState((s) => s.revision);
export function applyLibrary(
  input: unknown,
  source: "bundled" | "cache" | "firebase",
) {
  const next = contentSchema.parse(input);
  if (JSON.stringify(next) === JSON.stringify(content)) {
    useLibraryState.setState({ source, status: "ready" });
    return;
  }
  content = next;
  stories = content.stories;
  quotes = content.quotes;
  vocabulary = stories.flatMap((s) => s.glossary);
  useLibraryState.setState((s) => ({
    revision: s.revision + 1,
    source,
    status: "ready",
  }));
}
export const findStory = (id: string | undefined) =>
  stories.find((s) => s.id === id);
