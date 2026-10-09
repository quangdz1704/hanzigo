import type { ReactNode } from "react";
import type { Story, Sentence, Vocabulary } from "@/content/schema";
import { AudioButton } from "./Common";
function tokens(
  sentence: Sentence,
  story: Story,
  onWord: (word: Vocabulary) => void,
) {
  const words = story.glossary
    .filter((v) => sentence.glossaryIds.includes(v.id))
    .sort((a, b) => b.hanzi.length - a.hanzi.length);
  const result: ReactNode[] = [];
  let plain = "";
  let i = 0;
  const flush = () => {
    if (plain) {
      result.push(<span key={`plain-${i}`}>{plain}</span>);
      plain = "";
    }
  };
  while (i < sentence.hanzi.length) {
    const word = words.find((w) => sentence.hanzi.startsWith(w.hanzi, i));
    if (word) {
      flush();
      result.push(
        <button
          className="glossary-token"
          key={`${word.id}-${i}`}
          onClick={() => onWord(word)}
          aria-label={`Tra ${word.hanzi}`}
        >
          {word.hanzi}
        </button>,
      );
      i += word.hanzi.length;
    } else {
      plain += sentence.hanzi[i];
      i++;
    }
  }
  flush();
  return result;
}

/** Shared reading surface: preview uses the same glossary, audio, and text as the learner. */
export function StoryText({
  story,
  pinyin,
  translation,
  onWord,
  onSentenceRef,
}: {
  story: Story;
  pinyin: boolean;
  translation: boolean;
  onWord: (word: Vocabulary) => void;
  onSentenceRef?: (index: number, element: HTMLDivElement | null) => void;
}) {
  const sentences = story.paragraphs.flat();
  return (
    <>
      {story.paragraphs.map((paragraph, pi) => (
        <section className="story-paragraph" key={pi}>
          {paragraph.map((sentence) => {
            const idx = sentences.indexOf(sentence);
            return (
              <div
                className="story-sentence"
                key={sentence.id}
                ref={(el) => onSentenceRef?.(idx, el)}
              >
                <div className="sentence-main">
                  <p lang="zh-CN" className="hanzi-text">
                    {tokens(sentence, story, onWord)}
                  </p>
                  <AudioButton
                    compact
                    text={sentence.hanzi}
                    url={sentence.audioUrl}
                    label={`Nghe câu ${idx + 1}`}
                  />
                </div>
                {pinyin && (
                  <p className="pinyin" lang="zh-Latn">
                    {sentence.pinyin}
                  </p>
                )}
                {translation && (
                  <p className="sentence-translation">{sentence.vi}</p>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
