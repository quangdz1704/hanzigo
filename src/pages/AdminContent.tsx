import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Copy, Download, Eye, Save, Upload } from "lucide-react";
import { content, stories } from "@/content";
import { storySchema, type Story, type Vocabulary } from "@/content/schema";
import {
  copyStory,
  downloadJSON,
  MAX_STORY_BYTES,
  mergeStory,
  readStoryJSON,
} from "@/lib/content-editor";
import { db } from "@/lib/db";
import { stopAudio } from "@/lib/audio";
import { reportError, useUI } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge, PageHeading } from "@/components/Common";
import { StoryText } from "@/components/StoryText";
import { StoryForm } from "@/components/StoryForm";
import { VocabularySheet } from "@/components/VocabularySheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminContent() {
  const drafts = useLiveQuery(
    () => db.contentDrafts.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );
  const [key, setKey] = useState(stories[0].id);
  const [raw, setRaw] = useState(JSON.stringify(stories[0], null, 2));
  const [form, setForm] = useState<Story | null>(stories[0]);
  const [mode, setMode] = useState("form");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [word, setWord] = useState<Vocabulary | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => {
    try {
      const story = readStoryJSON(raw);
      const library = mergeStory(content, story);
      return { story, library, error: "" };
    } catch (e) {
      return {
        story: null,
        library: null,
        error: e instanceof Error ? e.message : "Không thể kiểm tra nội dung.",
      };
    }
  }, [raw]);
  const save = async () => {
    if (new TextEncoder().encode(raw).length > MAX_STORY_BYTES)
      throw new Error("Truyện quá lớn: tối đa 500 KB.");
    await db.contentDrafts.put({ id: key, raw, updatedAt: Date.now() });
    setDirty(false);
  };
  const updateRaw = (text: string) => {
    setRaw(text);
    try {
      const result = storySchema.safeParse(JSON.parse(text));
      setForm(result.success ? result.data : null);
    } catch {
      setForm(null);
    }
  };
  // Preserve unfinished work before switching, including JSON that is still incomplete.
  const open = (nextKey: string, text: string) => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      if (dirty) await save();
      setKey(nextKey);
      updateRaw(text);
      setMode("form");
      setDirty(false);
    })()
      .catch(reportError)
      .finally(() => setBusy(false));
  };
  const saveClick = () => {
    setBusy(true);
    void save()
      .then(() =>
        useUI
          .getState()
          .notify("Đã lưu nháp trên thiết bị. Thư viện của em chưa thay đổi."),
      )
      .catch(reportError)
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeading
        eyebrow="CHĂM NHỮNG TRANG SÁCH"
        title="Bàn biên tập"
        description="Chỉnh từng câu, kiểm tra dữ liệu và xem trước trước khi đưa vào thư viện."
      />
      <div className="editor-notice">
        <BookOpen size={20} />
        <p>
          Nháp lưu riêng trên trình duyệt này. Để cập nhật app, xuất thư viện,
          chạy lệnh nhập nội dung trong README rồi build lại. Nội dung ngôn ngữ
          vẫn cần người đọc tiếng Trung kiểm tra.
        </p>
      </div>
      <div className="content-workbench">
        <aside className="card editor-library">
          <h2>Thư viện · {stories.length} truyện</h2>
          <select
            disabled={busy}
            aria-label="Chọn truyện để biên tập"
            value={stories.some((s) => s.id === key) ? key : ""}
            onChange={(e) => {
              const s = stories.find((s) => s.id === e.target.value);
              if (s)
                open(
                  s.id,
                  drafts.find((d) => d.id === s.id)?.raw ??
                    JSON.stringify(s, null, 2),
                );
            }}
          >
            <option value="" disabled>
              Chọn truyện
            </option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titleVi}
              </option>
            ))}
          </select>
          <p className="muted">
            Tạo bản sao để viết truyện mới. Giữ ID cũ khi chỉ sửa nội dung để
            bảo toàn tiến độ học.
          </p>
          <Button
            variant="secondary"
            disabled={!parsed.story || busy}
            onClick={() => {
              if (!parsed.story) return;
              const id = `story-${crypto.randomUUID().slice(0, 8)}`;
              open(id, JSON.stringify(copyStory(parsed.story, id), null, 2));
            }}
          >
            <Copy size={16} />
            Tạo bản sao
          </Button>
          <h3>Nháp đã lưu · {drafts.length}</h3>
          <div className="editor-drafts">
            {drafts.map((d) => (
              <button
                disabled={busy}
                key={d.id}
                className={key === d.id ? "active" : ""}
                onClick={() => open(d.id, d.raw)}
              >
                <strong>{draftTitle(d.raw, d.id)}</strong>
                <small>{new Date(d.updatedAt).toLocaleString("vi-VN")}</small>
              </button>
            ))}
          </div>
          {!drafts.length && (
            <p className="muted">Nháp đầu tiên sẽ xuất hiện ở đây.</p>
          )}
        </aside>
        <section className="card editor-document">
          <div className="section-heading">
            <h2>Bản đang biên tập</h2>
            <Badge className={parsed.story ? "badge-sage" : ""}>
              {dirty ? "Chưa lưu" : "Đã mở"}
            </Badge>
          </div>
          <div className="button-row">
            <Button disabled={busy} onClick={saveClick}>
              <Save size={16} />
              Lưu nháp
            </Button>
            <Button
              disabled={!parsed.story}
              variant="secondary"
              onClick={() => setPreview(true)}
            >
              <Eye size={16} />
              Xem trước
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              <Upload size={16} />
              Nhập truyện JSON
            </Button>
          </div>
          <input
            ref={file}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            aria-label="Nhập truyện JSON"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > MAX_STORY_BYTES) {
                reportError(new Error("Truyện quá lớn: tối đa 500 KB."));
                return;
              }
              setBusy(true);
              void (async () => {
                const text = await f.text();
                const story = readStoryJSON(text);
                mergeStory(content, story);
                if (dirty) await save();
                setKey(story.id);
                updateRaw(JSON.stringify(story, null, 2));
                setDirty(true);
              })()
                .catch(reportError)
                .finally(() => setBusy(false));
            }}
          />
          <div className="tabs editor-mode">
            <Button
              size="sm"
              variant={mode === "form" ? "secondary" : "ghost"}
              onClick={() => setMode("form")}
            >
              Sửa từng phần
            </Button>
            <Button
              size="sm"
              variant={mode === "json" ? "secondary" : "ghost"}
              onClick={() => setMode("json")}
            >
              JSON
            </Button>
          </div>
          {mode === "form" && form ? (
            <StoryForm
              story={form}
              disabled={busy}
              onChange={(story) => {
                setForm(story);
                setRaw(JSON.stringify(story, null, 2));
                setDirty(true);
              }}
            />
          ) : (
            <label className="field editor-json">
              Nội dung truyện JSON
              <textarea
                disabled={busy}
                spellCheck={false}
                value={raw}
                onChange={(e) => {
                  updateRaw(e.target.value);
                  setDirty(true);
                }}
                aria-describedby="editor-validation"
              />
            </label>
          )}
          <div id="editor-validation" aria-live="polite">
            {parsed.error ? (
              <>
                <p className="form-error">
                  Chưa thể xuất hoặc xem trước. Có thể lưu nháp để sửa tiếp.
                </p>
                <pre className="editor-errors">{parsed.error}</pre>
              </>
            ) : (
              <p className="editor-valid">
                ✓ {parsed.story!.paragraphs.flat().length} câu ·{" "}
                {parsed.story!.glossary.length} từ ·{" "}
                {parsed.story!.comprehensionQuestions.length} câu hỏi · IDs và
                mapping hợp lệ
              </p>
            )}
          </div>
          <div className="button-row">
            <Button
              variant="outline"
              disabled={!parsed.story}
              onClick={() =>
                downloadJSON(parsed.story, `${parsed.story!.id}.json`)
              }
            >
              <Download size={16} />
              Xuất truyện
            </Button>
            <Button
              variant="secondary"
              disabled={!parsed.library}
              onClick={() =>
                downloadJSON(parsed.library, "hanzigo-content.json")
              }
            >
              <Download size={16} />
              Xuất thư viện + bản đang xem
            </Button>
          </div>
          <p className="content-note">
            Xuất thư viện thay truyện cùng ID hoặc thêm ID mới. Chỉ bản đang xem
            được ghép vào thư viện gốc; các nháp khác cần nhập riêng. Lưu nháp
            không phát hành lên Firebase.
          </p>
        </section>
      </div>
      <Dialog
        open={preview}
        onOpenChange={(value) => {
          setPreview(value);
          if (!value) {
            setWord(null);
            stopAudio();
          }
        }}
      >
        <DialogContent className="story-preview-dialog">
          <DialogTitle>
            {parsed.story?.titleVi ?? "Xem trước truyện"}
          </DialogTitle>
          <DialogDescription>
            Bản nháp · Preview không ghi tiến độ hay XP.
          </DialogDescription>
          {parsed.story && (
            <div className="reader">
              <p lang="zh-CN" className="reader-title-zh">
                {parsed.story.titleZh}
              </p>
              <article
                className="reader-paper"
                style={{ "--reader-font": "26px" } as React.CSSProperties}
              >
                <StoryText
                  story={parsed.story}
                  pinyin
                  translation
                  onWord={setWord}
                />
              </article>
              <h3>Câu hỏi & đáp án</h3>
              {parsed.story.comprehensionQuestions.map((q) => (
                <p key={q.id}>
                  {q.prompt}
                  <br />
                  <strong>{q.options[q.answer]}</strong> · {q.explanation}
                </p>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <VocabularySheet preview word={word} onClose={() => setWord(null)} />
    </>
  );
}
function draftTitle(raw: string, fallback: string) {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "titleVi" in value &&
      typeof value.titleVi === "string"
    )
      return value.titleVi || fallback;
  } catch {
    /* Incomplete drafts are intentionally kept. */
  }
  return fallback;
}
