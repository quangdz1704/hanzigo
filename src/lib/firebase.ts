import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  Timestamp,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { db, type CachedLetter, type Receipt } from "./db";
import {
  messageInputSchema,
  validatePublish,
  type MessageInput,
} from "./messages";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
const required = [
  config.apiKey,
  config.authDomain,
  config.projectId,
  config.appId,
];
export const backendMode = required.every(Boolean)
  ? "cloud"
  : required.some(Boolean)
    ? "invalid"
    : "demo";
export const backend =
  backendMode === "cloud"
    ? (() => {
        const learner = initializeApp(config);
        const admin = initializeApp(config, "hanzigo-admin");
        const auth = getAuth(learner);
        const adminAuth = getAuth(admin);
        auth.languageCode = "vi";
        adminAuth.languageCode = "vi";
        const store = getFirestore(learner);
        const adminStore = getFirestore(admin);
        if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
          connectAuthEmulator(auth, "http://127.0.0.1:9099", {
            disableWarnings: true,
          });
          connectAuthEmulator(adminAuth, "http://127.0.0.1:9099", {
            disableWarnings: true,
          });
          connectFirestoreEmulator(store, "127.0.0.1", 8080);
          connectFirestoreEmulator(adminStore, "127.0.0.1", 8080);
        }
        const adminReady = setPersistence(adminAuth, browserSessionPersistence);
        return { auth, adminAuth, store, adminStore, adminReady };
      })()
    : null;
let trustedAnchor: { server: number; performance: number } | null = null;
export const trustedNow = () =>
  trustedAnchor
    ? trustedAnchor.server +
      (performance.now() - trustedAnchor.performance) -
      5000
    : null;
