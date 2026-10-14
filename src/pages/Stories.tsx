import { useLibraryRevision } from "@/content";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  Clock3,
  Search,
  BookOpen,
  Check,
} from "lucide-react";
import { stories } from "@/content";
import { PageHeading, Badge, Empty } from "@/components/Common";
import { StoryArt } from "@/components/Art";
import { Button } from "@/components/ui/button";
import { useLearning } from "@/lib/hooks";
import { toggleFavorite } from "@/lib/db";
import { run } from "@/lib/store";
import { searchText } from "@/lib/utils";
export default function Stories() {
  useLibraryRevision();
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const { progress, favorites } = useLearning();
  const filtered = stories.filter(
    (s) =>
      searchText(
        [s.titleVi, s.titleZh, s.subtitle, ...s.tags].join(" "),
      ).includes(searchText(search)) &&
      (topic === "all" || topic === s.topic) &&
      (difficulty === "all" || difficulty === s.difficulty) &&
      (status === "all" ||
        (status === "read" &&
          progress.some((p) => p.id === s.id && p.completed)) ||
        (status === "unread" &&
          !progress.some((p) => p.id === s.id && p.completed)) ||
        (status === "favorite" &&
          favorites.some((f) => f.id === `story:${s.id}` && f.active))),
  );
  return (
    <>
      <PageHeading
        eyebrow="MỞ MỘT TRANG SÁCH"
        title="Thư viện truyện"
        description="Một câu chuyện nhỏ, một thế giới mới. Em muốn đi đâu hôm nay?"
      />
      <div className="filters">
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="Tìm truyện"
            placeholder="Tìm một câu chuyện…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Chủ đề"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="all">Mọi chủ đề</option>
          {[...new Set(stories.map((s) => s.topic))].map((topic) => (
            <option key={topic}>{topic}</option>
          ))}
        </select>
        <select
          aria-label="Độ khó"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="all">Mọi trình độ</option>
          {["HSK 3", "HSK 4", "HSK 5"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Trạng thái đọc"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Tất cả truyện</option>
          <option value="read">Đã đọc</option>
          <option value="unread">Chưa đọc</option>
          <option value="favorite">Yêu thích</option>
        </select>
      </div>
      <p className="muted result-count">
        {filtered.length} câu chuyện đang chờ em
      </p>
      <div className="story-grid">
        {filtered.map((s) => {
          const done = progress.some((p) => p.id === s.id && p.completed);
          const favorite = favorites.some(
            (f) => f.id === `story:${s.id}` && f.active,
          );
          return (
            <article key={s.id} className={`story-card art-${s.art}`}>
              <Link
                to={`/stories/${s.id}`}
                className="story-art-link"
                tabIndex={-1}
                aria-hidden="true"
              >
                <StoryArt kind={s.art} />
              </Link>
              <div className="story-card-body">
                <div className="story-meta">
                  <Badge>{s.difficulty}</Badge>
                  <span>{s.topic}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${favorite ? "Bỏ yêu thích" : "Yêu thích"} ${s.titleVi}`}
                    aria-pressed={favorite}
                    onClick={() => run(() => toggleFavorite("story", s.id))}
                  >
                    <Bookmark
                      size={18}
                      fill={favorite ? "currentColor" : "none"}
                    />
                  </Button>
                </div>
                <h2>
                  <Link to={`/stories/${s.id}`}>
                    {s.titleVi}
                    <ArrowUpRight size={20} />
                  </Link>
                </h2>
                <p lang="zh-CN" className="story-chinese">
                  {s.titleZh}
                </p>
                <p className="muted">{s.subtitle}</p>
                <div className="story-card-footer">
                  <span>
                    <Clock3 size={15} />
                    {s.estimatedMinutes} phút · {s.glossary.length} từ
                  </span>
                  {done ? (
                    <span className="read-label">
                      <Check size={15} />
                      Đã đọc
                    </span>
                  ) : (
                    <span>
                      <BookOpen size={15} />
                      Đọc nhẹ nhàng
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty icon={<Search size={32} />} title="Chưa tìm thấy câu chuyện">
          Thử một từ khóa khác hoặc đổi bộ lọc nhé.
          <p>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setTopic("all");
                setDifficulty("all");
                setStatus("all");
              }}
            >
              Xóa bộ lọc
            </Button>
          </p>
        </Empty>
      )}
      <p className="content-note">
        Nội dung tự biên soạn · Mức HSK tham khảo · Bản nháp đang chờ người đọc
        tiếng Trung kiểm tra.
      </p>
    </>
  );
}
