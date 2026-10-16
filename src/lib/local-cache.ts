import Dexie from "dexie";
import {
  db,
  getAccountDatabase,
  getLearningDatabase,
  type AccountDatabase,
} from "./db";
import { learningKinds } from "./account-sync";
import { packLibrary, unpackLibrary } from "./cloud-content";
export const MAX_OFFLINE_LIBRARY_BYTES = 512 * 1024;
export function offlineLibrarySnapshot(raw: unknown) {
  const { music: _music, ...library } = unpackLibrary(raw);
  const compact = packLibrary(library);
  return new TextEncoder().encode(compact).length <= MAX_OFFLINE_LIBRARY_BYTES
    ? compact
    : null;
}
export async function compactAccountCache(
  database: AccountDatabase,
  inactiveOnly = false,
) {
  if (database === db || !(await database.meta.get("cloudHydrated"))) return 0;
  return database.transaction("rw", database.tables, async () => {
    if (inactiveOnly && database === getLearningDatabase()) return 0;
    const pending = await database.syncQueue.toArray();
    let removed = 0;
    for (const kind of learningKinds) {
      const keep = new Set(
        pending.filter((q) => q.kind === kind).map((q) => q.value.id),
      );
      removed += await database
        .table(kind)
        .filter((row) => !keep.has(row.id))
        .delete();
    }
    // Drafts, all outbox entries and migration metadata are deliberately retained.
    return removed;
  });
}
let cleanup: Promise<number> | null = null;
export function compactInactiveAccountCaches(): Promise<number> {
  if (cleanup) return cleanup;
  cleanup = cleanInactiveAccounts().finally(() => {
    cleanup = null;
  });
  return cleanup;
}
async function cleanInactiveAccounts() {
  let removed = 0;
  for (const name of await Dexie.getDatabaseNames()) {
    if (!name.startsWith("hanzigo-account-")) continue;
    const database = getAccountDatabase(name.slice("hanzigo-account-".length));
    if (database === getLearningDatabase()) continue;
    removed += await compactAccountCache(database, true);
    if (database !== getLearningDatabase())
      database.close({ disableAutoOpen: false });
  }
  return removed;
}
