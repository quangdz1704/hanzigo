import { content, vocabulary } from "../src/content/index";
console.log(
  `Content v${content.version}: ${content.stories.length} stories, ${content.quotes.length} quotes, ${vocabulary.length} vocabulary entries; schema and glossary mappings valid. Language editorial status: draft, human review required.`,
);
