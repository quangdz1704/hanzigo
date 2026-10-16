import { useLibraryRevision } from "@/content";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Clock3,
  Copy,
  Flower2,
  Heart,
  Mail,
  Headphones,
  Sparkles,
} from "lucide-react";
import { stories, quotes } from "@/content";
import { dailyIndex } from "@/lib/learning";
import { useLearning, useNow } from "@/lib/hooks";
import { usePreferences, useUI, run } from "@/lib/store";
import { toggleFavorite } from "@/lib/db";
import { useLetters } from "@/components/Letters";
import { AudioButton, Badge, SectionHeading } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { DailyStudy } from "@/components/DailyStudy";
import { GardenArt, StoryArt, EnvelopeArt } from "@/components/Art";
export default function Home() {
  useLibraryRevision();
  const { progress, activities, cards, favorites, xp, streak, storiesRead } =
    useLearning();
  const name = usePreferences((s) => s.name || "em");
  const now = useNow();
  const { unread } = useLetters();
  const quote = quotes[dailyIndex(quotes.length, now)];
  const last = [...progress]
    .filter((p) => !p.completed)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const story =
    stories.find((s) => s.id === last?.id) ??
    stories.find((s) => !progress.some((p) => p.id === s.id && p.completed)) ??
    stories[0];
  const favorite = favorites.some(
    (f) => f.id === `quote:${quote.id}` && f.active,
  );
  const hour = new Date(now).getHours();
  const greeting =
    hour < 11
      ? "Chào buổi sáng"
      : hour < 18
        ? "Chào buổi chiều"
        : "Buổi tối dịu dàng";
  const day = new Date(now).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <>
      <div className="home-heading">
        <div>
          <p className="eyebrow">MỘT CHÚT TIẾNG TRUNG, MỘT CHÚT NIỀM VUI</p>
          <h1>
            {greeting}, {name} <span className="greeting-flower">✿</span>
          </h1>
          <p className="muted">Hôm nay mình đọc một câu chuyện nhỏ nhé?</p>
        </div>
        <span className="date-chip">
          <Flower2 size={17} />
          {day}
        </span>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <DailyStudy />
          <section className="daily-quote card">
            <div className="quote-top">
              <span className="eyebrow">
                <span className="tiny-flower">✿</span>MỘT CÂU DÀNH CHO EM
              </span>
              <div className="button-row">
                <AudioButton
                  compact
                  text={quote.hanzi}
                  label="Nghe câu hôm nay"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={
                    favorite
                      ? "Bỏ yêu thích câu hôm nay"
                      : "Yêu thích câu hôm nay"
                  }
                  aria-pressed={favorite}
                  onClick={() => run(() => toggleFavorite("quote", quote.id))}
                >
                  <Heart size={17} fill={favorite ? "currentColor" : "none"} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sao chép câu hôm nay"
                  onClick={() =>
                    run(async () => {
                      await navigator.clipboard.writeText(
                        `${quote.hanzi}\n${quote.pinyin}\n${quote.vi}`,
                      );
                      useUI.getState().notify("Đã sao chép câu dành cho em.");
                    })
                  }
                >
                  <Copy size={17} />
                </Button>
              </div>
            </div>
            <p className="quote-hanzi" lang="zh-CN">
              {quote.hanzi}
            </p>
            <p className="pinyin">{quote.pinyin}</p>
            <p className="quote-translation">{quote.vi}</p>
            <span className="quote-corner" aria-hidden="true">
              ❀
            </span>
          </section>
          <section>
            <SectionHeading
              title={
                last ? "Câu chuyện đang đọc" : "Một câu chuyện cho hôm nay"
              }
              to="/stories"
              label="Ghé thư viện"
            />
            <article className={`featured-story art-${story.art}`}>
              <div className="featured-story-copy">
                <div className="button-row">
                  <Badge className="badge-sage">{story.difficulty}</Badge>
                  <span className="muted">{story.topic}</span>
                </div>
                <h2>{story.titleVi}</h2>
                <p className="featured-zh" lang="zh-CN">
                  {story.titleZh}
                </p>
                <p className="muted">{story.subtitle}</p>
                <p className="featured-meta">
                  <Clock3 size={15} />
                  {story.estimatedMinutes} phút<span>·</span>
                  {story.glossary.length} từ mới
                </p>
                <Button asChild>
                  <Link to={`/stories/${story.id}`}>
                    {last ? "Đọc tiếp cùng em" : "Mở câu chuyện"}
                    <ArrowRight size={17} />
                  </Link>
                </Button>
              </div>
              <div className="featured-art">
                <StoryArt kind={story.art} />
                <span className="art-caption">
                  a little story, a little joy
                </span>
              </div>
            </article>
          </section>
        </div>
        <aside className="dashboard-aside">
          <Link to="/music" className="card music-home-link">
            <Headphones size={23} />
            <div>
              <h2>Góc nghe nhạc</h2>
              <p className="muted">Một bài tiếng Trung, một chút thảnh thơi.</p>
              <span className="text-link">Ghé nghe một bài →</span>
            </div>
          </Link>
          <section className="card mini-garden">
            <div className="section-heading">
              <h2>Vườn nhỏ của em</h2>
              <Flower2 size={18} />
            </div>
            <GardenArt growth={activities.length} />
            <div className="mini-garden-copy">
              <strong>
                {activities.length < 3
                  ? "Mỗi ngày, một chút xanh."
                  : "Vườn đang nở hoa cùng em."}
              </strong>
              <p className="muted">
                {activities.length} hoạt động được gieo · cấp{" "}
                {Math.floor(xp / 100) + 1}
              </p>
            </div>
            <div className="mini-growth">
              <span style={{ width: `${xp % 100}%` }} />
            </div>
            <Link to="/garden" className="text-link">
              Dạo một vòng trong vườn
              <ArrowRight size={16} />
            </Link>
          </section>
          <section className="card progress-card">
            <h2>Từng chút em đã đi</h2>
            <div>
              <span className="progress-icon theme-sage">
                <BookOpen size={18} />
              </span>
              <strong>{storiesRead}</strong>
              <span>truyện đã đọc</span>
            </div>
            <div>
              <span className="progress-icon theme-lavender">
                <Bookmark size={18} />
              </span>
              <strong>{cards.length}</strong>
              <span>từ đã lưu</span>
            </div>
            <div>
              <span className="progress-icon theme-peach">
                <Sparkles size={18} />
              </span>
              <strong>{streak}</strong>
              <span>ngày liên tiếp</span>
            </div>
            <p className="muted">Nghỉ một hôm cũng không sao ♡</p>
          </section>
          <Link to="/letters" className="mail-teaser">
            <div>
              <span className="eyebrow">HỘP THƯ YÊU THƯƠNG</span>
              <h3>
                {unread ? "Có lời nhắn chờ em" : "Một nơi cho lời dịu dàng"}
              </h3>
              <p>
                {unread
                  ? `${unread} thư chưa đọc`
                  : "Khi anh có điều muốn nói…"}
              </p>
              <span className="text-link">
                Mở hộp thư
                <ArrowRight size={15} />
              </span>
            </div>
            <div className="teaser-envelope">
              <EnvelopeArt />
            </div>
          </Link>
        </aside>
      </div>
      <footer className="home-footer">
        <span>✿</span>Em không cần học thật nhiều. Chỉ cần còn thấy vui.
      </footer>
    </>
  );
}
