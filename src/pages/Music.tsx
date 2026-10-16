import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Headphones,
  ListMusic,
  Play,
  Plus,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { content, bundledContent, useLibraryRevision } from "@/content";
import { musicCatalogSchema, type MusicTrack } from "@/content/music-schema";
import { getLearningDatabase } from "@/lib/db";
import { useAuth } from "@/lib/Auth";
import { useOnline } from "@/lib/hooks";
import { backend } from "@/lib/firebase";
import { publishMusicCatalog } from "@/lib/cloud-content";
import { addPlaylistTrack, deleteMusicPlaylist } from "@/lib/music-db";
import { mixTracks, unpackTracks } from "@/lib/music";
import { reportError, run, useUI } from "@/lib/store";
import { searchText } from "@/lib/utils";
import { PageHeading, Badge } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import {
  MusicPlaylistEditor,
  type PlaylistEdit,
} from "@/components/MusicPlaylistEditor";

const paceLabels = {
  easy: "Dễ theo",
  medium: "Vừa sức",
  challenge: "Thử thách",
  unknown: "Chưa phân loại",
};
const moodLabels = {
  calm: "Êm dịu",
  bright: "Tươi sáng",
  nostalgic: "Hoài niệm",
  personal: "Em chọn",
};
export default function Music() {
  useLibraryRevision();
  const auth = useAuth(),
    online = useOnline();
  const database = getLearningDatabase();
  const saved = useLiveQuery(
    () => database.musicPlaylists.toArray(),
    [auth.learningScope],
    [],
  );
  const personal = saved
    .filter((p) => !p.deleted)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const catalog =
    content.music ?? musicCatalogSchema.parse(bundledContent.music);
  const lists = [
    ...catalog.playlists.map((p) => ({
      ...p,
      id: `suggested:${p.id}`,
      tracks: p.videoIds.map((id) =>
        catalog.tracks.find((t) => t.videoId === id)!,
      ),
      personalId: undefined as string | undefined,
    })),
    ...personal.map((p) => ({
      id: `personal:${p.id}`,
      name: p.name,
      description: "Playlist của em",
      tracks: unpackTracks(p.raw),
      personalId: p.id,
    })),
  ];
  const [selected, setSelected] = useState<string[]>([]);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [request, setRequest] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [editor, setEditor] = useState<PlaylistEdit | null>(null);
  const [target, setTarget] = useState("");
  const [search, setSearch] = useState("");
  const [pace, setPace] = useState("all");
  const [mood, setMood] = useState("all");
  const [publishing, setPublishing] = useState(false);
  const selectedLists = lists.filter((p) => selected.includes(p.id));
  const current = queue[index];
  useEffect(() => {
    if (request > 0)
      document
        .getElementById("music-player")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [request]);
  const visible = catalog.tracks.filter(
    (t) =>
      (pace === "all" || t.pace === pace) &&
      (mood === "all" || t.mood === mood) &&
      searchText([t.title, t.titleVi, t.pinyin, t.artist].join(" ")).includes(
        searchText(search),
      ),
  );
  const start = (tracks: MusicTrack[], at = 0) => {
    if (!tracks.length) {
      useUI
        .getState()
        .notify("Playlist này còn trống. Em thêm vài bài trước nhé.");
      return;
    }
    setQueue(tracks);
    setIndex(at);
    setRequest((n) => n + 1);
  };
  const mix = (shuffle: boolean) => {
    try {
      start(
        mixTracks(
          selectedLists.map((p) => p.tracks),
          shuffle,
        ),
      );
    } catch (e) {
      reportError(e);
    }
  };
  const advance = () => {
    if (index + 1 < queue.length) setIndex(index + 1);
    else if (repeat) {
      setIndex(0);
      setRequest((n) => n + 1);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="NGHE MỘT BÀI, THƯƠNG THÊM MỘT CHÚT"
        title="Góc nghe nhạc"
        description="Một chút tiếng Trung để học, một chút giai điệu để thảnh thơi."
        action={
          <Badge className="badge-sage">
            <Headphones size={15} /> {catalog.tracks.length} bài gợi ý
          </Badge>
        }
      />
      <section className="music-hero card">
        <div>
          <p className="eyebrow">HÔM NAY EM MUỐN NGHE GÌ?</p>
          <h2>Để tiếng Trung đi cùng một giai điệu.</h2>
          <p className="muted">
            Chọn một playlist, hoặc pha vài playlist thành buổi nghe của riêng
            em.
          </p>
          <div className="button-row">
            <Button
              disabled={!online || !catalog.tracks.length}
              onClick={() => start(mixTracks([catalog.tracks], true))}
            >
              <Shuffle size={17} /> Trộn bộ gợi ý
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setEditor({ name: "Những bài em thích", tracks: [] })
              }
            >
              <Plus size={17} /> Tạo playlist
            </Button>
          </div>
        </div>
        <div className="music-vinyl" aria-hidden="true">
          <span>花</span>
        </div>
      </section>
      {!online && (
        <p className="music-notice" role="status">
          Playlist vẫn được lưu khi offline. Video YouTube cần kết nối mạng để
          phát.
        </p>
      )}
      <div className="music-workspace">
        <section
          id="music-player"
          className="card music-player"
          aria-label="Trình phát nhạc"
        >
          {current ? (
            <>
              <div className="study-card-heading">
                <div>
                  <p className="eyebrow">
                    ĐANG CHỌN · {index + 1}/{queue.length}
                  </p>
                  <h2 lang="zh-CN">{current.title}</h2>
                  <p className="muted">{current.artist}</p>
                </div>
                <Badge>{paceLabels[current.pace]}</Badge>
              </div>
              <YouTubePlayer
                track={current}
                request={request}
                onEnded={advance}
              />
              <p className="music-listening-tip">
                <Headphones size={17} />
                <span>{current.tip}</span>
              </p>
            </>
          ) : (
            <div className="music-player-empty">
              <Headphones size={38} />
              <h2>Một bài nhạc đang chờ em</h2>
              <p className="muted">
                Bấm Nghe ở một bài, hoặc chọn playlist bên dưới để bắt đầu.
              </p>
              <p className="content-note">
                Trình phát chỉ được tải khi em chọn nghe. Nhạc dừng khi em rời
                trang này.
              </p>
            </div>
          )}
          <div className="music-controls">
            <div className="button-row">
              <Button
                size="icon"
                variant="outline"
                aria-label="Bài trước"
                disabled={!current || index === 0 || !online}
                onClick={() => setIndex(index - 1)}
              >
                <SkipBack size={19} />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Bài tiếp"
                disabled={
                  !current || (!repeat && index === queue.length - 1) || !online
                }
                onClick={advance}
              >
                <SkipForward size={19} />
              </Button>
              <Button
                size="icon"
                variant={repeat ? "secondary" : "ghost"}
                aria-label="Lặp danh sách phát"
                aria-pressed={repeat}
                onClick={() => setRepeat((v) => !v)}
              >
                <Repeat2 size={19} />
              </Button>
            </div>
            <Button
              variant="ghost"
              disabled={!queue.length}
              onClick={() =>
                setEditor({ name: "Buổi nghe của em", tracks: queue })
              }
            >
              <Plus size={16} /> Lưu lượt nghe
            </Button>
          </div>
        </section>
        <aside className="card music-queue" aria-label="Danh sách đang nghe">
          <div className="study-card-heading">
            <h2>
              <ListMusic size={19} /> Tiếp theo
            </h2>
            <span className="muted">{queue.length} bài</span>
          </div>
          {queue.length ? (
            <ol>
              {queue.map((t, i) => (
                <li key={t.videoId}>
                  <button
                    className={i === index ? "active" : ""}
                    aria-current={i === index ? "true" : undefined}
                    disabled={!online}
                    onClick={() => {
                      setIndex(i);
                      setRequest((n) => n + 1);
                    }}
                  >
                    <span className="music-track-number">
                      {i === index ? <Headphones size={16} /> : i + 1}
                    </span>
                    <span>
                      <strong>{t.title}</strong>
                      <small>{t.artist}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">
              Danh sách sẽ xuất hiện ở đây khi em bắt đầu nghe.
            </p>
          )}
        </aside>
      </div>
      <section className="music-mix-section">
        <div className="section-heading">
          <div>
            <h2>Pha một danh sách phát</h2>
            <p className="muted">
              Chọn một hoặc nhiều playlist. Các bài trùng nhau chỉ xuất hiện một
              lần.
            </p>
          </div>
        </div>
        <div className="music-playlists">
          {lists.map((p) => (
            <article className="card music-playlist-card" key={p.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={`Chọn playlist ${p.name}`}
                  checked={selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, p.id]
                        : old.filter((id) => id !== p.id),
                    )
                  }
                />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </span>
              </label>
              <div className="study-card-heading">
                <span className="muted">{p.tracks.length} bài</span>
                <div className="button-row">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!online || !p.tracks.length}
                    onClick={() => start(p.tracks)}
                  >
                    <Play size={15} /> Nghe
                  </Button>
                  {p.personalId && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditor({
                            id: p.personalId,
                            name: p.name,
                            tracks: p.tracks,
                          })
                        }
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Ẩn playlist ${p.name}`}
                        onClick={() =>
                          run(() => deleteMusicPlaylist(p.personalId!))
                        }
                      >
                        Ẩn
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="button-row music-mix-actions">
          <Button
            disabled={!selectedLists.length || !online}
            onClick={() => mix(true)}
          >
            <Shuffle size={17} /> Trộn và nghe
          </Button>
          <Button
            variant="outline"
            disabled={!selectedLists.length || !online}
            onClick={() => mix(false)}
          >
            Nghe theo thứ tự
          </Button>
          <span className="muted">Đã chọn {selectedLists.length} playlist</span>
        </div>
        {!!saved.filter((p) => p.deleted).length && (
          <details className="music-archived">
            <summary>Playlist đã ẩn</summary>
            {saved
              .filter((p) => p.deleted)
              .map((p) => (
                <div className="study-card-heading" key={p.id}>
                  <span>{p.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(() => deleteMusicPlaylist(p.id, false))}
                  >
                    Khôi phục
                  </Button>
                </div>
              ))}
          </details>
        )}
      </section>
      <section className="music-discover">
        <div className="section-heading">
          <h2>Khám phá từng giai điệu</h2>
        </div>
        <div className="filters music-filters">
          <label className="field">
            Tìm bài hát
            <input
              placeholder="Tên bài, ca sĩ, Pinyin…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="field">
            Độ dễ theo
            <select value={pace} onChange={(e) => setPace(e.target.value)}>
              <option value="all">Tất cả</option>
              {Object.entries(paceLabels)
                .filter(([key]) => key !== "unknown")
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Tâm trạng
            <select value={mood} onChange={(e) => setMood(e.target.value)}>
              <option value="all">Tất cả</option>
              {Object.entries(moodLabels)
                .filter(([key]) => key !== "personal")
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Thêm bài vào
            <select
              value={personal.some((p) => p.id === target) ? target : ""}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Playlist mới</option>
              {personal.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="music-song-grid">
          {visible.map((t) => (
            <article className="card music-song" key={t.videoId}>
              <img
                src={`https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg`}
                alt=""
                loading="lazy"
                width={320}
                height={180}
              />
              <div className="music-song-copy">
                <div className="button-row">
                  <Badge>{paceLabels[t.pace]}</Badge>
                  <span className="muted">{moodLabels[t.mood]}</span>
                </div>
                <h3 lang="zh-CN">{t.title}</h3>
                <p className="pinyin">{t.pinyin}</p>
                <p>{t.titleVi}</p>
                <p className="muted">{t.artist}</p>
                <div className="button-row">
                  <Button
                    variant="secondary"
                    disabled={!online}
                    onClick={() =>
                      start(
                        visible,
                        visible.findIndex((x) => x.videoId === t.videoId),
                      )
                    }
                  >
                    <Play size={16} /> Nghe
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Thêm ${t.title} vào playlist`}
                    onClick={() => {
                      if (personal.some((p) => p.id === target))
                        run(async () => {
                          await addPlaylistTrack(target, t);
                          useUI.getState().notify("Đã thêm bài vào playlist.");
                        });
                      else
                        setEditor({ name: "Những bài em thích", tracks: [t] });
                    }}
                  >
                    <Plus size={16} /> Lưu bài
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!visible.length && (
          <p className="empty-state">
            Chưa có bài phù hợp. Em thử đổi bộ lọc nhé.
          </p>
        )}
      </section>
      <p className="content-note">
        Độ dễ theo là gợi ý biên tập. Phụ đề, tốc độ và khả năng phát nhúng tùy
        từng video; có thể mở trực tiếp trên YouTube.
      </p>
      {!content.music && (
        <p className="content-note">Đang dùng bộ nhạc gợi ý đi kèm app.</p>
      )}
      {auth.isAdmin && backend && auth.adminUser && (
        <Button
          variant="outline"
          disabled={publishing}
          onClick={() => {
            setPublishing(true);
            void publishMusicCatalog(
              backend!.adminStore,
              auth.adminUser!.uid,
              catalog,
            )
              .then(() =>
                useUI.getState().notify("Đã lưu bộ nhạc gợi ý lên Firebase."),
              )
              .catch(reportError)
              .finally(() => setPublishing(false));
          }}
        >
          Lưu bộ nhạc gợi ý lên Firebase
        </Button>
      )}
      {editor && (
        <MusicPlaylistEditor initial={editor} onClose={() => setEditor(null)} />
      )}
    </>
  );
}
