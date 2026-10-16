import { db, getLearningDatabase, putAccountRecord } from "./db";
import { makePlaylist, mixTracks, unpackTracks } from "./music";
import type { MusicTrack } from "@/content/music-schema";

export async function saveMusicPlaylist(
  name: string,
  tracks: MusicTrack[],
  id?: string,
  visibility?: "private" | "public",
) {
  const database = getLearningDatabase();
  if (visibility === "public" && database === db)
    throw new Error("Đăng nhập để chia sẻ playlist công khai nhé.");
  const value = makePlaylist(name, tracks, id);
  await database.transaction(
    "rw",
    database.musicPlaylists,
    database.syncQueue,
    async () => {
      const old = await database.musicPlaylists.get(value.id);
      await putAccountRecord(database, "musicPlaylists", {
        ...value,
        visibility: visibility ?? old?.visibility ?? "private",
        updatedAt: Math.max(value.updatedAt, (old?.updatedAt ?? -1) + 1),
      });
    },
  );
  return value.id;
}
export async function addPlaylistTrack(id: string, track: MusicTrack) {
  const database = getLearningDatabase();
  await database.transaction(
    "rw",
    database.musicPlaylists,
    database.syncQueue,
    async () => {
      const prior = await database.musicPlaylists.get(id);
      if (!prior || prior.deleted)
        throw new Error("Playlist này không còn tồn tại.");
      const tracks = mixTracks([unpackTracks(prior.raw), [track]]);
      await putAccountRecord(
        database,
        "musicPlaylists",
        makePlaylist(
          prior.name,
          tracks,
          prior.id,
          false,
          Math.max(Date.now(), prior.updatedAt + 1),
          prior.visibility ?? "private",
        ),
      );
    },
  );
}
export async function deleteMusicPlaylist(id: string, deleted = true) {
  const database = getLearningDatabase();
  await database.transaction(
    "rw",
    database.musicPlaylists,
    database.syncQueue,
    async () => {
      const prior = await database.musicPlaylists.get(id);
      if (prior)
        await putAccountRecord(database, "musicPlaylists", {
          ...prior,
          deleted,
          updatedAt: Math.max(Date.now(), prior.updatedAt + 1),
        });
    },
  );
}
