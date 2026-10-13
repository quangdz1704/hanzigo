export interface QuizDisplay {
  hanzi: boolean;
  pinyin: boolean;
  vietnamese: boolean;
}
export type QuizLanguage = keyof QuizDisplay;
export function normalizeQuizDisplay(value: unknown): QuizDisplay {
  const saved =
    value && typeof value === "object" ? (value as Partial<QuizDisplay>) : {};
  const display = {
    hanzi: typeof saved.hanzi === "boolean" ? saved.hanzi : true,
    pinyin: typeof saved.pinyin === "boolean" ? saved.pinyin : true,
    vietnamese: typeof saved.vietnamese === "boolean" ? saved.vietnamese : true,
  };
  if (!Object.values(display).some(Boolean)) display.vietnamese = true;
  return display;
}
export function toggleQuizLanguage(
  display: QuizDisplay,
  language: QuizLanguage,
): QuizDisplay {
  const next = { ...display, [language]: !display[language] };
  return Object.values(next).some(Boolean) ? next : display;
}
export function quizTextLines(
  vi: string,
  chinese: { hanzi: string; pinyin: string } | undefined,
  display: QuizDisplay,
) {
  const lines: { language: QuizLanguage; text: string }[] = [];
  if (chinese && display.hanzi)
    lines.push({ language: "hanzi", text: chinese.hanzi });
  if (chinese && display.pinyin)
    lines.push({ language: "pinyin", text: chinese.pinyin });
  if (display.vietnamese || !lines.length)
    lines.push({ language: "vietnamese", text: vi });
  return lines;
}
