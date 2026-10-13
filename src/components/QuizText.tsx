import { quizTextLines, type QuizDisplay } from "@/lib/quiz-display";
export function QuizText({
  vi,
  chinese,
  display,
}: {
  vi: string;
  chinese?: { hanzi: string; pinyin: string };
  display: QuizDisplay;
}) {
  return (
    <span className="quiz-text">
      {quizTextLines(vi, chinese, display).map((line) => (
        <span
          key={line.language}
          className={`quiz-${line.language}`}
          lang={
            line.language === "hanzi"
              ? "zh-CN"
              : line.language === "vietnamese"
                ? "vi"
                : "zh-Latn-pinyin"
          }
        >
          {line.text}
        </span>
      ))}
    </span>
  );
}
