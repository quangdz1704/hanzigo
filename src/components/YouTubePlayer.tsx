import { useEffect, useRef, useState } from "react";
import {
  loadYouTubeAPI,
  youtubeError,
  type YouTubePlayer as Player,
} from "@/lib/youtube";
import { youtubeWatchUrl } from "@/lib/music";
import type { MusicTrack } from "@/content/music-schema";
import { Button } from "./ui/button";

export function YouTubePlayer({
  track,
  request,
  onEnded,
}: {
  track: MusicTrack;
  request: number;
  onEnded: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const current = useRef({ track, onEnded });
  current.current = { track, onEnded };
  const [status, setStatus] = useState("Đang kết nối YouTube…");
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false;
    setReady(false);
    setStatus("Đang kết nối YouTube…");
    void loadYouTubeAPI()
      .then((api) => {
        if (stopped || !host.current) return;
        const mount = document.createElement("div");
        host.current.replaceChildren(mount);
        const instance = new api.Player(mount, {
          videoId: current.current.track.videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            controls: 1,
            playsinline: 1,
            origin: window.location.origin,
            hl: "vi",
          },
          events: {
            onReady: () => {
              if (!stopped) {
                setReady(true);
                setStatus("Chạm nút phát trong video nếu nhạc chưa bắt đầu.");
              }
            },
            onStateChange: (event) => {
              if (stopped) return;
              if (event.data === 1) setStatus("");
              if (event.data === 0) current.current.onEnded();
            },
            onError: (event) => {
              if (!stopped) setStatus(youtubeError(event.data));
            },
            onAutoplayBlocked: () => {
              if (!stopped)
                setStatus(
                  "Trình duyệt đang chờ thao tác của em. Chạm nút phát trong video để nghe nhé.",
                );
            },
          },
        });
        player.current = instance;
        const frame = instance.getIframe();
        frame.title = `Nghe ${current.current.track.title} trên YouTube`;
        frame.allow =
          "autoplay; encrypted-media; picture-in-picture; fullscreen";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
      })
      .catch((error: Error) => {
        if (!stopped) setStatus(error.message);
      });
    return () => {
      stopped = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [retry]);
  useEffect(() => {
    if (!ready || !player.current) return;
    setStatus("Chạm nút phát trong video nếu nhạc chưa bắt đầu.");
    player.current.loadVideoById(track.videoId);
    player.current.getIframe().title = `Nghe ${track.title} trên YouTube`;
  }, [track.videoId, request, ready]);
  return (
    <>
      <div className="youtube-frame" ref={host} />
      {status && (
        <p className="music-player-status" role="status">
          {status}
        </p>
      )}
      <div className="button-row music-player-links">
        <a
          className="text-link"
          href={youtubeWatchUrl(track.videoId)}
          target="_blank"
          rel="noreferrer"
        >
          Mở trên YouTube ↗
        </a>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRetry((n) => n + 1)}
        >
          Tải lại trình phát
        </Button>
      </div>
    </>
  );
}
