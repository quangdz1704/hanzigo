import { useState } from "react";
import type { Story } from "@/content/schema";
import { Button } from "./ui/button";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { submitQuizAnswers } from "@/lib/study-db";
import type { Question } from "@/lib/study";
import { Link } from "react-router-dom";
import { reportError, useUI, usePreferences } from "@/lib/store";
import { toggleQuizLanguage, type QuizLanguage } from "@/lib/quiz-display";
import { QuizText } from "./QuizText";
export function Quiz({
  story,
  onComplete,
  practice,
}: {
  story: Story;
  onComplete?: () => void;
  practice?: Question;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const prefs = usePreferences();
  const questions = practice ? [practice] : story.comprehensionQuestions;
  const hasChinese = questions.every((q) => !!q.chinese);
  const display = hasChinese
    ? prefs.quizDisplay
    : { hanzi: false, pinyin: false, vietnamese: true };
  const score = questions.filter((q) => answers[q.id] === q.answer).length;
  return (
    <section
      id="quiz"
      className="card quiz-section"
      aria-label="Câu hỏi hiểu truyện"
    >
      <div className="section-heading">
        <h2>
          {practice ? "Ôn lại câu từng nhầm" : "Một chút để nhớ câu chuyện"}
        </h2>
        <BadgeScore
          submitted={submitted}
          score={score}
          total={questions.length}
        />
      </div>
      <p className="muted">
        {practice
          ? "Chọn lại đáp án, rồi mình xem phần giải thích nhé. Hai ngày trả lời đúng sẽ đưa câu này vào mục Đã nhớ."
          : "Không cần vội. Em có thể quay lại đọc bất cứ lúc nào."}
      </p>
      <div
        className="quiz-language-controls"
        role="group"
        aria-label="Ngôn ngữ câu hỏi và đáp án"
      >
        {(
          [
            ["hanzi", "Chữ Hán"],
            ["pinyin", "Pinyin"],
            ["vietnamese", "Tiếng Việt"],
          ] as [QuizLanguage, string][]
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={display[key] ? "secondary" : "outline"}
            aria-pressed={display[key]}
            disabled={
              (!hasChinese && key !== "vietnamese") ||
              (display[key] &&
                Object.values(display).filter(Boolean).length === 1)
            }
            onClick={() =>
              prefs.set({ quizDisplay: toggleQuizLanguage(display, key) })
            }
          >
            {label}
          </Button>
        ))}
      </div>
      {!hasChinese && (
        <p className="content-note">Bài này hiện chưa có bản Chữ Hán/Pinyin.</p>
      )}
      {questions.map((q, i) => (
        <fieldset key={q.id} className="quiz-question">
          <legend>
            <span className="quiz-prompt">
              <span>{i + 1}.</span>
              <QuizText
                vi={q.prompt}
                chinese={q.chinese?.prompt}
                display={display}
              />
            </span>
          </legend>
          <div className="quiz-options">
            {q.options.map((option, j) => (
              <label
                key={option}
                className={`quiz-option ${submitted && j === q.answer ? "correct" : ""} ${submitted && answers[q.id] === j && j !== q.answer ? "incorrect" : ""}`}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === j}
                  onChange={() => setAnswers({ ...answers, [q.id]: j })}
                  disabled={submitted || busy}
                />
                <QuizText
                  vi={option}
                  chinese={q.chinese?.options[j]}
                  display={display}
                />
                {submitted && j === q.answer && <Check size={16} />}
              </label>
            ))}
          </div>
          {submitted && (
            <p className="explanation">
              <QuizText
                vi={q.explanation}
                chinese={q.chinese?.explanation}
                display={display}
              />
            </p>
          )}
        </fieldset>
      ))}
      {submitted ? (
        <>
          <p className="quiz-result">
            <Sparkles size={20} />
            {score === questions.length
              ? practice
                ? "Đã ghi nhận lần trả lời đúng. Lịch ôn trong sổ đã được cập nhật."
                : "Em hiểu câu chuyện rồi! +15 XP cho lần đầu trả lời đúng tất cả."
              : "Em đã đọc rất chăm chú. Mình xem lại những câu còn nhầm nhé."}
          </p>
          {!practice && score < questions.length && (
            <p>
              <Link className="text-link" to="/mistakes">
                Mở sổ lỗi sai để ôn những câu này →
              </Link>
            </p>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setSubmitted(false);
              setAnswers({});
            }}
          >
            <RotateCcw size={16} /> Thử lại
          </Button>
        </>
      ) : (
        <Button
          disabled={busy || Object.keys(answers).length !== questions.length}
          onClick={() => {
            setBusy(true);
            void submitQuizAnswers(
              story,
              answers,
              practice ? "mistake" : "story",
            )
              .then(() => {
                setSubmitted(true);
                onComplete?.();
                useUI.getState().notify("Đã lưu kết quả của em.");
              })
              .catch(reportError)
              .finally(() => setBusy(false));
          }}
        >
          Xem kết quả
        </Button>
      )}
    </section>
  );
}
function BadgeScore({
  submitted,
  score,
  total,
}: {
  submitted: boolean;
  score: number;
  total: number;
}) {
  return (
    <span className="badge badge-sage">
      {submitted ? `${score}/${total} câu đúng` : `${total} câu hỏi`}
    </span>
  );
}
