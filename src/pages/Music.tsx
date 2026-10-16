import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ExternalLink,
  Headphones,
  ListMusic,
  Play,
  Plus,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useMusicCatalog } from "@/lib/useMusicCatalog";
import {
  type MusicTrack,
  type PublicMusicPlaylist,
} from "@/content/music-schema";
import { getLearningDatabase } from "@/lib/db";
import { useAuth } from "@/lib/Auth";
import { useOnline } from "@/lib/hooks";
import { backend } from "@/lib/firebase";
import { publishMusicCatalog } from "@/lib/cloud-content";
import { addPlaylistTrack, deleteMusicPlaylist } from "@/lib/music-db";
import { mixTracks, unpackTracks, youtubeSearchUrl } from "@/lib/music";
import { reportError, run, useUI, usePreferences } from "@/lib/store";
import { watchPublicMusic } from "@/lib/public-music";
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
  personal: "Tự chọn",
};
interface DisplayPlaylist {
  id: string;
  name: string;
  description: string;
  tracks: MusicTrack[];
  authorName: string;
  visibility: "private" | "public";
  source: "suggested" | "personal" | "community";
  personalId?: string;
  youtubePlaylistId?: string;
}
export default function Music() {
  const music = useMusicCatalog();
  const auth = useAuth(),
    online = useOnline();
  const database = getLearningDatabase();
  const registered = !!auth.learnerAccount && !auth.learnerAccount.isAnonymous;
  const authorName = usePreferences((s) => s.name);
  const [community, setCommunity] = useState<PublicMusicPlaylist[]>([]);
  const [publicLimit, setPublicLimit] = useState(24);
  const [publicRetry, setPublicRetry] = useState(0);
  const [publicStatus, setPublicStatus] = useState<
    "loading" | "ready" | "cache" | "error"
  >("loading");
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    if (!backend) {
      setPublicStatus("ready");
      return;
    }
    setPublicStatus("loading");
    return watchPublicMusic(
      backend.store,
      publicLimit,
      (rows, cached, more) => {
        setCommunity(rows);
        setHasMore(more);
        setPublicStatus(cached ? "cache" : "ready");
      },
      () => setPublicStatus("error"),
    );
  }, [publicLimit, publicRetry]);
  const saved = useLiveQuery(
    () => database.musicPlaylists.toArray(),
    [auth.learningScope],
    [],
  );
  const personal = saved
    .filter((p) => !p.deleted)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const catalog = music.catalog;
  const lists: DisplayPlaylist[] = [
    ...catalog.playlists.map<DisplayPlaylist>((p) => ({
      ...p,
      id: `suggested:${p.id}`,
      tracks: p.videoIds.map((id) =>
        catalog.tracks.find((t) => t.videoId === id)!,
      ),
      personalId: undefined as string | undefined,
      authorName: p.author ?? "HanziGo",
      visibility: "public",
      source: "suggested",
    })),
    ...personal.map<DisplayPlaylist>((p) => ({
      id: `personal:${p.id}`,
      name: p.name,
      description: "Playlist của em",
      tracks: unpackTracks(p.raw),
      personalId: p.id,
      authorName,
      visibility: p.visibility ?? "private",
      source: "personal",
    })),
    ...community
      .filter(
        (p) =>
          !(
            p.ownerUid === auth.learnerAccount?.uid &&
            saved.some((own) => own.id === p.playlistId)
          ),
      )
      .map((p) => ({
        id: `community:${p.ownerUid}:${p.playlistId}`,
        name: p.name,
        description: "Được chia sẻ từ cộng đồng HanziGo",
        tracks: unpackTracks(p.raw),
        authorName: p.authorName,
        visibility: "public" as const,
        source: "community" as const,
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
  const [source, setSource] = useState("all");
  const [songLimit, setSongLimit] = useState(24);
  const [publishing, setPublishing] = useState(false);
  const selectedLists = lists.filter((p) => selected.includes(p.id));
  const current = queue[index];
  useEffect(() => {
    if (request > 0)
      document
        .getElementById("music-player")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [request]);
  const tracksBySource = {
    suggested: catalog.tracks,
    personal: personal.flatMap((p) => unpackTracks(p.raw)),
    community: community.flatMap((p) => unpackTracks(p.raw)),
  };
  const candidates =
    source === "all"
      ? [
          ...tracksBySource.community,
          ...tracksBySource.personal,
          ...catalog.tracks,
        ]
      : tracksBySource[source as keyof typeof tracksBySource];
  // Deduplicate video IDs; curated metadata wins in the combined view.
  const searchableTracks = [
    ...new Map(candidates.map((t) => [t.videoId, t])).values(),
  ];
  const searchTerms = searchText(search).split(/\s+/).filter(Boolean);
  const visible = searchableTracks.filter((t) => {
    if (
      (pace !== "all" && t.pace !== pace) ||
      (mood !== "all" && t.mood !== mood)
    )
      return false;
    const text = searchText([t.title, t.titleVi, t.pinyin, t.artist].join(" "));
    return searchTerms.every((term) => text.includes(term));
  });
  const start = (tracks: MusicTrack[], at = 0) => {
    if (!tracks.length) {
      useUI
        .getState()
        .notify("Playlist này còn trống. Em thêm vài bài trước nhé.");
      return;
    }
    const offset = Math.floor(at / 100) * 100;
    setQueue(tracks.slice(offset, offset + 100));
    setIndex(at - offset);
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
      <div className="music-sync-note" role="status">
        <p>
          {music.status === "firebase"
            ? `Thư viện trực tuyến: ${catalog.tracks.length} bài · ${catalog.playlists.length} playlist gợi ý. Đã tải từ Firebase.`
            : music.status === "demo"
              ? "Đang dùng bộ nhạc demo."
              : music.status === "loading"
                ? "Đang tải thư viện nhạc trực tuyến…"
                : `Chưa tải được thư viện nhạc. ${music.message}`}
        </p>
        {music.status === "error" && (
          <Button variant="outline" onClick={music.retry}>
            Tải lại thư viện nhạc
          </Button>
        )}
      </div>
      <section className="music-hero card">
        <div>
          <p className="eyebrow">HÔM NAY EM MUỐN NGHE GÌ?</p>
          <h2>Để tiếng Trung đi cùng một giai điệu.</h2>
          <p className="muted">
            Chọn một playlist, hoặc pha vài playlist thành buổi nghe của riêng
            em.
          </p>
          <div className="button-row">
            <Button asChild variant="outline">
              <a href="#music-discover">Tìm bài hát</a>
            </Button>
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
      <div className="music-sync-note" role="status">
        <p>
          {registered ? (
            auth.dataSyncStatus === "synced" ? (
              "Playlist và dữ liệu học đã đồng bộ Firebase."
            ) : auth.dataSyncStatus === "error" ? (
              "Chưa lưu được lên Firebase. Bản trên máy vẫn được giữ; em thử đồng bộ lại nhé."
            ) : !online ? (
              "Đang offline. Playlist sẽ đồng bộ Firebase khi có mạng."
            ) : (
              "Đang tải / đồng bộ playlist và dữ liệu tài khoản lên Firebase…"
            )
          ) : (
            <>
              Khách lưu playlist trên thiết bị này.{" "}
              <Link to="/register">Đăng ký / đăng nhập</Link> để lưu theo tài
              khoản Firebase và chia sẻ công khai.
            </>
          )}
        </p>
        {registered && auth.profileStatus === "error" && (
          <p>
            Hồ sơ tài khoản chưa đồng bộ Firebase.{" "}
            <Button variant="ghost" size="sm" onClick={auth.retryProfile}>
              Thử lưu hồ sơ
            </Button>
          </p>
        )}
        {registered && auth.dataSyncStatus === "error" && (
          <Button variant="outline" size="sm" onClick={auth.retryDataSync}>
            Thử đồng bộ Firebase
          </Button>
        )}
      </div>
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
                  <small>
                    Người tạo: {p.authorName} ·{" "}
                    {p.visibility === "public" ? "Công khai" : "Cá nhân"}
                  </small>
                </span>
              </label>
              {p.youtubePlaylistId && (
                <a
                  className="music-source-link"
                  href={`https://www.youtube.com/playlist?list=${p.youtubePlaylistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Playlist gốc trên YouTube ↗
                </a>
              )}
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
                            visibility: p.visibility,
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
                        {p.visibility === "public" ? "Ẩn / gỡ công khai" : "Ẩn"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="content-note" role="status">
          {publicStatus === "error"
            ? "Chưa tải được playlist cộng đồng từ Firebase. Em có thể thử lại."
            : publicStatus === "cache"
              ? "Playlist cộng đồng đang hiển thị từ bản nhớ trên máy."
              : publicStatus === "loading"
                ? "Đang tải playlist cộng đồng…"
                : `${catalog.playlists.length} playlist gợi ý · ${community.length} playlist do cộng đồng chia sẻ đã tải.`}
        </p>
        <div className="button-row">
          {publicStatus === "error" && (
            <Button
              variant="outline"
              onClick={() => setPublicRetry((n) => n + 1)}
            >
              Thử tải playlist cộng đồng
            </Button>
          )}
          {hasMore && (
            <Button
              variant="outline"
              onClick={() => setPublicLimit((n) => n + 24)}
            >
              Xem thêm playlist công khai
            </Button>
          )}
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
                    {p.visibility === "public"
                      ? "Khôi phục công khai"
                      : "Khôi phục"}
                  </Button>
                </div>
              ))}
          </details>
        )}
      </section>
      <section id="music-discover" className="music-discover">
        <div className="section-heading">
          <h2>Khám phá từng giai điệu</h2>
        </div>
        <div className="filters music-filters">
          <label className="field">
            Tìm bài hát
            <input
              type="search"
              aria-describedby="music-search-help"
              placeholder="Tên bài, ca sĩ, Pinyin…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSongLimit(24);
              }}
            />
          </label>
          <label className="field">
            Độ dễ theo
            <select
              value={pace}
              onChange={(e) => {
                setPace(e.target.value);
                setSongLimit(24);
              }}
            >
              <option value="all">Tất cả</option>
              {Object.entries(paceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Tâm trạng
            <select
              value={mood}
              onChange={(e) => {
                setMood(e.target.value);
                setSongLimit(24);
              }}
            >
              <option value="all">Tất cả</option>
              {Object.entries(moodLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Nguồn bài hát
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setSongLimit(24);
              }}
            >
              <option value="all">Tất cả</option>
              <option value="suggested">Bài gợi ý</option>
              <option value="personal">Playlist của em</option>
              <option value="community">Cộng đồng</option>
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
        <p id="music-search-help" className="muted">
          Tìm trong bài gợi ý, playlist của em và cộng đồng đã tải, bằng tiếng
          Trung, tiếng Việt hoặc Pinyin, có dấu hay không dấu.
        </p>
        <p role="status" className="muted">
          {visible.length} bài phù hợp
        </p>
        <div className="music-song-grid">
          {visible.slice(0, songLimit).map((t) => (
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
                {t.pinyin && <p className="pinyin">{t.pinyin}</p>}
                {t.titleVi && <p>{t.titleVi}</p>}
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
        {visible.length > songLimit && (
          <Button variant="outline" onClick={() => setSongLimit((n) => n + 24)}>
            Xem thêm bài hát ({visible.length - songLimit} bài còn lại)
          </Button>
        )}
        {!visible.length && (
          <div className="empty-state music-search-empty">
            <h3>Không tìm thấy bài hát phù hợp</h3>
            <p>
              {search.trim()
                ? `Chưa tìm thấy bài phù hợp với “${search.trim()}” và bộ lọc hiện tại trong HanziGo.`
                : "Chưa có bài phù hợp với bộ lọc hiện tại trong HanziGo."}
            </p>
            <div className="button-row">
              <Button asChild>
                <a
                  href={youtubeSearchUrl(search)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={17} /> Tìm trên YouTube
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setPace("all");
                  setMood("all");
                  setSource("all");
                }}
              >
                Xóa tìm kiếm và bộ lọc
              </Button>
            </div>
            <small className="muted">Mở kết quả YouTube trong tab mới.</small>
          </div>
        )}
      </section>
      <p className="content-note">
        Độ dễ theo là gợi ý biên tập. Phụ đề, tốc độ và khả năng phát nhúng tùy
        từng video; có thể mở trực tiếp trên YouTube.
      </p>

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