export async function syncServerClock(uid: string) {
  if (!backend) return;
  const ref = doc(backend.store, "devices", uid);
  await runTransaction(backend.store, async (transaction) => {
    const prior = await transaction.get(ref);
    transaction.set(
      ref,
      {
        uid,
        label: prior.exists() ? prior.data().label : "Thiết bị của em",
        createdAt: prior.exists() ? prior.data().createdAt : serverTimestamp(),
        lastPing: serverTimestamp(),
      },
      { merge: true },
    );
  });
  const snapshot = await getDocFromServer(ref);
  const at = snapshot.data()?.lastPing;
  if (!(at instanceof Timestamp))
    throw new Error("Chưa lấy được giờ từ máy chủ.");
  trustedAnchor = { server: at.toMillis(), performance: performance.now() };
}
const readTime = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : 0);
export function parseLetter(
  id: string,
  raw: Record<string, unknown>,
): CachedLetter {
  const input = messageInputSchema.parse({
    ...raw,
    scheduledAt:
      raw.scheduledAt instanceof Timestamp
        ? raw.scheduledAt.toMillis()
        : undefined,
  });
  const status = raw.status;
  if (
    status !== "draft" &&
    status !== "scheduled" &&
    status !== "published" &&
    status !== "archived"
  )
    throw new Error("Trạng thái thư không hợp lệ.");
  return {
    id,
    ...input,
    status,
    visibleAt: readTime(raw.visibleAt),
    createdAt: readTime(raw.createdAt),
    updatedAt: readTime(raw.updatedAt),
  };
}
export function subscribeLearner(uid: string, onError: (e: Error) => void) {
  if (!backend) return () => {};
  let unsubscribe = () => {};
  let receiptUnsubscribe = () => {};
  let stopped = false;
  let refreshing = false;
  // Publication releases instant and UX-milestone letters. Future letters remain
  // status=scheduled, and are queried separately against trusted server time.
  const publishedUnsubscribe = onSnapshot(
    query(
      collection(backend.store, "messages"),
      where("recipientUid", "==", uid),
      where("status", "==", "published"),
      orderBy("visibleAt", "desc"),
    ),
    (snapshot) => {
      try {
        void db.letters
          .bulkPut(snapshot.docs.map((d) => parseLetter(d.id, d.data())))
          .catch(onError);
      } catch (e) {
        onError(e as Error);
      }
    },
    onError,
  );
  const refresh = async () => {
    if (stopped || refreshing || !navigator.onLine) return;
    refreshing = true;
    try {
      if (
        !trustedAnchor ||
        performance.now() - trustedAnchor.performance > 300000
      )
        await syncServerClock(uid);
      if (stopped) return;
      const bound = trustedNow();
      if (bound === null) return;
      const q = query(
        collection(backend!.store, "messages"),
        where("recipientUid", "==", uid),
        where("status", "==", "scheduled"),
        where("visibleAt", "<=", Timestamp.fromMillis(bound)),
        orderBy("visibleAt", "desc"),
      );
      unsubscribe();
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const letters = snapshot.docs.map((d) => parseLetter(d.id, d.data()));
          void db.letters.bulkPut(letters).catch(onError);
        },
        onError,
      );
    } catch (e) {
      onError(e instanceof Error ? e : new Error("Không thể kết nối hộp thư."));
    } finally {
      refreshing = false;
    }
  };
  void refresh();
  receiptUnsubscribe = onSnapshot(
    collection(backend.store, "devices", uid, "receipts"),
    (snapshot) => {
      void (async () => {
        for (const d of snapshot.docs) {
          const local = await db.receipts.get(`${uid}:${d.id}`);
          const data = d.data();
          const remote: Receipt = {
            id: `${uid}:${d.id}`,
            recipientUid: uid,
            seenAt: readTime(data.seenAt) || undefined,
            readAt: readTime(data.readAt) || undefined,
            heartedAt: readTime(data.heartedAt) || undefined,
            favoritedAt: readTime(data.favoritedAt) || undefined,
            dismissedAt: readTime(data.dismissedAt) || undefined,
            updatedAt: readTime(data.updatedAt),
          };
          if (!local || (!local.pending && remote.updatedAt > local.updatedAt))
            await db.receipts.put(remote);
        }
      })().catch(onError);
    },
    onError,
  );
  const timer = setInterval(() => {
    void refresh();
    void syncPendingReceipts(uid).catch(onError);
  }, 60000);
  const online = () => {
    void refresh();
    void syncPendingReceipts(uid).catch(onError);
  };
  window.addEventListener("online", online);
  return () => {
    stopped = true;
    publishedUnsubscribe();
    unsubscribe();
    receiptUnsubscribe();
    clearInterval(timer);
    window.removeEventListener("online", online);
  };
}
export async function markReceipt(
  uid: string,
  id: string,
  field: "seenAt" | "readAt" | "heartedAt" | "favoritedAt" | "dismissedAt",
  clear = false,
) {
  const key = `${uid}:${id}`;
  await db.transaction("rw", db.receipts, async () => {
    const old = await db.receipts.get(key);
    await db.receipts.put({
      ...old,
      id: key,
      recipientUid: uid,
      [field]: clear ? undefined : (old?.[field] ?? Date.now()),
      updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1),
      pending: true,
    });
  });
  if (backend && navigator.onLine) {
    // UI never waits for network; unsynced receipts are retried on reconnect.
    void syncPendingReceipts(uid).catch(() => {});
  }
}
const receiptSyncs = new Map<string, Promise<void>>();
export function syncPendingReceipts(uid: string): Promise<void> {
  const active = receiptSyncs.get(uid);
  if (active) return active;
  if (!backend || !navigator.onLine) return Promise.resolve();
  const task = flushReceipts(uid).finally(() => receiptSyncs.delete(uid));
  receiptSyncs.set(uid, task);
  return task;
}
async function flushReceipts(uid: string) {
  if (!backend) return;
  for (;;) {
    const receipts = (
      await db.receipts.where("recipientUid").equals(uid).toArray()
    ).filter((r) => r.pending);
    if (!receipts.length) return;
    for (const r of receipts) {
      const id = r.id.slice(uid.length + 1);
      const ref = doc(backend.store, "devices", uid, "receipts", id);
      const snapshot = await getDocFromServer(ref);
      const remote = snapshot.data();
      const field = (
        name: "seenAt" | "readAt" | "heartedAt" | "favoritedAt" | "dismissedAt",
      ) => (r[name] ? (remote?.[name] ?? serverTimestamp()) : null);
      await setDoc(ref, {
        recipientUid: uid,
        messageId: id,
        seenAt: field("seenAt"),
        readAt: field("readAt"),
        heartedAt: field("heartedAt"),
        favoritedAt: field("favoritedAt"),
        dismissedAt: field("dismissedAt"),
        updatedAt: serverTimestamp(),
      });
      await db.transaction("rw", db.receipts, async () => {
        const current = await db.receipts.get(r.id);
        if (current?.updatedAt === r.updatedAt)
          await db.receipts.update(r.id, { pending: false });
      });
    }
  }
}
export async function writeMessage(
  input: MessageInput,
  publish: boolean,
  id?: string,
) {
  const m = publish ? validatePublish(input) : messageInputSchema.parse(input);
  const now = Date.now();
  const status = publish
    ? m.deliveryType === "scheduled"
      ? "scheduled"
      : "published"
    : "draft";
  const messageId = id ?? crypto.randomUUID();
  const visibleAt = m.deliveryType === "scheduled" ? m.scheduledAt! : now;
  if (!backend) {
    if (backendMode !== "demo")
      throw new Error("Cấu hình Firebase chưa đầy đủ.");
    const prior = await db.letters.get(messageId);
    await db.letters.put({
      id: messageId,
      ...m,
      status,
      visibleAt,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    });
    return messageId;
  }
  const ref = doc(backend.adminStore, "messages", messageId);
  const old = await getDocFromServer(ref);
  await setDoc(ref, {
    ...m,
    scheduledAt:
      m.deliveryType === "scheduled"
        ? Timestamp.fromMillis(m.scheduledAt!)
        : null,
    status,
    visibleAt:
      m.deliveryType === "scheduled"
        ? Timestamp.fromMillis(m.scheduledAt!)
        : serverTimestamp(),
    publishedAt: publish ? serverTimestamp() : null,
    createdAt: old.exists() ? old.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return messageId;
}
export function subscribeAdminMessages(
  onData: (letters: CachedLetter[]) => void,
  onError: (e: Error) => void,
) {
  if (!backend) return () => {};
  return onSnapshot(
    query(
      collection(backend.adminStore, "messages"),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      try {
        onData(snapshot.docs.map((d) => parseLetter(d.id, d.data())));
      } catch (e) {
        onError(e as Error);
      }
    },
    onError,
  );
}
export async function archiveMessage(id: string) {
  if (!backend) {
    await db.letters.update(id, { status: "archived", updatedAt: Date.now() });
    return;
  }
  await setDoc(
    doc(backend.adminStore, "messages", id),
    { status: "archived", updatedAt: serverTimestamp() },
    { merge: true },
  );
}
export async function adminAllowed(uid: string, store: Firestore) {
  const docSnap = await getDocFromServer(doc(store, "config", "admins"));
  return (
    docSnap.exists() &&
    Array.isArray(docSnap.data().uids) &&
    docSnap.data().uids.includes(uid)
  );
}
