import { useLibraryRevision } from "@/content";
import { useState } from "react";
import {
  Check,
  Headphones,
  Puzzle,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { stories } from "@/content";
import type { Story } from "@/content/schema";
import { PageHeading, Badge } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Recorder } from "@/components/Recorder";
import { awardActivity } from "@/lib/db";
import { localDay } from "@/lib/learning";
import { speak, stopAudio } from "@/lib/audio";
import { usePreferences, useUI, reportError } from "@/lib/store";
const modes = [
  {
    id: "match",
    label: "Ghép đôi",
    description: "Chữ Hán tìm nghĩa Việt",
    icon: Puzzle,
  },
  {
    id: "order",
    label: "Xếp câu",
    description: "Ghép một câu hoàn chỉnh",
    icon: Sparkles,
  },
  {
    id: "listen",
    label: "Lắng nghe",
    description: "Nghe và chọn nghĩa",
    icon: Headphones,
  },
] as const;
async function reward(storyId: string, game: string) {
  const awarded = await awardActivity(
    `game:${game}:${storyId}:${localDay()}`,
    "game",
  );
  useUI
    .getState()
    .notify(
      awarded
        ? "Một niềm vui nhỏ cho vườn · +10 XP"
        : "Em đã nhận XP cho trò này hôm nay. Chơi lại vẫn vui nhé!",
    );
}
export default function Games() {
  useLibraryRevision();
  const [id, setId] = useState(stories[0].id);
  const [mode, setMode] = useState<(typeof modes)[number]["id"]>("match");
  const story = stories.find((s) => s.id === id)!;
  const sentence = story.paragraphs.flat()[0];
  return (
    <>
      <PageHeading
        eyebrow="HỌC MÀ CHƠI"
        title="Góc chơi nhỏ"
        description="Một vài phút vui với những từ em vừa gặp."
      />
      <label className="game-story-select">
        Chơi cùng câu chuyện
        <select
          value={id}
          onChange={(e) => {
            stopAudio();
            setId(e.target.value);
          }}
        >
          {stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.titleVi}
            </option>
          ))}
        </select>
      </label>
      <div className="game-mode-grid">
        {modes.map((m) => (
          <button
            key={m.id}
            className={`game-mode ${mode === m.id ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setMode(m.id);
            }}
            aria-pressed={mode === m.id}
          >
            <m.icon size={24} />
            <strong>{m.label}</strong>
            <span>{m.description}</span>
          </button>
        ))}
      </div>
      <div key={`${id}-${mode}`} className="card game-surface">
        {mode === "match" ? (
          <Matching story={story} />
        ) : mode === "order" ? (
          <WordOrder story={story} />
        ) : (
          <Listening story={story} />
        )}
      </div>
      <Recorder
        key={id}
        text={sentence.hanzi}
        pinyin={sentence.pinyin}
        vi={sentence.vi}
      />
    </>
  );
}
function Matching({ story }: { story: Story }) {
  const words = story.glossary.slice(0, 5);
  const right = [words[2], words[4], words[0], words[3], words[1]];
  const [left, setLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choose = async (id: string) => {
    if (!left) return;
    if (left !== id) {
      setError("Hai từ này chưa cùng nghĩa. Em thử lại nhé.");
      setLeft(null);
      return;
    }
    const next = [...matched, id];
    setMatched(next);
    setLeft(null);
    setError("");
    if (next.length === words.length) {
      setBusy(true);
      try {
        await reward(story.id, "match");
      } catch (e) {
        reportError(e);
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <>
      <div className="section-heading">
        <h2>Tìm người bạn của mỗi từ</h2>
        <Badge className="badge-sage">{matched.length}/5 cặp</Badge>
      </div>
      <p className="muted">Chọn một từ bên trái, rồi chọn nghĩa bên phải.</p>
      <div className="matching-grid">
        <div>
          {words.map((w) => (
            <button
              key={w.id}
              disabled={matched.includes(w.id) || busy}
              className={`matching-tile ${left === w.id ? "selected" : ""} ${matched.includes(w.id) ? "matched" : ""}`}
              onClick={() => {
                setLeft(w.id);
                setError("");
              }}
              aria-pressed={left === w.id}
            >
              <span lang="zh-CN">{w.hanzi}</span>
              {matched.includes(w.id) && <Check size={17} />}
            </button>
          ))}
        </div>
        <div>
          {right.map((w) => (
            <button
              key={w.id}
              disabled={matched.includes(w.id) || !left || busy}
              className={`matching-tile ${matched.includes(w.id) ? "matched" : ""}`}
              onClick={() => void choose(w.id)}
            >
              {w.meaning}
              {matched.includes(w.id) && <Check size={17} />}
            </button>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="game-feedback">
        {error ||
          (matched.length === 5
            ? "Ghép đủ rồi! Em đã tìm được tất cả những người bạn."
            : "Chậm một chút cũng được 🌱")}
      </p>
      {matched.length === 5 && (
        <Button
          variant="secondary"
          onClick={() => {
            setMatched([]);
            setLeft(null);
          }}
        >
          <RotateCcw size={16} />
          Chơi lại
        </Button>
      )}
    </>
  );
}
function WordOrder({ story }: { story: Story }) {
  const target = story.wordOrder;
  const order = target.words.map((_, i) => i).reverse();
  const [selected, setSelected] = useState<number[]>([]);
  const [correct, setCorrect] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="section-heading">
        <h2>Xếp một câu dịu dàng</h2>
        <Badge>{story.difficulty}</Badge>
      </div>
      <p className="muted">{target.vi}</p>
      <div className="sentence-slots" aria-label="Câu em đã xếp">
        {selected.length ? (
          selected.map((i, pos) => (
            <button
              lang="zh-CN"
              disabled={correct}
              className="word-chip filled"
              key={i}
              aria-label={`Bỏ từ ${target.words[i]}`}
              onClick={() => setSelected(selected.filter((_, p) => p !== pos))}
            >
              {target.words[i]}
            </button>
          ))
        ) : (
          <span className="muted">Chạm các từ bên dưới để xếp câu…</span>
        )}
      </div>
      <div className="word-bank">
        {order.map((i) => (
          <button
            lang="zh-CN"
            className="word-chip"
            key={i}
            disabled={selected.includes(i) || correct}
            onClick={() => {
              setSelected([...selected, i]);
              setFeedback("");
            }}
          >
            {target.words[i]}
          </button>
        ))}
      </div>
      <div className="button-row">
        <Button
          disabled={busy || selected.length !== target.words.length || correct}
          onClick={() => {
            if (
              selected.map((i) => target.words[i]).join("") !==
              target.words.join("")
            ) {
              setFeedback(
                "Câu chưa đúng thứ tự. Chạm từ phía trên để đặt lại nhé.",
              );
              return;
            }
            setCorrect(true);
            setFeedback("Đúng rồi! " + target.pinyin);
            setBusy(true);
            void reward(story.id, "order")
              .catch(reportError)
              .finally(() => setBusy(false));
          }}
        >
          Kiểm tra
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setSelected([]);
            setCorrect(false);
            setFeedback("");
          }}
        >
          <RotateCcw size={16} />
          Xếp lại
        </Button>
      </div>
      <p aria-live="polite" className="game-feedback">
        {feedback}
      </p>
    </>
  );
}
function Listening({ story }: { story: Story }) {
  const sentences = story.paragraphs.flat();
  const [index, setIndex] = useState(0);
  const [heard, setHeard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const sound = usePreferences((s) => s.sound);
  const target = sentences[index * 2];
  const distractors = stories.filter((s) => s.id !== story.id);
  const options = [
    target.vi,
    distractors[index % 4].paragraphs.flat()[0].vi,
    distractors[(index + 1) % 4].paragraphs.flat()[1].vi,
  ];
  const rotated = [...options.slice(index), ...options.slice(0, index)];
  const answer = rotated.indexOf(target.vi);
  const completed = index === 2 && choice !== null;
  return (
    <>
      <div className="section-heading">
        <h2>Một câu chuyện qua âm thanh</h2>
        <Badge>{index + 1}/3 câu</Badge>
      </div>
      <p className="muted">
        Nghe câu tiếng Trung, rồi chọn nghĩa phù hợp. Cần giọng đọc zh-CN hoặc
        zh trên thiết bị.
      </p>
      <Button
        className="listen-orb"
        disabled={busy || !sound}
        onClick={() => {
          setBusy(true);
          void speak(target.hanzi, target.audioUrl)
            .then(() => setHeard(true))
            .catch(reportError)
            .finally(() => setBusy(false));
        }}
      >
        <Volume2 size={32} />
        {busy ? "Đang nghe…" : "Nghe câu này"}
      </Button>
      {!sound && (
        <p className="muted">Bật âm thanh trong Cài đặt để chơi phần này.</p>
      )}
      <div className="listening-options">
        {rotated.map((o, i) => (
          <Button
            key={o}
            variant="outline"
            disabled={!heard || choice !== null}
            className={choice !== null && i === answer ? "correct" : ""}
            onClick={() => {
              setChoice(i);
              const next = score + (i === answer ? 1 : 0);
              setScore(next);
              if (index === 2 && next === 3)
                void reward(story.id, "listen").catch(reportError);
            }}
          >
            {o}
          </Button>
        ))}
      </div>
      {choice !== null && (
        <div aria-live="polite" className="game-feedback">
          <p>
            {choice === answer
              ? "Đúng rồi!"
              : "Mình nghe lại và xem nghĩa nhé."}
          </p>
          <p lang="zh-CN">{target.hanzi}</p>
          <p className="pinyin">{target.pinyin}</p>
          <p>{target.vi}</p>
          {!completed ? (
            <Button
              variant="secondary"
              onClick={() => {
                setIndex((n) => n + 1);
                setChoice(null);
                setHeard(false);
              }}
            >
              Câu tiếp theo
            </Button>
          ) : (
            <>
              <p>
                {score}/3 câu đúng.{" "}
                {score === 3
                  ? "Cả ba câu đều đúng, em giỏi quá!"
                  : "Mỗi lần lắng nghe là một lần tiến bộ."}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setIndex(0);
                  setChoice(null);
                  setHeard(false);
                  setScore(0);
                }}
              >
                Nghe lại từ đầu
              </Button>
            </>
          )}
        </div>
      )}
    </>
  );
}
