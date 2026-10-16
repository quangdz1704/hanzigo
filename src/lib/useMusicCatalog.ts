import { useEffect, useState } from "react";
import { musicCatalogSchema, type MusicCatalog } from "@/content/music-schema";
import { backend, backendMode } from "./firebase";
import { watchMusicCatalog } from "./music-catalog";
const empty: MusicCatalog = { version: 1, tracks: [], playlists: [] };
export function useMusicCatalog() {
  const [catalog, setCatalog] = useState(empty);
  const [status, setStatus] = useState<
    "loading" | "firebase" | "demo" | "error"
  >("loading");
  const [message, setMessage] = useState("");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus("loading");
    if (!backend) {
      if (backendMode !== "demo") {
        setStatus("error");
        setMessage(
          "Cấu hình Firebase chưa đầy đủ. Em kiểm tra cấu hình kết nối nhé.",
        );
        return () => {
          active = false;
        };
      }
      void import("@/content/music-seed.json")
        .then((seed) => {
          if (active) {
            setCatalog(musicCatalogSchema.parse(seed.default));
            setStatus("demo");
          }
        })
        .catch(() => {
          if (active) {
            setStatus("error");
            setMessage("Chưa tải được bộ nhạc demo.");
          }
        });
      return () => {
        active = false;
      };
    }
    const stop = watchMusicCatalog(
      backend.store,
      (catalog) => {
        setCatalog(catalog);
        setStatus("firebase");
        setMessage("");
      },
      (error) => {
        setStatus("error");
        setMessage(error.message);
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [attempt]);
  return { catalog, status, message, retry: () => retry((n) => n + 1) };
}
