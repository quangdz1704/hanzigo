import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { MusicTrack } from "@/content/music-schema";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/Auth";
import { mixTracks, parseYouTubeVideo } from "@/lib/music";
import { saveMusicPlaylist } from "@/lib/music-db";
import { reportError, useUI, usePreferences } from "@/lib/store";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export interface PlaylistEdit {
  id?: string;
  name: string;
  tracks: MusicTrack[];
  visibility?: "private" | "public";
}
export function MusicPlaylistEditor({
  initial,
  onClose,
}: {
  initial: PlaylistEdit;
  onClose: () => void;
}) {
  const auth = useAuth();
  const registered = !!auth.learnerAccount && !auth.learnerAccount.isAnonymous;
  const authorName = usePreferences((s) => s.name);
  const [name, setName] = useState(initial.name);
  const [visibility, setVisibility] = useState<"private" | "public">(
    initial.visibility ?? "private",
  );
  const [tracks, setTracks] = useState(initial.tracks);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const move = (index: number, offset: number) =>
    setTracks((prior) => {
      const next = [...prior];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="music-editor">
        <DialogTitle className="dialog-heading">
          {initial.id ? "Chỉnh playlist của em" : "Một playlist mới"}
        </DialogTitle>
        <DialogDescription>
          Giữ những bài em thích ở cùng một chỗ. Mỗi playlist tối đa 100 bài.
        </DialogDescription>
        <label className="field">
          Tên playlist
          <input
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="field">
          Ai có thể xem?
          <select
            value={visibility}
            disabled={busy}
            onChange={(e) =>
              setVisibility(e.target.value as "private" | "public")
            }
          >
            <option value="private">Cá nhân · chỉ mình em</option>
            <option value="public" disabled={!registered}>
              Công khai · mọi người trong HanziGo
            </option>
          </select>
        </label>
        <p className="content-note">
          {visibility === "public" ? (
            `Mọi người sẽ thấy playlist và tên người tạo: ${authorName}. Email của em được giữ riêng. Chuyển về cá nhân để dừng chia sẻ.`
          ) : registered ? (
            "Playlist được lưu riêng trong tài khoản Firebase của em."
          ) : (
            <>
              Khách lưu playlist trên thiết bị này.{" "}
              <Link to="/register">Đăng ký / đăng nhập</Link> để lưu theo tài
              khoản và chia sẻ công khai.
            </>
          )}
        </p>
        <fieldset className="music-add-link" disabled={busy}>
          <legend>Thêm bài từ YouTube</legend>
          <label className="field">
            Link video
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="field">
            Ca sĩ / kênh YouTube (tùy chọn)
            <input
              maxLength={100}
              placeholder="Tên ca sĩ hoặc kênh đăng video"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </label>
          <label className="field">
            Tên bài (tùy chọn)
            <input
              maxLength={150}
              placeholder="Tên bài em muốn lưu"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={!url.trim() || tracks.length >= 100}
            onClick={() => {
              try {
                const videoId = parseYouTubeVideo(url);
                if (tracks.some((t) => t.videoId === videoId))
                  throw new Error("Bài này đã có trong playlist.");
                setTracks(
                  mixTracks([
                    tracks,
                    [
                      {
                        videoId,
                        title: title.trim() || `Video ${videoId}`,
                        titleVi: "Bài em thêm",
                        pinyin: "",
                        artist: artist.trim() || "YouTube · chưa rõ ca sĩ",
                        pace: "unknown",
                        mood: "personal",
                        tip: "Em có thể bật phụ đề hoặc giảm tốc độ ngay trong video nếu được hỗ trợ.",
                      },
                    ],
                  ]),
                );
                setUrl("");
                setTitle("");
                setArtist("");
                setError("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Link video chưa hợp lệ.",
                );
              }
            }}
          >
            Thêm vào danh sách
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <ol className="music-editor-tracks" aria-label="Bài hát trong playlist">
          {tracks.map((t, i) => (
            <li key={t.videoId}>
              <span>
                {i + 1}. {t.title}
              </span>
              <div className="button-row">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Đưa ${t.title} lên`}
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Đưa ${t.title} xuống`}
                  disabled={busy || i === tracks.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Bỏ ${t.title} khỏi playlist`}
                  disabled={busy}
                  onClick={() =>
                    setTracks((list) =>
                      list.filter((x) => x.videoId !== t.videoId),
                    )
                  }
                >
                  <X size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {!tracks.length && (
          <p className="muted">
            Em có thể lưu playlist trống rồi thêm bài từ mục Khám phá.
          </p>
        )}
        <div className="button-row">
          <Button
            disabled={busy || !name.trim()}
            onClick={() => {
              setBusy(true);
              void saveMusicPlaylist(name, tracks, initial.id, visibility)
                .then(() => {
                  useUI
                    .getState()
                    .notify(
                      registered
                        ? "Đã lưu trên máy. Đang đồng bộ playlist lên Firebase…"
                        : "Đã lưu playlist trên thiết bị này.",
                    );
                  onClose();
                })
                .catch(reportError)
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Đang lưu…" : "Lưu playlist"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Để sau
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
