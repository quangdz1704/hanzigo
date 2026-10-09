import { useState } from "react";
import type { Story } from "@/content/schema";
import { Button } from "./ui/button";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { recordQuiz } from "@/lib/db";
import { reportError, useUI } from "@/lib/store";
export function Quiz({
  story,
  onComplete,
}: {
  story: Story;
  onComplete?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const score = story.comprehensionQuestions.filter(
    (q) => answers[q.id] === q.answer,
  ).length;
  return (
    <section className="card quiz-section" aria-label="Câu hỏi hiểu truyện">
      <div className="section-heading">
        <h2>Một chút để nhớ câu chuyện</h2>
        <BadgeScore
          submitted={submitted}
          score={score}
          total={story.comprehensionQuestions.length}
        />
      </div>
      <p className="muted">
        Không cần vội. Em có thể quay lại đọc bất cứ lúc nào.
      </p>
      {story.comprehensionQuestions.map((q, i) => (
        <fieldset key={q.id} className="quiz-question">
          <legend>
            {i + 1}. {q.prompt}
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
                  disabled={submitted}
                />
                <span>{option}</span>
                {submitted && j === q.answer && <Check size={16} />}
              </label>
            ))}
          </div>
          {submitted && <p className="explanation">{q.explanation}</p>}
        </fieldset>
      ))}
      {submitted ? (
        <>
          <p className="quiz-result">
            <Sparkles size={20} />
            {score === story.comprehensionQuestions.length
              ? "Em hiểu câu chuyện rồi! +15 XP cho lần đầu trả lời đúng tất cả."
              : "Em đã đọc rất chăm chú. Mình xem lại những câu còn nhầm nhé."}
          </p>
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
          disabled={
            busy ||
            Object.keys(answers).length !== story.comprehensionQuestions.length
          }
          onClick={() => {
            setBusy(true);
            void recordQuiz(
              story.id,
              score,
              story.comprehensionQuestions.length,
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
