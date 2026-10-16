import { beforeEach, describe, expect, it } from "vitest";
import { bundledContent } from "../../src/content";
import seed from "../../src/content/music-seed.json";
import {
  compactAccountCache,
  compactInactiveAccountCaches,
  offlineLibrarySnapshot,
} from "../../src/lib/local-cache";
import {
  db,
  getAccountDatabase,
  putAccountRecord,
  selectLearningDatabase,
} from "../../src/lib/db";
import { makePlaylist } from "../../src/lib/music";
import { musicCatalogSchema } from "../../src/content/music-schema";
import { packLibrary } from "../../src/lib/cloud-content";
const music = musicCatalogSchema.parse(seed);
beforeEach(() => selectLearningDatabase(null));
describe("small, recoverable device cache", () => {
  it("omits music from the sole offline story snapshot without changing stories", () => {
    const raw = offlineLibrarySnapshot(
      packLibrary({ ...bundledContent, music }),
    )!;
    expect(JSON.parse(raw).music).toBeUndefined();
    expect(JSON.parse(raw).stories).toEqual(bundledContent.stories);
    expect(new TextEncoder().encode(raw).length).toBeLessThan(512 * 1024);
  });
  it("never compacts guest data or an account without confirmed server hydration", async () => {
    const account = getAccountDatabase(`unconfirmed-${crypto.randomUUID()}`);
    await account.musicPlaylists.put(
      makePlaylist("Keep", music.tracks.slice(0, 1)),
    );
    expect(await compactAccountCache(account)).toBe(0);
    expect(await account.musicPlaylists.count()).toBe(1);
    expect(await compactAccountCache(db)).toBe(0);
    await account.delete();
  });
  it("removes synced copies while retaining every pending row, outbox entry and draft", async () => {
    const account = getAccountDatabase(`compact-${crypto.randomUUID()}`);
    await account.meta.put({ id: "cloudHydrated", value: "confirmed" });
    const synced = makePlaylist("Synced", music.tracks.slice(0, 1));
    const pending = makePlaylist("Pending", music.tracks.slice(0, 2));
    await account.musicPlaylists.put(synced);
    await putAccountRecord(account, "musicPlaylists", pending);
    await account.drafts.put({
      id: "unsaved",
      raw: "draft text",
      updatedAt: 1,
    });
    expect(await compactAccountCache(account)).toBe(1);
    account.close();
    await account.open();
    expect(await account.musicPlaylists.get(pending.id)).toEqual(pending);
    expect(await account.syncQueue.count()).toBe(1);
    expect(await account.drafts.get("unsaved")).toBeDefined();
    await account.delete();
  });
  it("leaves the active account cache intact when cleaning inactive accounts", async () => {
    const uid = `active-${crypto.randomUUID()}`,
      account = selectLearningDatabase(uid);
    await account.meta.put({ id: "cloudHydrated", value: "confirmed" });
    const playlist = makePlaylist("Active", []);
    await account.musicPlaylists.put(playlist);
    await compactInactiveAccountCaches();
    expect(await account.musicPlaylists.get(playlist.id)).toEqual(playlist);
    selectLearningDatabase(null);
    await account.delete();
  });
  it("can clean repeatedly and concurrently, then reopen the account on login", async () => {
    const uid = `repeat-${crypto.randomUUID()}`,
      account = getAccountDatabase(uid);
    await account.meta.put({ id: "cloudHydrated", value: "confirmed" });
    await account.musicPlaylists.put(makePlaylist("Synced", []));
    const first = compactInactiveAccountCaches();
    expect(compactInactiveAccountCaches()).toBe(first);
    expect(await first).toBe(1);
    expect(await compactInactiveAccountCaches()).toBe(0);
    expect(selectLearningDatabase(uid)).toBe(account);
    expect(await account.meta.get("cloudHydrated")).toBeDefined();
    await putAccountRecord(account, "musicPlaylists", makePlaylist("New", []));
    expect(await account.syncQueue.count()).toBe(1);
    selectLearningDatabase(null);
    await account.delete();
  });
});
