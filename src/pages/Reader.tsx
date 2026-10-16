import { useLibraryRevision } from "@/content";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { findStory } from "@/content";
import type { Story, Vocabulary } from "@/content/schema";
import {
  getLearningDatabase,
  completeStory,
  saveReadingPosition,
} from "@/lib/db";
import { usePreferences, useUI, reportError, run } from "@/lib/store";
import { localDay } from "@/lib/learning";
import { useNow } from "@/lib/hooks";
import { stopAudio } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Badge, AudioButton, Empty, Loading } from "@/components/Common";
import { VocabularySheet } from "@/components/VocabularySheet";
import { Quiz } from "@/components/Quiz";
import { StoryText } from "@/components/StoryText";
export default function Reader() {
  const libraryRevision = useLibraryRevision();
  const { id } = useParams();
  const story = findStory(id);
  return story ? (
    <StoryReader key={`${story.id}:${libraryRevision}`} story={story} />
  ) : (
    <Empty title="Câu chuyện này chưa có">
      <Link to="/stories" className="text-link">
        Về thư viện
      </Link>
    </Empty>
  );
}
function StoryReader({ story }: { story: Story }) {
  const pref = usePreferences();
  const { hash } = useLocation();
  const now = useNow(),
    day = localDay(now);
  const plan = useLiveQuery(
    () => getLearningDatabase().studyDays.get(day),
    [day],
  );
  const dailyReading = plan?.storyId === story.id && !plan.readAt;
  const [word, setWord] = useState<Vocabulary | null>(null);
  const [busy, setBusy] = useState(false);
  const [canReadQuiz, setCanReadQuiz] = useState(true);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const position = useRef(0);
  const initialized = useRef(false);
  const progress = useLiveQuery(
    async () => ({ value: await getLearningDatabase().progress.get(story.id) }),
    [story.id],
  );
  const sentences = story.paragraphs.flat();
  useEffect(() => {
    if (!progress || initialized.current) return;
    initialized.current = true;
    position.current = progress.value?.sentence ?? 0;
    if (!hash && position.current > 0 && !progress.value?.completed) {
      requestAnimationFrame(() =>
        refs.current[position.current]?.scrollIntoView({
          block: "center",
          behavior: "instant",
        }),
      );
      useUI.getState().notify("Mình đọc tiếp từ chỗ em dừng nhé.");
    }
  }, [progress, hash]);
  const ready = !!progress;
  useEffect(() => {
    if (!ready || hash !== "#quiz") return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById("quiz")
        ?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [ready, hash]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const nearest = refs.current
          .map((el, i) => ({
            i,
            top: el?.getBoundingClientRect().top ?? 99999,
          }))
          .filter((x) => x.top < window.innerHeight * 0.55)
          .at(-1);
        if (!nearest || !initialized.current) return;
        position.current = nearest.i;
        run(async () => {
          await saveReadingPosition(story.id, nearest.i);
        });
      }, 350);
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", save);
      stopAudio();
    };
  }, [story.id]);
  if (!progress) return <Loading />;
  return (
    <div className="reader">
      <Link to="/stories" className="text-link back-link">
        <ArrowLeft size={17} />
        Thư viện truyện
      </Link>
      <header className="reader-heading">
        <div className="button-row">
          <Badge className="badge-sage">{story.difficulty}</Badge>
          <span className="muted">
            {story.topic} · {story.estimatedMinutes} phút
          </span>
        </div>
        <h1>{story.titleVi}</h1>
        <p className="reader-title-zh" lang="zh-CN">
          {story.titleZh}
        </p>
        <p className="muted">{story.subtitle}</p>
      </header>
      <div className="reading-area">
        <div className="reader-toolbar">
          <div className="button-row">
            <Button
              variant={pref.pinyin ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={pref.pinyin}
              onClick={() => pref.set({ pinyin: !pref.pinyin })}
            >
              Pinyin
            </Button>
            <Button
              variant={pref.translation ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={pref.translation}
              onClick={() => pref.set({ translation: !pref.translation })}
            >
              Bản dịch
            </Button>
            <div className="font-control">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Giảm cỡ chữ"
                disabled={pref.fontSize <= 20}
                onClick={() => pref.set({ fontSize: pref.fontSize - 2 })}
              >
                <Minus size={16} />
              </Button>
              <span>Aa</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Tăng cỡ chữ"
                disabled={pref.fontSize >= 36}
                onClick={() => pref.set({ fontSize: pref.fontSize + 2 })}
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>
          <div className="button-row">
            <AudioButton
              text={sentences.map((s) => s.hanzi).join(" ")}
              label="Nghe truyện"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Lưu vị trí đọc hiện tại"
              onClick={() =>
                run(async () => {
                  await saveReadingPosition(story.id, position.current);
                  useUI.getState().notify("Đã đánh dấu chỗ đọc của em.");
                })
              }
            >
              <Bookmark size={18} />
            </Button>
          </div>
        </div>
        <div className="reader-tip">
          <Sparkles size={16} />
          Chạm vào cụm từ có gạch dưới để xem nghĩa và lưu từ.
        </div>
        <article
          className="card reader-paper"
          style={
            { "--reader-font": `${pref.fontSize}px` } as React.CSSProperties
          }
        >
          <StoryText
            story={story}
            pinyin={pref.pinyin}
            translation={pref.translation}
            onWord={setWord}
            onSentenceRef={(idx, el) => {
              refs.current[idx] = el;
            }}
          />
          <div className="reader-end">
            <span className="floral-divider">✿</span>
            <p>Đến đây là hết câu chuyện rồi. Cảm ơn em đã đọc cùng mình.</p>
            <Button
              disabled={busy || (!!progress.value?.completed && !dailyReading)}
              onClick={() => {
                setBusy(true);
                void completeStory(story.id, sentences.length - 1)
                  .then(() =>
                    useUI
                      .getState()
                      .notify(
                        progress.value?.completed
                          ? "Đã ghi nhận lượt đọc hôm nay."
                          : "Một câu chuyện đã nở hoa trong vườn! +30 XP",
                      ),
                  )
                  .catch(reportError)
                  .finally(() => setBusy(false));
              }}
            >
              {progress.value?.completed ? (
                <Check size={18} />
              ) : (
                <Sparkles size={18} />
              )}{" "}
              {dailyReading && progress.value?.completed
                ? "Đánh dấu đã đọc hôm nay"
                : progress.value?.completed
                  ? "Em đã đọc câu chuyện này"
                  : "Đánh dấu đã đọc · +30 XP"}
            </Button>
          </div>
        </article>
      </div>
      <div className="reader-next">
        <Link className="text-link" to="/">
          Xem lộ trình hôm nay →
        </Link>
        <Link className="text-link" to={`/review?story=${story.id}`}>
          Ôn bộ {story.glossary.length} từ của truyện →
        </Link>
      </div>
      <Quiz
        key={story.id}
        story={story}
        onComplete={() => setCanReadQuiz(false)}
      />
      {!canReadQuiz && (
        <div className="reader-next">
          <Link className="text-link" to={`/review?story=${story.id}`}>
            Ôn những từ em vừa lưu →
          </Link>
          <Link className="text-link" to="/letters">
            Ghé hộp thư →
          </Link>
        </div>
      )}
      <p className="content-note">
        Từ được tra từ glossary biên soạn, không phải từ điển tự động. Giọng đọc
        phụ thuộc thiết bị và có thể cần mạng. Nội dung ngôn ngữ: bản nháp.
      </p>
      <VocabularySheet word={word} onClose={() => setWord(null)} />
    </div>
  );
}
