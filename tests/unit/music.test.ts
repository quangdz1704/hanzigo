import { beforeEach, describe, expect, it } from "vitest";
import { bundledContent, stories } from "../../src/content";
import { musicCatalogSchema } from "../../src/content/music-schema";
import {
  makePlaylist,
  mixTracks,
  parseYouTubeVideo,
  unpackTracks,
} from "../../src/lib/music";
import {
  saveMusicPlaylist,
  addPlaylistTrack,
  deleteMusicPlaylist,
} from "../../src/lib/music-db";
import {
  db,
  exportLearning,
  importLearning,
  migrateGuestLearning,
  selectLearningDatabase,
  getAccountDatabase,
} from "../../src/lib/db";
import { packLibrary, unpackLibrary } from "../../src/lib/cloud-content";
import { mergeAccountRecord } from "../../src/lib/account-data";

const catalog = musicCatalogSchema.parse(bundledContent.music);
const [one, two, three] = catalog.tracks;
beforeEach(async () => {
  selectLearningDatabase(null);
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe("YouTube links and curated mixes", () => {
  it("accepts video/watch/short/embed/mobile links without trusting arbitrary embed HTML", () => {
    for (const link of [
      one.videoId,
      `https://youtu.be/${one.videoId}?t=10`,
      `https://www.youtube.com/watch?v=${one.videoId}&list=PLtest`,
      `https://m.youtube.com/shorts/${one.videoId}`,
      `https://www.youtube-nocookie.com/embed/${one.videoId}`,
    ])
      expect(parseYouTubeVideo(link)).toBe(one.videoId);
    for (const link of [
      `https://youtube.com.evil.test/watch?v=${one.videoId}`,
      `https://evil.test@youtube.com/watch?v=${one.videoId}`,
      `javascript:alert(1)`,
      `<iframe src="https://youtube.com/embed/${one.videoId}">`,
      "https://www.youtube.com/playlist?list=PLtest",
      "https://youtu.be/invalid",
    ])
      expect(() => parseYouTubeVideo(link)).toThrow();
  });
  it("deduplicates mixed playlists and shuffles without changing or losing songs", () => {
    const lists = [
      [one, two],
      [two, three],
    ];
    expect(mixTracks(lists).map((t) => t.videoId)).toEqual(
      [one, two, three].map((t) => t.videoId),
    );
    const shuffled = mixTracks(lists, true, () => 0);
    expect(shuffled.map((t) => t.videoId).sort()).toEqual(
      [one, two, three].map((t) => t.videoId).sort(),
    );
    expect(shuffled[0]).not.toBe(one);
    expect(lists[0]).toEqual([one, two]);
  });
  it("keeps catalog metadata valid and rejects dangling playlist entries", () => {
    expect(catalog.tracks).toHaveLength(6);
    expect(() =>
      musicCatalogSchema.parse({
        ...catalog,
        playlists: [{ ...catalog.playlists[0], videoIds: ["abcdefghijk"] }],
      }),
    ).toThrow();
    const { music: _music, ...legacy } = bundledContent;
    expect(unpackLibrary(packLibrary(legacy)).music).toBeUndefined();
    expect(unpackLibrary(packLibrary(bundledContent)).music).toEqual(catalog);
    expect(bundledContent.stories[0]).toEqual(stories[0]);
  });
});
describe("private, offline playlist persistence", () => {
  it("creates, edits, deduplicates and restores a hidden playlist after database reopen", async () => {
    const id = await saveMusicPlaylist("Nhạc của em", [one]);
    await Promise.all([addPlaylistTrack(id, two), addPlaylistTrack(id, two)]);
    expect(unpackTracks((await db.musicPlaylists.get(id))!.raw)).toHaveLength(
      2,
    );
    await saveMusicPlaylist("Tên mới", [two, one], id);
    await deleteMusicPlaylist(id);
    db.close();
    await db.open();
    expect((await db.musicPlaylists.get(id))?.deleted).toBe(true);
    await deleteMusicPlaylist(id, false);
    expect(unpackTracks((await db.musicPlaylists.get(id))!.raw)[0]).toEqual(
      two,
    );
    expect(await db.syncQueue.count()).toBe(0);
  });
  it("migrates a guest playlist into one account, preserves the queue and isolates another account", async () => {
    const id = await saveMusicPlaylist("Guest music", [one]);
    const uid = `music-${crypto.randomUUID()}`;
    await migrateGuestLearning(uid);
    const account = selectLearningDatabase(uid);
    expect((await account.musicPlaylists.get(id))?.name).toBe("Guest music");
    await addPlaylistTrack(id, two);
    account.close();
    await account.open();
    expect(await account.syncQueue.get(`musicPlaylists:${id}`)).toBeDefined();
    expect(unpackTracks((await db.musicPlaylists.get(id))!.raw)).toHaveLength(
      1,
    );
    const other = getAccountDatabase(`other-${uid}`);
    expect(await other.musicPlaylists.count()).toBe(0);
    selectLearningDatabase(null);
    await account.delete();
    await other.delete();
  });
  it("round-trips backups and never replaces a newer playlist with an older import", async () => {
    const id = await saveMusicPlaylist("Saved", [one]);
    const backup = await exportLearning();
    await db.musicPlaylists.clear();
    await importLearning(backup);
    expect((await db.musicPlaylists.get(id))?.name).toBe("Saved");
    const prior = (await db.musicPlaylists.get(id))!;
    await db.musicPlaylists.put({
      ...prior,
      name: "Newer",
      updatedAt: prior.updatedAt + 1,
    });
    await importLearning(backup);
    expect((await db.musicPlaylists.get(id))?.name).toBe("Newer");
    const { musicPlaylists: _music, ...legacy } = backup;
    await importLearning(legacy);
    expect(await db.musicPlaylists.count()).toBe(1);
  });
  it("rejects malformed playlists and converges concurrent edits deterministically", () => {
    const playlist = makePlaylist("Saved", [one]);
    expect(() => makePlaylist(" ", [one])).toThrow();
    expect(() => makePlaylist("Duplicates", [one, one])).toThrow();
    expect(() =>
      mergeAccountRecord("musicPlaylists", undefined, {
        ...playlist,
        raw: '[{"videoId":"bad"}]',
      }),
    ).toThrow();
    const changed = {
      ...playlist,
      name: "Another",
      updatedAt: playlist.updatedAt,
    };
    expect(mergeAccountRecord("musicPlaylists", playlist, changed)).toEqual(
      mergeAccountRecord("musicPlaylists", changed, playlist),
    );
  });
});
