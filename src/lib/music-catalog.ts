import { z } from "zod";
import {
  doc,
  getDocFromServer,
  getDocsFromServer,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from "firebase/firestore";
import {
  musicCatalogSchema,
  musicTrackSchema,
  videoIdSchema,
  type MusicCatalog,
} from "@/content/music-schema";
const playlistSchema = musicCatalogSchema.shape.playlists.element;
export const musicManifestSchema = z
  .object({
    version: z.literal(1),
    revision: z.string().uuid(),
    trackIds: z.array(videoIdSchema).max(100),
    playlistIds: z.array(playlistSchema.shape.id).max(20),
  })
  .strict()
  .refine(
    (m) =>
      new Set(m.trackIds).size === m.trackIds.length &&
      new Set(m.playlistIds).size === m.playlistIds.length,
  );

export function writeMusicCatalog(
  transaction: Transaction,
  store: Firestore,
  uid: string,
  input: unknown,
) {
  const music = musicCatalogSchema.parse(input);
  const revision = crypto.randomUUID();
  const stamp = { revision, updatedBy: uid, updatedAt: serverTimestamp() };
  for (const track of music.tracks)
    transaction.set(doc(store, "musicTracks", track.videoId), {
      ...track,
      ...stamp,
    });
  for (const playlist of music.playlists)
    transaction.set(doc(store, "musicPlaylists", playlist.id), {
      ...playlist,
      ...stamp,
    });
  transaction.set(doc(store, "musicCatalog", "current"), {
    version: 1,
    trackIds: music.tracks.map((t) => t.videoId),
    playlistIds: music.playlists.map((p) => p.id),
    ...stamp,
  });
}
export async function publishNormalizedMusicCatalog(
  store: Firestore,
  uid: string,
  input: unknown,
) {
  await runTransaction(store, async (transaction) => {
    writeMusicCatalog(transaction, store, uid, input);
  });
}
const manifestValue = (data: Record<string, unknown>) => {
  const { updatedBy: _by, updatedAt: _at, ...value } = data;
  return musicManifestSchema.parse(value);
};
export async function readMusicCatalog(
  store: Firestore,
  input?: Record<string, unknown>,
): Promise<MusicCatalog> {
  const data =
    input ??
    (await getDocFromServer(doc(store, "musicCatalog", "current"))).data();
  if (!data) throw new Error("Thư viện nhạc trực tuyến chưa được khởi tạo.");
  const manifest = manifestValue(data);
  const readRows = async (name: string, ids: string[]) => {
    const snapshot = await getDocsFromServer(
      query(
        collection(store, name),
        where("revision", "==", manifest.revision),
        limit(ids.length + 1),
      ),
    );
    if (snapshot.size !== ids.length)
      throw new Error("Thư viện nhạc đang cập nhật. Em thử tải lại nhé.");
    const rows = new Map(snapshot.docs.map((row) => [row.id, row.data()]));
    return ids.map((id) => {
      const row = rows.get(id);
      if (!row) throw new Error("Thư viện nhạc thiếu nội dung đã xuất bản.");
      const {
        revision: _revision,
        updatedAt: _at,
        updatedBy: _by,
        ...value
      } = row;
      return { id, value };
    });
  };
  const [trackRows, playlistRows] = await Promise.all([
    readRows("musicTracks", manifest.trackIds),
    readRows("musicPlaylists", manifest.playlistIds),
  ]);
  const tracks = trackRows.map(({ id, value }) => {
    const track = musicTrackSchema.parse(value);
    if (track.videoId !== id) throw new Error("Mã bài hát không khớp.");
    return track;
  });
  const playlists = playlistRows.map(({ id, value }) => {
    const list = playlistSchema.parse(value);
    if (list.id !== id) throw new Error("Mã playlist không khớp.");
    return list;
  });
  return musicCatalogSchema.parse({ version: 1, tracks, playlists });
}
export function watchMusicCatalog(
  store: Firestore,
  next: (catalog: MusicCatalog) => void,
  error: (error: Error) => void,
) {
  let generation = 0,
    stopped = false;
  const stop = onSnapshot(
    doc(store, "musicCatalog", "current"),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      const version = ++generation;
      if (!snapshot.exists()) {
        error(new Error("Thư viện nhạc trực tuyến chưa được khởi tạo."));
        return;
      }
      void readMusicCatalog(store, snapshot.data())
        .then((catalog) => {
          if (!stopped && version === generation) next(catalog);
        })
        .catch((e) => {
          if (!stopped && version === generation) error(e);
        });
    },
    error,
  );
  return () => {
    stopped = true;
    generation++;
    stop();
  };
}
