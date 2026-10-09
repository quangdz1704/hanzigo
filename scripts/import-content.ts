import { readFile, writeFile } from "node:fs/promises";
import { contentSchema } from "../src/content/schema";
import { readStoryJSON, mergeStory } from "../src/lib/content-editor";
const path = process.argv[2];
if (!path)
  throw new Error(
    "Usage: npm run content:import -- /path/to/content-or-story.json",
  );
const raw = await readFile(path, "utf8");
if (Buffer.byteLength(raw) > 5_000_000)
  throw new Error("Content file exceeds 5 MB.");
const input: unknown = JSON.parse(raw);
const full = contentSchema.safeParse(input);
const seedPath = new URL("../src/content/seed.json", import.meta.url);
const content = full.success
  ? full.data
  : mergeStory(
      contentSchema.parse(JSON.parse(await readFile(seedPath, "utf8"))),
      readStoryJSON(raw),
    );
await writeFile(
  new URL("../src/content/seed.json", import.meta.url),
  JSON.stringify(content, null, 2) + "\n",
);
console.log(
  "Validated content imported. Run content:validate and review Chinese/pinyin before publishing.",
);
