import { useEffect, useState } from "react";
import { BookmarkPlus, Check, RotateCcw, Sparkles } from "lucide-react";
import { vocabulary, findStory, stories } from "@/content";
import { useLearning, useNow } from "@/lib/hooks";
import { reviewVocabulary, saveVocabulary } from "@/lib/db";
import { PageHeading, AudioButton, Badge, Empty } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { VocabularySheet } from "@/components/VocabularySheet";
import type { Vocabulary } from "@/content/schema";
import { reportError, useUI } from "@/lib/store";
import { Link, useSearchParams } from "react-router-dom";
import { scheduleReview } from "@/lib/learning";
import { searchText } from "@/lib/utils";
export default function Review() {
  const { cards } = useLearning();
  const now = useNow();
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [word, setWord] = useState<Vocabulary | null>(null);
  const [tab, setTab] = useState("due");
  const [params, setParams] = useSearchParams();
  const selectedStory = findStory(params.get("story") ?? undefined);
  const storyFilter = selectedStory?.id ?? "all";
  const [deckId, setDeckId] = useState(selectedStory?.id ?? stories[0].id);
  const [search, setSearch] = useState("");
  const filteredCards = cards.filter(
    (c) =>
      storyFilter === "all" ||
      selectedStory?.glossary.some((v) => v.id === c.id),
  );
  const due = cards
    .filter((c) => c.dueAt <= now && filteredCards.some((f) => f.id === c.id))
    .sort((a, b) => a.dueAt - b.dueAt);
  const current = due[0];
  const entry = vocabulary.find((v) => v.id === current?.id);
  useEffect(() => {
    setFlipped(false);
  }, [current?.id]);
  const deck = findStory(deckId) ?? stories[0];
  const missing = deck.glossary.filter(
    (v) => !cards.some((c) => c.id === v.id),
  );
  const saved = filteredCards.filter((c) => {
    const v = vocabulary.find((v) => v.id === c.id);
    return (
      v &&
      searchText(
        [v.hanzi, v.pinyin, v.meaning, findStory(v.storyId)?.titleVi].join(" "),
      ).includes(searchText(search))
    );
  });
  return (
    <>
      <PageHeading
        eyebrow="TỪNG CHÚT MỘT"
        title="Vườn từ vựng"
        description="Những từ em đã gặp, đang lớn lên cùng em."
        action={<Badge className="badge-sage">{cards.length} từ đã lưu</Badge>}
      />
      <div className="review-filters filters">
        <label className="field">
          Ôn theo truyện
          <select
            aria-label="Ôn theo truyện"
            value={storyFilter}
            disabled={busy}
            onChange={(e) => {
              setParams(
                e.target.value === "all" ? {} : { story: e.target.value },
              );
              if (e.target.value !== "all") setDeckId(e.target.value);
              setFlipped(false);
            }}
          >
            <option value="all">Tất cả truyện</option>
            {stories.map((s) => (
              <option value={s.id} key={s.id}>
                {s.titleVi}
              </option>
            ))}
          </select>
        </label>
        {tab === "saved" && (
          <label className="field">
            Tìm từ đã lưu
            <input
              aria-label="Tìm từ đã lưu"
              placeholder="Hanzi, Pinyin hoặc nghĩa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="tabs">
        <Button
          variant={tab === "due" ? "secondary" : "ghost"}
          onClick={() => setTab("due")}
        >
          Đến giờ ôn <span className="count-badge">{due.length}</span>
        </Button>
        <Button
          variant={tab === "saved" ? "secondary" : "ghost"}
          onClick={() => setTab("saved")}
        >
          Tất cả từ đã lưu
        </Button>
      </div>
      {tab === "due" && entry && current ? (
        <div className="review-workspace">
          <p className="muted review-counter">
            {reviewed ? `Đã ôn ${reviewed} từ trong lượt này · ` : ""}
            {due.length} từ đang chờ
          </p>
          <section className="flashcard">
            <div className="flashcard-top">
              <Badge>{findStory(entry.storyId)?.titleVi}</Badge>
              <AudioButton compact text={entry.hanzi} />
            </div>
            <button
              className="flashcard-face"
              onClick={() => setFlipped(!flipped)}
              aria-label={flipped ? "Ẩn nghĩa của từ" : "Lật thẻ xem nghĩa"}
              aria-expanded={flipped}
            >
              <span lang="zh-CN" className="flashcard-hanzi">
                {entry.hanzi}
              </span>
              <span className="pinyin">{entry.pinyin}</span>
              {flipped ? (
                <>
                  <span className="flashcard-meaning">{entry.meaning}</span>
                  <span className="flashcard-example" lang="zh-CN">
                    {entry.example}
                  </span>
                  <span className="pinyin">{entry.examplePinyin}</span>
                  <span className="muted">{entry.exampleVi}</span>
                </>
              ) : (
                <span className="flip-hint">
                  <RotateCcw size={16} />
                  Chạm để xem nghĩa
                </span>
              )}
            </button>
          </section>
          {flipped ? (
            <div className="rating-options">
              {(
                [
                  {
                    rating: "again",
                    label: "Quên",
                    className: "rating-again",
                  },
                  {
                    rating: "hard",
                    label: "Khó",
                    className: "rating-hard",
                  },
                  {
                    rating: "good",
                    label: "Nhớ",
                    className: "rating-good",
                  },
                  {
                    rating: "easy",
                    label: "Dễ",
                    className: "rating-easy",
                  },
                ] as const
              ).map((r) => (
                <button
                  disabled={busy}
                  key={r.rating}
                  className={`rating-button ${r.className}`}
                  onClick={() => {
                    setBusy(true);
                    void reviewVocabulary(current.id, r.rating)
                      .then((saved) => {
                        if (saved) {
                          setReviewed((n) => n + 1);
                          setFlipped(false);
                          useUI
                            .getState()
                            .notify("Đã lên lịch ôn tiếp · +5 XP");
                        }
                      })
                      .catch(reportError)
                      .finally(() => setBusy(false));
                  }}
                >
                  <strong>{r.label}</strong>
                  <span>
                    {scheduleReview(current, r.rating, now).interval < 1
                      ? "10 phút"
                      : `${scheduleReview(current, r.rating, now).interval} ngày`}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Button className="flip-button" onClick={() => setFlipped(true)}>
              Xem nghĩa
            </Button>
          )}
          <p className="content-note">
            Chọn đúng cảm nhận của em. Không có câu trả lời “xấu”.
          </p>
        </div>
      ) : tab === "due" ? (
        <Empty
          icon={<Sparkles size={38} />}
          title={
            reviewed ? "Em đã chăm vườn từ hôm nay!" : "Một khoảng nghỉ dễ chịu"
          }
        >
          <p>
            {cards.length
              ? "Chưa có từ đến giờ ôn. Em có thể đọc tiếp một câu chuyện."
              : "Chạm vào từ trong truyện để lưu, hoặc thêm bộ từ nhỏ bên dưới."}
          </p>
          <Button asChild>
            <Link to="/stories">Đọc một câu chuyện</Link>
          </Button>
        </Empty>
      ) : (
        <div className="saved-grid">
          {saved.map((c) => {
            const v = vocabulary.find((v) => v.id === c.id);
            return v ? (
              <button
                className="card saved-word"
                key={c.id}
                onClick={() => setWord(v)}
              >
                <strong lang="zh-CN">{v.hanzi}</strong>
                <span className="pinyin">{v.pinyin}</span>
                <span>{v.meaning}</span>
                <small className="muted">
                  {findStory(v.storyId)?.titleVi} ·{" "}
                  {c.dueAt <= now
                    ? "Đến giờ ôn"
                    : `Ôn tiếp ${new Date(c.dueAt).toLocaleDateString("vi-VN")}`}
                </small>
              </button>
            ) : null;
          })}
          {!saved.length && (
            <Empty
              title={
                filteredCards.length
                  ? "Chưa tìm thấy từ"
                  : "Chưa có từ đã lưu trong bộ này"
              }
            >
              Em có thể đổi bộ lọc hoặc thêm từ từ truyện bên dưới.
            </Empty>
          )}
        </div>
      )}
      <section className="card starter-deck">
        <div>
          <h2>Một bộ từ để bắt đầu</h2>
          <p className="muted">
            Chọn một truyện, thêm {deck.glossary.length} từ có Pinyin và ví dụ.
            Không thêm lại những từ đã lưu.
          </p>
          <select
            aria-label="Chọn bộ từ để thêm"
            value={deckId}
            disabled={busy}
            onChange={(e) => setDeckId(e.target.value)}
          >
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titleVi}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          disabled={busy || !missing.length}
          onClick={() => {
            setBusy(true);
            void Promise.all(missing.map((v) => saveVocabulary(v.id)))
              .then(() =>
                useUI
                  .getState()
                  .notify(
                    `Đã thêm ${missing.length} từ từ “${deck.titleVi}”. Mình ôn ít thôi cũng được.`,
                  ),
              )
              .catch(reportError)
              .finally(() => setBusy(false));
          }}
        >
          {!missing.length ? <Check size={17} /> : <BookmarkPlus size={17} />}{" "}
          {!missing.length
            ? "Đã thêm bộ từ"
            : `Thêm ${missing.length} từ còn thiếu`}
        </Button>
      </section>
      <VocabularySheet word={word} onClose={() => setWord(null)} />
    </>
  );
}
