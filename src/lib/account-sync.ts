import { liveQuery } from "dexie";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  mergeAccountRecord,
  parseAccountRecord,
  type AccountKind,
  type AccountRecord,
} from "./account-data";
import type { AccountDatabase } from "./db";
export type DataSyncStatus =
  "local" | "loading" | "saving" | "synced" | "error";
export const learningKinds: AccountKind[] = [
  "cards",
  "progress",
  "activities",
  "reviews",
  "favorites",
  "preferences",
];
export function accountRecordRef(
  store: Firestore,
  uid: string,
  kind: AccountKind,
  id: string,
) {
  return doc(store, "users", uid, kind, encodeURIComponent(id));
}
export async function pushAccountRecord(
  store: Firestore,
  uid: string,
  kind: AccountKind,
  incoming: AccountRecord,
  initializeOnly = false,
) {
  const value = parseAccountRecord(kind, incoming);
  return runTransaction(store, async (transaction) => {
    const ref = accountRecordRef(store, uid, kind, value.id);
    const snapshot = await transaction.get(ref);
    const prior = snapshot.exists()
      ? parseAccountRecord(kind, snapshot.data().value)
      : undefined;
    const merged =
      initializeOnly && prior ? prior : mergeAccountRecord(kind, prior, value);
    transaction.set(ref, { value: merged, updatedAt: serverTimestamp() });
    return merged;
  });
}
export function startAccountSync(
  store: Firestore,
  uid: string,
  database: AccountDatabase,
  status: (status: DataSyncStatus) => void,
  kinds = learningKinds,
) {
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failedWatch = false;
  const hydrated = new Set<AccountKind>();
  let watchers: (() => void)[] = [];
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 600);
  };
  const report = (value: DataSyncStatus) => {
    if (!stopped) status(value);
  };
  const attach = () => {
    watchers.forEach((stop) => stop());
    watchers = [];
    failedWatch = false;
    hydrated.clear();
    for (const kind of kinds)
      watchers.push(
        onSnapshot(
          collection(store, "users", uid, kind),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (stopped) return;
            void database
              .transaction("rw", database.table(kind), async () => {
                for (const change of snapshot.docChanges()) {
                  if (change.type === "removed") continue; // Sync never deletes records; favorites use an explicit inactive value.
                  const value = parseAccountRecord(
                    kind,
                    change.doc.data().value,
                  );
                  const old = await database.table(kind).get(value.id);
                  const merged = mergeAccountRecord(kind, old, value);
                  if (JSON.stringify(old) !== JSON.stringify(merged))
                    await database.table(kind).put(merged);
                }
              })
              .then(async () => {
                if (stopped) return;
                if (!snapshot.metadata.fromCache) hydrated.add(kind);
                const pending = (await database.syncQueue.toArray()).some(
                  (item) => kinds.includes(item.kind),
                );
                if (pending) {
                  report("saving");
                  schedule();
                } else if (hydrated.size === kinds.length) report("synced");
              })
              .catch(() => report("error"));
          },
          () => {
            failedWatch = true;
            report("error");
          },
        ),
      );
  };
  const flush = async () => {
    if (stopped || busy) return;
    if (failedWatch) attach();
    busy = true;
    try {
      for (;;) {
        const pending = (await database.syncQueue.toArray()).filter((item) =>
          kinds.includes(item.kind),
        );
        if (!pending.length || stopped) break;
        report("saving");
        for (const queued of pending) {
          if (stopped) break;
          const merged = await pushAccountRecord(
            store,
            uid,
            queued.kind,
            queued.value,
            queued.initializeOnly,
          );
          if (stopped) break;
          await database.transaction(
            "rw",
            database.table(queued.kind),
            database.syncQueue,
            async () => {
              const current = await database.table(queued.kind).get(merged.id);
              const acknowledged =
                (await database.syncQueue.get(queued.id))?.revision ===
                queued.revision;
              await database
                .table(queued.kind)
                .put(
                  queued.initializeOnly && acknowledged
                    ? merged
                    : mergeAccountRecord(
                        queued.kind,
                        merged,
                        current ?? merged,
                      ),
                );
              if (acknowledged) await database.syncQueue.delete(queued.id);
            },
          );
        }
      }
      if (hydrated.size === kinds.length) report("synced");
    } catch {
      report("error");
    } finally {
      busy = false;
    }
  };
  report("loading");
  attach();
  const queue = liveQuery(() => database.syncQueue.toArray()).subscribe({
    next: (items) => {
      if (!stopped && items.some((item) => kinds.includes(item.kind))) {
        report("saving");
        schedule();
      }
    },
    error: () => report("error"),
  });
  const retry = () => void flush();
  const interval = setInterval(retry, 60000);
  if (typeof window !== "undefined") window.addEventListener("online", retry);
  void flush();
  return {
    retry,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      watchers.forEach((stop) => stop());
      queue.unsubscribe();
      if (typeof window !== "undefined")
        window.removeEventListener("online", retry);
    },
  };
}
