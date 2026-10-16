import "fake-indexeddb/auto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  deleteDoc,
  getDocFromServer,
  getDoc,
  terminate,
} from "firebase/firestore";
import { registerLearner, loginLearner } from "../../src/lib/learner-auth";
import {
  startAccountSync,
  pushAccountRecord,
  accountRecordRef,
} from "../../src/lib/account-sync";
import { getAccountDatabase, putAccountRecord } from "../../src/lib/db";
import {
  publishLibrary,
  publishStory,
  unpackLibrary,
} from "../../src/lib/cloud-content";
import musicSeedRaw from "../../src/content/music-seed.json";
import { musicCatalogSchema } from "../../src/content/music-schema";
const musicSeed = musicCatalogSchema.parse(musicSeedRaw);
import { readMusicCatalog } from "../../src/lib/music-catalog";
import { bundledContent } from "../../src/content";
if (
  !process.env.FIREBASE_AUTH_EMULATOR_HOST?.endsWith(":9099") ||
  !process.env.FIRESTORE_EMULATOR_HOST?.endsWith(":8080")
)
  throw new Error("Local demo emulators required.");
let env: RulesTestEnvironment;
const apps: FirebaseApp[] = [];
const stores: ReturnType<typeof getFirestore>[] = [];
const stops: (() => void)[] = [];
function client() {
  const app = initializeApp(
    { apiKey: "fake-api-key", projectId: "demo-hanzigo", appId: "demo-cloud" },
    `cloud-${Date.now()}-${apps.length}`,
  );
  apps.push(app);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const store = getFirestore(app);
  connectFirestoreEmulator(store, "127.0.0.1", 8080);
  stores.push(store);
  return { auth, store };
}
const password = "Demo-cloud-only-42!";
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-hanzigo",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
afterAll(async () => {
  stops.forEach((stop) => stop());
  await Promise.all(stores.map(terminate));
  await Promise.all(apps.map(deleteApp));
  await env?.cleanup();
});
describe("Firebase cloud data flows", () => {
  it("syncs independent offline caches, survives queued-edit reopen, and deduplicates earned XP", async () => {
    const a = client();
    const email = `cloud-${Date.now()}@example.test`;
    const user = await registerLearner(a.auth, email, password, password);
    const b = client();
    await loginLearner(b.auth, email, password);
    const cacheA = getAccountDatabase(`${user.uid}-browserA`),
      cacheB = getAccountDatabase(`${user.uid}-browserB`);
    const aSync = startAccountSync(a.store, user.uid, cacheA, () => {});
    stops.push(aSync.stop);
    const bSync = startAccountSync(b.store, user.uid, cacheB, () => {});
    stops.push(bSync.stop);
    const progress = {
      id: "rainy-cafe",
      sentence: 9,
      completed: true,
      quizScore: 3,
      updatedAt: 100,
    };
    await cacheA.transaction("rw", cacheA.progress, cacheA.syncQueue, () =>
      putAccountRecord(cacheA, "progress", progress),
    );
    await expect
      .poll(async () => (await cacheB.progress.get("rainy-cafe"))?.completed, {
        timeout: 10000,
      })
      .toBe(true);
    await pushAccountRecord(b.store, user.uid, "progress", {
      ...progress,
      sentence: 2,
      completed: false,
      quizScore: 1,
      updatedAt: 200,
    });
    await expect
      .poll(async () => (await cacheA.progress.get("rainy-cafe"))?.sentence)
      .toBe(2);
    expect((await cacheA.progress.get("rainy-cafe"))?.quizScore).toBe(3);
    const activity = {
      id: "story:rainy-cafe",
      kind: "story",
      day: "2026-10-14",
      xp: 30,
      at: 100,
    };
    await Promise.all([
      pushAccountRecord(a.store, user.uid, "activities", activity),
      pushAccountRecord(b.store, user.uid, "activities", {
        ...activity,
        at: 200,
      }),
    ]);
    await expect.poll(async () => await cacheB.activities.count()).toBe(1);
    expect(
      (await cacheB.activities.toArray()).reduce((n, a) => n + a.xp, 0),
    ).toBe(30);
    await pushAccountRecord(a.store, user.uid, "preferences", {
      id: "fontSize",
      value: 30,
      updatedAt: 10,
    });
    await cacheA.transaction(
      "rw",
      cacheA.preferences,
      cacheA.syncQueue,
      async () => {
        await putAccountRecord(cacheA, "preferences", {
          id: "fontSize",
          value: 26,
          updatedAt: 1000,
        });
        await cacheA.syncQueue.update("preferences:fontSize", {
          initializeOnly: true,
        });
      },
    );
    await expect
      .poll(async () => (await cacheA.preferences.get("fontSize"))?.value, {
        timeout: 10000,
      })
      .toBe(30);
    aSync.stop();
    await cacheA.transaction("rw", cacheA.preferences, cacheA.syncQueue, () =>
      putAccountRecord(cacheA, "preferences", {
        id: "theme",
        value: "dark",
        updatedAt: 300,
      }),
    );
    cacheA.close();
    await cacheA.open();
    expect(await cacheA.syncQueue.count()).toBeGreaterThan(0);
    const reconnect = startAccountSync(a.store, user.uid, cacheA, () => {});
    stops.push(reconnect.stop);
    await expect
      .poll(async () => (await cacheB.preferences.get("theme"))?.value, {
        timeout: 10000,
      })
      .toBe("dark");
    await expect.poll(async () => await cacheA.syncQueue.count()).toBe(0);
  });
  it("syncs a daily plan and spaced mistake history across independent account caches", async () => {
    const a = client(),
      email = `study-${Date.now()}@example.test`;
    const user = await registerLearner(a.auth, email, password, password);
    const b = client();
    await loginLearner(b.auth, email, password);
    const cacheA = getAccountDatabase(`${user.uid}-studyA`),
      cacheB = getAccountDatabase(`${user.uid}-studyB`);
    const syncA = startAccountSync(a.store, user.uid, cacheA, () => {}),
      syncB = startAccountSync(b.store, user.uid, cacheB, () => {});
    stops.push(syncA.stop, syncB.stop);
    const at = new Date(2026, 9, 16, 10).getTime();
    const plan = {
      id: "2026-10-16",
      storyId: bundledContent.stories[0].id,
      reviewIds: [],
      startedAt: at,
      readAt: 0,
      updatedAt: at,
    };
    await cacheA.transaction("rw", cacheA.studyDays, cacheA.syncQueue, () =>
      putAccountRecord(cacheA, "studyDays", plan),
    );
    await expect
      .poll(async () => (await cacheB.studyDays.get(plan.id))?.storyId)
      .toBe(plan.storyId);
    await pushAccountRecord(b.store, user.uid, "studyDays", {
      ...plan,
      readAt: at + 100,
      updatedAt: at + 100,
    });
    await pushAccountRecord(a.store, user.uid, "studyDays", {
      ...plan,
      storyId: bundledContent.stories[1].id,
      startedAt: at + 200,
      updatedAt: at + 200,
    });
    await expect
      .poll(async () => (await cacheA.studyDays.get(plan.id))?.readAt)
      .toBe(at + 100);
    const { questionVersion, collectMistakes } =
      await import("../../src/lib/study");
    const q = bundledContent.stories[0].comprehensionQuestions[0];
    const answer = {
      id: "fe8f0b4e-2d83-4e7b-bff5-f7cbce23b270:" + q.id,
      attemptId: "fe8f0b4e-2d83-4e7b-bff5-f7cbce23b270",
      storyId: plan.storyId,
      questionId: q.id,
      version: questionVersion(q),
      choice: (q.answer + 1) % q.options.length,
      answer: q.answer,
      source: "story",
      at,
    };
    await cacheA.transaction("rw", cacheA.quizAnswers, cacheA.syncQueue, () =>
      putAccountRecord(cacheA, "quizAnswers", answer),
    );
    await expect.poll(async () => await cacheB.quizAnswers.count()).toBe(1);
    expect(
      collectMistakes(
        bundledContent.stories,
        await cacheB.quizAnswers.toArray(),
      )[0].corrections,
    ).toBe(0);
    await pushAccountRecord(b.store, user.uid, "quizAnswers", {
      ...answer,
      attemptId: "db6f7b62-9eea-4e47-b7b6-e70dbe84ce58",
      id: "db6f7b62-9eea-4e47-b7b6-e70dbe84ce58:" + q.id,
      choice: q.answer,
      source: "mistake",
      at: at + 86400000,
    });
    await expect
      .poll(
        async () =>
          collectMistakes(
            bundledContent.stories,
            await cacheA.quizAnswers.toArray(),
          )[0]?.corrections,
      )
      .toBe(1);
    expect(
      (
        await getDocFromServer(
          accountRecordRef(a.store, user.uid, "studyDays", plan.id),
        )
      ).data()?.value.storyId,
    ).toBe(plan.storyId);
  });
  it("restores private music playlists across devices and publishes a catalog without overwriting a story", async () => {
    const a = client(),
      b = client(),
      email = `music-${Date.now()}@example.test`;
    const user = await registerLearner(a.auth, email, password, password);
    await loginLearner(b.auth, email, password);
    const cacheB = getAccountDatabase(`${user.uid}-musicB`);
    const syncB = startAccountSync(b.store, user.uid, cacheB, () => {});
    stops.push(syncB.stop);
    const { makePlaylist, unpackTracks } = await import("../../src/lib/music");
    const { publishMusicCatalog } = await import("../../src/lib/cloud-content");
    const music = musicSeed;
    const playlist = makePlaylist("My mix", music.tracks.slice(0, 2));
    await pushAccountRecord(a.store, user.uid, "musicPlaylists", playlist);
    await expect
      .poll(async () => (await cacheB.musicPlaylists.get(playlist.id))?.name)
      .toBe("My mix");
    expect(
      unpackTracks((await cacheB.musicPlaylists.get(playlist.id))!.raw),
    ).toHaveLength(2);
    await pushAccountRecord(b.store, user.uid, "musicPlaylists", {
      ...playlist,
      deleted: true,
      updatedAt: playlist.updatedAt + 100,
    });
    expect(
      (
        await getDocFromServer(
          accountRecordRef(a.store, user.uid, "musicPlaylists", playlist.id),
        )
      ).data()?.value.deleted,
    ).toBe(true);
    await env.withSecurityRulesDisabled(async (context) =>
      setDoc(doc(context.firestore(), "config", "admins"), {
        uids: [user.uid],
      }),
    );
    const { music: _music, ...legacy } = bundledContent;
    await publishLibrary(a.store, user.uid, legacy);
    const edited = {
      ...bundledContent.stories[0],
      titleVi: "A concurrent story edit",
    };
    await Promise.all([
      publishStory(a.store, user.uid, edited),
      publishMusicCatalog(a.store, user.uid, music),
    ]);
    const library = unpackLibrary(
      (await getDocFromServer(doc(a.store, "content", "library"))).data()?.raw,
    );
    expect(library.music).toBeUndefined();
    expect(await readMusicCatalog(a.store)).toEqual(music);
    const musicGuest = client();
    expect(await readMusicCatalog(musicGuest.store)).toEqual(music);
    expect(library.stories[0].titleVi).toBe(edited.titleVi);
  });
  it("syncs public and private playlists atomically across users, guests and offline caches", async () => {
    const a = client(),
      b = client(),
      guest = client();
    const email = `public-music-${Date.now()}@example.test`;
    const user = await registerLearner(a.auth, email, password, password);
    await registerLearner(b.auth, `other-${email}`, password, password);
    const { deviceProfileTransport } =
      await import("../../src/lib/account-profile");
    const { makePlaylist } = await import("../../src/lib/music");
    const { publicMusicRef, watchPublicMusic } =
      await import("../../src/lib/public-music");
    await deviceProfileTransport(a.store, user).sync("Người tạo nhạc", true);
    const playlist = makePlaylist("Public demo", musicSeed.tracks.slice(0, 2));
    await pushAccountRecord(a.store, user.uid, "musicPlaylists", playlist);
    const ref = publicMusicRef(guest.store, user.uid, playlist.id);
    expect((await getDocFromServer(ref)).exists()).toBe(false);
    let publicLists: { playlistId: string; authorName: string }[] = [];
    const stop = watchPublicMusic(
      guest.store,
      24,
      (rows) => {
        publicLists = rows;
      },
      (e) => {
        throw e;
      },
    );
    stops.push(stop);
    const published = {
      ...playlist,
      visibility: "public",
      updatedAt: playlist.updatedAt + 10,
    };
    await pushAccountRecord(a.store, user.uid, "musicPlaylists", published);
    await expect
      .poll(
        () => publicLists.find((p) => p.playlistId === playlist.id)?.authorName,
      )
      .toBe("Người tạo nhạc");
    expect(
      Object.keys((await getDocFromServer(ref)).data()!).sort(),
    ).not.toContain("email");
    await expect(
      getDocFromServer(
        accountRecordRef(b.store, user.uid, "musicPlaylists", playlist.id),
      ),
    ).rejects.toThrow();
    await expect(
      setDoc(publicMusicRef(b.store, user.uid, playlist.id), {
        ...(await getDocFromServer(ref)).data(),
        authorName: "forged",
      }),
    ).rejects.toThrow();
    const privateAgain = {
      ...published,
      visibility: "private",
      updatedAt: published.updatedAt + 10,
    };
    await pushAccountRecord(a.store, user.uid, "musicPlaylists", privateAgain);
    await expect
      .poll(() => publicLists.some((p) => p.playlistId === playlist.id))
      .toBe(false);
    await pushAccountRecord(a.store, user.uid, "musicPlaylists", published); // Older offline copy cannot republish.
    expect((await getDocFromServer(ref)).exists()).toBe(false);
    const cache = getAccountDatabase(`${user.uid}-public-outbox`);
    await putAccountRecord(cache, "musicPlaylists", {
      ...published,
      updatedAt: privateAgain.updatedAt + 10,
    });
    cache.close();
    await cache.open();
    const sync = startAccountSync(a.store, user.uid, cache, () => {}, [
      "musicPlaylists",
    ]);
    stops.push(sync.stop);
    await expect
      .poll(async () => (await getDocFromServer(ref)).exists())
      .toBe(true);
    await expect.poll(async () => cache.syncQueue.count()).toBe(0);
    await putAccountRecord(cache, "musicPlaylists", {
      ...published,
      deleted: true,
      updatedAt: privateAgain.updatedAt + 20,
    });
    await expect
      .poll(async () => (await getDocFromServer(ref)).exists())
      .toBe(false);
    expect(
      (
        await getDocFromServer(
          accountRecordRef(a.store, user.uid, "musicPlaylists", playlist.id),
        )
      ).data()?.value.deleted,
    ).toBe(true);
  });
  it("recovers compacted account data from Firebase and preserves unsent changes", async () => {
    const a = client();
    const user = await registerLearner(
      a.auth,
      `compact-${Date.now()}@example.test`,
      password,
      password,
    );
    const { makePlaylist } = await import("../../src/lib/music");
    const { compactAccountCache } = await import("../../src/lib/local-cache");
    const cache = getAccountDatabase(`${user.uid}-compact-recovery`);
    const playlist = makePlaylist("Server playlist", []);
    await pushAccountRecord(a.store, user.uid, "musicPlaylists", playlist);
    let sync = startAccountSync(a.store, user.uid, cache, () => {});
    stops.push(() => sync.stop());
    await expect
      .poll(async () => (await cache.musicPlaylists.get(playlist.id))?.name)
      .toBe("Server playlist");
    await expect
      .poll(async () => !!(await cache.meta.get("cloudHydrated")))
      .toBe(true);
    sync.stop();
    await compactAccountCache(cache);
    expect(await cache.musicPlaylists.get(playlist.id)).toBeUndefined();
    sync = startAccountSync(a.store, user.uid, cache, () => {});
    await expect
      .poll(async () => (await cache.musicPlaylists.get(playlist.id))?.name)
      .toBe("Server playlist");
    sync.stop();
    await putAccountRecord(cache, "musicPlaylists", {
      ...playlist,
      name: "Offline change",
      updatedAt: playlist.updatedAt + 1,
    });
    await compactAccountCache(cache);
    expect((await cache.musicPlaylists.get(playlist.id))?.name).toBe(
      "Offline change",
    );
    expect(await cache.syncQueue.count()).toBe(1);
    sync = startAccountSync(a.store, user.uid, cache, () => {});
    await expect.poll(async () => cache.syncQueue.count()).toBe(0);
    expect(
      (
        await getDocFromServer(
          accountRecordRef(a.store, user.uid, "musicPlaylists", playlist.id),
        )
      ).data()?.value.name,
    ).toBe("Offline change");
    sync.stop();
  });
  it("publishes and updates lessons without rebuilding, preserving another story's concurrent edit", async () => {
    await env.withSecurityRulesDisabled(async (context) =>
      deleteDoc(doc(context.firestore(), "content", "library")),
    );
    const admin = client();
    const user = await registerLearner(
      admin.auth,
      `editor-${Date.now()}@example.test`,
      password,
      password,
    );
    await env.withSecurityRulesDisabled(async (context) =>
      setDoc(doc(context.firestore(), "config", "admins"), {
        uids: [user.uid],
      }),
    );
    await publishLibrary(admin.store, user.uid, bundledContent, true);
    await expect(
      publishLibrary(admin.store, user.uid, bundledContent, true),
    ).rejects.toThrow("đã có thư viện");
    const one = {
      ...bundledContent.stories[0],
      titleVi: "Truyện mới từ Firebase",
    };
    const two = {
      ...bundledContent.stories[1],
      titleVi: "Truyện thứ hai cập nhật",
    };
    await Promise.all([
      publishStory(admin.store, user.uid, one),
      publishStory(admin.store, user.uid, two),
    ]);
    const guest = client();
    const library = unpackLibrary(
      (await getDocFromServer(doc(guest.store, "content", "library"))).data()
        ?.raw,
    );
    expect(library.stories[0].titleVi).toBe(one.titleVi);
    expect(library.stories[1].titleVi).toBe(two.titleVi);
    await pushAccountRecord(admin.store, user.uid, "drafts", {
      id: "unfinished",
      raw: "{unfinished",
      updatedAt: 1,
    });
    expect(
      (
        await getDoc(
          accountRecordRef(admin.store, user.uid, "drafts", "unfinished"),
        )
      ).data()?.value.raw,
    ).toBe("{unfinished");
  });
});
