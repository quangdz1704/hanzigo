import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
} from "firebase/firestore";
import {
  publicMusicPlaylistSchema,
  type PublicMusicPlaylist,
} from "@/content/music-schema";

export const publicMusicRef = (store: Firestore, uid: string, id: string) =>
  doc(store, "publicMusicPlaylists", `${uid}_${id}`);

export function watchPublicMusic(
  store: Firestore,
  count: number,
  next: (
    lists: PublicMusicPlaylist[],
    fromCache: boolean,
    hasMore: boolean,
  ) => void,
  error: (error: Error) => void,
) {
  return onSnapshot(
    query(
      collection(store, "publicMusicPlaylists"),
      orderBy("updatedAt", "desc"),
      limit(count),
    ),
    { includeMetadataChanges: true },
    (snapshot) => {
      const lists: PublicMusicPlaylist[] = [];
      for (const row of snapshot.docs) {
        // Ignore malformed external rows without hiding other valid playlists.
        const { updatedAt: _serverTime, ...value } = row.data();
        const parsed = publicMusicPlaylistSchema.safeParse(value);
        if (
          parsed.success &&
          row.id === `${parsed.data.ownerUid}_${parsed.data.playlistId}`
        )
          lists.push(parsed.data);
      }
      next(lists, snapshot.metadata.fromCache, snapshot.size === count);
    },
    error,
  );
}
