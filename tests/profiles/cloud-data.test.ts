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
  it("publishes and updates lessons without rebuilding, preserving another story's concurrent edit", async () => {
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
