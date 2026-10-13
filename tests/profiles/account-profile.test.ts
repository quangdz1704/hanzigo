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
  onIdTokenChanged,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  getDocFromServer,
  doc,
  setDoc,
  serverTimestamp,
  terminate,
} from "firebase/firestore";
import {
  ensureGuest,
  registerLearner,
  loginLearner,
} from "../../src/lib/learner-auth";
import { deviceProfileTransport } from "../../src/lib/account-profile";
import {
  startProfileSync,
  type LocalProfile,
} from "../../src/lib/profile-sync";

if (
  !process.env.FIREBASE_AUTH_EMULATOR_HOST?.endsWith(":9099") ||
  !process.env.FIRESTORE_EMULATOR_HOST?.endsWith(":8080")
)
  throw new Error("Both local demo emulators are required.");
let env: RulesTestEnvironment;
const apps: FirebaseApp[] = [];
const stores: ReturnType<typeof getFirestore>[] = [];
const stops: (() => void)[] = [];
function session() {
  const app = initializeApp(
    {
      apiKey: "fake-api-key",
      projectId: "demo-hanzigo",
      appId: "demo-profile",
      authDomain: "demo-hanzigo.firebaseapp.com",
    },
    `profile-${apps.length}`,
  );
  apps.push(app);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const store = getFirestore(app);
  stores.push(store);
  connectFirestoreEmulator(store, "127.0.0.1", 8080);
  return { auth, store };
}
function local(name: string) {
  let state = { name, pending: false };
  let changed = () => {};
  const adapter: LocalProfile = {
    get: () => state,
    accept: (name) => {
      state = { name, pending: false };
    },
    subscribe: (next) => {
      changed = next;
      return () => {
        changed = () => {};
      };
    },
  };
  return {
    adapter,
    name: () => state.name,
    edit: (name: string) => {
      state = { name, pending: true };
      changed();
    },
  };
}
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
describe("account profiles with real Auth and Firestore emulators", () => {
  it("observes anonymous upgrade, migrates its device record and syncs the name between two authenticated sessions", async () => {
    const a = session();
    const guest = await ensureGuest(a.auth);
    const uid = guest.uid;
    const events: boolean[] = [];
    const stopAuth = onIdTokenChanged(a.auth, (user) => {
      if (user) events.push(user.isAnonymous);
    });
    stops.push(stopAuth);
    await expect.poll(() => events.includes(true)).toBe(true);
    await setDoc(doc(a.store, "devices", uid), {
      uid,
      label: "Old device",
      createdAt: serverTimestamp(),
      lastPing: serverTimestamp(),
    });
    const originalTime = (await getDocFromServer(doc(a.store, "devices", uid)))
      .data()
      ?.createdAt.toMillis();
    const email = `profile-${Date.now()}@example.test`;
    const user = await registerLearner(
      a.auth,
      email,
      "Local-profile-42!",
      "Local-profile-42!",
    );
    await expect.poll(() => events.includes(false)).toBe(true);
    expect(user.uid).toBe(uid);
    const localA = local("Tên cũ trên máy");
    const syncA = startProfileSync(
      localA.adapter,
      deviceProfileTransport(a.store, user),
      () => {},
    );
    stops.push(syncA.stop);
    await expect
      .poll(
        async () =>
          (await getDocFromServer(doc(a.store, "devices", uid))).data()?.name,
      )
      .toBe("Tên cũ trên máy");
    const metadata = (
      await getDocFromServer(doc(a.store, "devices", uid))
    ).data();
    expect(metadata?.email).toBe(email);
    expect(metadata?.createdAt.toMillis()).toBe(originalTime);
    const b = session();
    const userB = await loginLearner(b.auth, email, "Local-profile-42!");
    expect(userB.uid).toBe(uid);
    const localB = local("em");
    const syncB = startProfileSync(
      localB.adapter,
      deviceProfileTransport(b.store, userB),
      () => {},
    );
    stops.push(syncB.stop);
    await expect.poll(localB.name).toBe("Tên cũ trên máy");
    localA.edit("Mai Anh");
    await expect.poll(localB.name, { timeout: 10000 }).toBe("Mai Anh");
    expect(localA.adapter.get().pending).toBe(false);
    const final = (await getDocFromServer(doc(b.store, "devices", uid))).data();
    expect(final?.label).toBe("Mai Anh");
    expect(final?.email).toBe(email);
    expect(final?.createdAt.toMillis()).toBe(originalTime);
  });
});
