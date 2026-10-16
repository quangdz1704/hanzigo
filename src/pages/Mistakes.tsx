import { useState } from "react";
import { Link } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import { stories, useLibraryRevision } from "@/content";
import { useStudyData, useNow } from "@/lib/hooks";
import { collectMistakes, questionVersion } from "@/lib/study";
import { usePreferences } from "@/lib/store";
import { PageHeading, Empty, Badge } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Quiz } from "@/components/Quiz";
import { QuizText } from "@/components/QuizText";

export default function Mistakes() {
  useLibraryRevision();
  const { quizAnswers } = useStudyData();
  const now = useNow();
  const display = usePreferences((s) => s.quizDisplay);
  const [tab, setTab] = useState<"learning" | "due" | "mastered">("learning");
  const [selected, setSelected] = useState<string | null>(null);
  const mistakes = collectMistakes(stories, quizAnswers);
  const learning = mistakes.filter((m) => !m.mastered);
  const due = learning.filter((m) => m.dueAt <= now);
  const visible = mistakes.filter((m) =>
    tab === "mastered"
      ? m.mastered
      : !m.mastered && (tab !== "due" || m.dueAt <= now),
  );
  const active = mistakes.find((m) => m.question.id === selected);
  return (
    <>
      <PageHeading
        eyebrow="GẶP LẠI ĐỂ NHỚ LÂU"
        title="Sổ lỗi sai"
        description="Những câu từng nhầm có một chỗ riêng để mình quay lại."
        action={
          <Badge className="badge-sage">{due.length} câu đến giờ ôn</Badge>
        }
      />
      <p className="muted study-note">
        Câu trả lời sai được hẹn ôn sau 1 ngày; lần sửa đúng đầu tiên được hẹn
        sau 3 ngày. Trả lời đúng vào hai ngày khác nhau để đánh dấu đã nhớ. Em
        cũng có thể ôn sớm.
      </p>
      <div className="tabs study-tabs" role="group" aria-label="Lọc sổ lỗi sai">
        {(
          [
            ["learning", `Đang học · ${learning.length}`],
            ["due", `Đến giờ ôn · ${due.length}`],
            ["mastered", `Đã nhớ · ${mistakes.length - learning.length}`],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? "secondary" : "ghost"}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {active && (
        <div className="mistake-practice">
          <div className="study-card-heading">
            <Link className="text-link" to={`/stories/${active.story.id}#quiz`}>
              Đọc lại: {active.story.titleVi} →
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Đóng bài ôn
            </Button>
          </div>
          <Quiz
            key={`${active.question.id}:${questionVersion(active.question)}`}
            story={active.story}
            practice={active.question}
          />
        </div>
      )}
      {visible.length ? (
        <div className="mistake-list">
          {visible.map((m) => (
            <article className="card mistake-card" key={m.question.id}>
              <div className="study-card-heading">
                <Link className="text-link" to={`/stories/${m.story.id}`}>
                  {m.story.titleVi}
                </Link>
                <Badge>
                  {m.mastered
                    ? "Đã nhớ"
                    : m.dueAt <= now
                      ? "Đến giờ ôn"
                      : `Ôn ngày ${new Date(m.dueAt).toLocaleDateString("vi-VN")}`}
                </Badge>
              </div>
              <h2>
                <QuizText
                  vi={m.question.prompt}
                  chinese={m.question.chinese?.prompt}
                  display={display}
                />
              </h2>
              <p className="muted">
                Đã nhầm {m.wrongCount} lần · {Math.min(2, m.corrections)}/2 ngày
                sửa đúng
              </p>
              <details className="mistake-explanation">
                <summary>Xem lần nhầm gần nhất và lời giải</summary>
                <p className="muted">Em đã chọn:</p>
                <QuizText
                  vi={m.question.options[m.lastWrong.choice]}
                  chinese={m.question.chinese?.options[m.lastWrong.choice]}
                  display={display}
                />
                <p className="muted">Đáp án đúng:</p>
                <QuizText
                  vi={m.question.options[m.question.answer]}
                  chinese={m.question.chinese?.options[m.question.answer]}
                  display={display}
                />
                <p className="muted">Vì sao:</p>
                <QuizText
                  vi={m.question.explanation}
                  chinese={m.question.chinese?.explanation}
                  display={display}
                />
              </details>
              <Button
                variant="secondary"
                aria-pressed={selected === m.question.id}
                onClick={() => {
                  setSelected(m.question.id);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
              >
                Ôn lại câu này
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<NotebookPen size={36} />}
          title={
            tab === "mastered"
              ? "Những câu đã nhớ sẽ ở đây"
              : tab === "due"
                ? "Chưa có câu đến giờ ôn"
                : "Chưa có câu cần ôn lại"
          }
        >
          <p>
            {tab === "due"
              ? "Em có thể xem mục Đang học để ôn sớm."
              : "Làm quiz sau mỗi truyện. Những câu trả lời nhầm sẽ tự vào sổ từ lần học này."}
          </p>
          <Link className="text-link" to="/stories">
            Ghé thư viện truyện →
          </Link>
        </Empty>
      )}
      <p className="content-note">
        Câu hỏi đã được biên tập lại sẽ bắt đầu lịch sử mới. Các lần trả lời cũ
        vẫn được giữ trong dữ liệu tài khoản.
      </p>
    </>
  );
}
