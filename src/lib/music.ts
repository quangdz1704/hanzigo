import {
  musicPlaylistSchema,
  trackListSchema,
  videoIdSchema,
  type MusicTrack,
} from "@/content/music-schema";

export function parseYouTubeVideo(input: string) {
  const text = input.trim();
  if (videoIdSchema.safeParse(text).success) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Em dán link video YouTube hoặc mã video 11 ký tự nhé.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("Chỉ nhận link HTTPS của YouTube.");
  let id: string | null = null;
  if (["youtu.be", "www.youtu.be"].includes(url.hostname))
    id = url.pathname.slice(1);
  if (
    [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "www.youtube-nocookie.com",
      "youtube-nocookie.com",
    ].includes(url.hostname)
  ) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (/^\/(embed|shorts|live)\//.test(url.pathname))
      id = url.pathname.split("/")[2];
  }
  if (!videoIdSchema.safeParse(id).success)
    throw new Error(
      "Cần link một video YouTube cụ thể. Để mix, em thêm các bài vào playlist của mình nhé.",
    );
  return id!;
}
export const youtubeWatchUrl = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoIdSchema.parse(videoId)}`;
export function youtubeSearchUrl(query: string) {
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", query.trim() || "nhạc tiếng Trung");
  return url.href;
}
export const unpackTracks = (raw: string) =>
  trackListSchema.parse(JSON.parse(raw));
export function mixTracks(
  lists: MusicTrack[][],
  shuffle = false,
  random = Math.random,
) {
  const tracks = [...new Map(lists.flat().map((t) => [t.videoId, t])).values()];
  if (tracks.length > 100)
    throw new Error(
      "Mỗi lượt mix tối đa 100 bài. Em chọn ít playlist hơn nhé.",
    );
  if (shuffle)
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
  return tracks;
}
export function makePlaylist(
  name: string,
  tracks: MusicTrack[],
  id: string = crypto.randomUUID(),
  deleted = false,
  now = Date.now(),
  visibility: "private" | "public" = "private",
) {
  return musicPlaylistSchema.parse({
    id,
    name,
    raw: JSON.stringify(trackListSchema.parse(tracks)),
    deleted,
    visibility,
    updatedAt: now,
  });
}
