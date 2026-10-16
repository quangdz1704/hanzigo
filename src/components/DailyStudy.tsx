import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Check, NotebookPen, Sprout } from "lucide-react";
import { findStory, useLibraryRevision, useLibraryState } from "@/content";
import { useStudyData, useNow } from "@/lib/hooks";
import { localDay } from "@/lib/learning";
import { ensureStudyDay } from "@/lib/study-db";
import { collectMistakes, studyDayProgress } from "@/lib/study";
import { stories } from "@/content";
import { reportError } from "@/lib/store";
import { useAuth } from "@/lib/Auth";
import { Button } from "./ui/button";

export function DailyStudy() {
  const revision = useLibraryRevision();
  const libraryStatus = useLibraryState((s) => s.status);
  const { learningScope } = useAuth();
  const { studyDays, quizAnswers, reviewLogs } = useStudyData();
  const now = useNow(),
    day = localDay(now);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (libraryStatus === "loading") return;
    let current = true;
    setError(false);
    void ensureStudyDay().catch((e) => {
      if (current) {
        setError(true);
        reportError(e);
      }
    });
    return () => {
      current = false;
    };
  }, [day, learningScope, revision, libraryStatus, retry]);
  const plan = studyDays.find((p) => p.id === day);
  const story = findStory(plan?.storyId);
  const due = collectMistakes(stories, quizAnswers).filter(
    (m) => !m.mastered && m.dueAt <= now,
  ).length;
  if (!plan || !story)
    return (
      <section className="card daily-study" aria-label="Lộ trình hôm nay">
        <h2>Một buổi học nhỏ hôm nay</h2>
        <p className="muted">
          {error
            ? "Chưa lưu được lộ trình. Em vẫn có thể đọc truyện và ôn từ."
            : !plan
              ? "Đang chuẩn bị lộ trình…"
              : "Truyện trong lộ trình đã được gỡ khỏi thư viện. Em chọn một truyện khác để học hôm nay nhé."}
        </p>
        {error ? (
          <Button onClick={() => setRetry((n) => n + 1)}>Thử lại</Button>
        ) : (
          <Link className="text-link" to="/stories">
            Mở thư viện →
          </Link>
        )}
      </section>
    );
  const status = studyDayProgress(plan, reviewLogs, quizAnswers, story);
  const steps = [
    {
      to: `/review?daily=${day}`,
      icon: Sprout,
      title: plan.reviewIds.length
        ? `Ôn ${plan.reviewIds.length} từ đến hạn`
        : "Hôm nay chưa có từ đến hạn",
      text: plan.reviewIds.length
        ? `${status.reviewCount}/${plan.reviewIds.length} từ đã ôn · khoảng 2 phút`
        : "Em có thể lưu thêm từ khi đọc truyện.",
    },
    {
      to: `/stories/${story.id}`,
      icon: BookOpen,
      title: `Đọc: ${story.titleVi}`,
      text: `${story.difficulty} · khoảng ${story.estimatedMinutes} phút`,
    },
    {
      to: `/stories/${story.id}#quiz`,
      icon: NotebookPen,
      title: `Làm ${story.comprehensionQuestions.length} câu hỏi`,
      text: "Những câu nhầm sẽ được lưu vào sổ lỗi sai.",
    },
  ];
  const next = status.steps.findIndex((done) => !done);
  return (
    <section className="card daily-study" aria-label="Lộ trình hôm nay">
      <div className="study-card-heading">
        <div>
          <p className="eyebrow">MỖI NGÀY MỘT CHÚT</p>
          <h2>Một buổi học nhỏ hôm nay</h2>
        </div>
        <span className="badge badge-sage">{status.completed}/3 bước</span>
      </div>
      <p className="muted">
        Khoảng {story.estimatedMinutes + (plan.reviewIds.length ? 4 : 2)} phút ·
        lộ trình được giữ đến hết ngày.
      </p>
      <div
        role="progressbar"
        aria-label="Tiến độ lộ trình hôm nay"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={status.completed}
        className="study-progress"
      >
        <span style={{ width: `${(status.completed / 3) * 100}%` }} />
      </div>
      <ol className="study-steps">
        {steps.map((step, i) => (
          <li key={step.to}>
            <Link className="daily-path-item" to={step.to}>
              <span className="path-icon theme-sage">
                {status.steps[i] ? (
                  <Check size={19} />
                ) : (
                  <step.icon size={19} />
                )}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.text}</p>
              </div>
              <span className="study-step-status">
                {status.steps[i] ? "Xong" : `${i + 1}`}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="study-card-heading">
        {next >= 0 ? (
          <Button asChild>
            <Link to={steps[next].to}>
              Tiếp tục buổi học <ArrowRight size={16} />
            </Link>
          </Button>
        ) : (
          <p className="study-complete">
            <Check size={18} /> Em đã hoàn thành lộ trình hôm nay!
          </p>
        )}
        <Link className="text-link" to="/mistakes">
          Sổ lỗi sai{due ? ` · ${due} câu đến hạn` : ""} →
        </Link>
      </div>
    </section>
  );
}
