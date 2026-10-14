import { liveQuery } from "dexie";
import {
  defaultPreferences,
  preferenceKeys,
  preferenceSchema,
} from "./account-data";
import { reportError, usePreferences } from "./store";
import { db, putAccountRecord, type AccountDatabase } from "./db";
export async function loadAccountPreferences(
  database: AccountDatabase,
  isCurrent = () => true,
) {
  const rows = await database.preferences.toArray();
  const next: Record<string, unknown> = { ...defaultPreferences };
  for (const row of rows)
    if (preferenceKeys.includes(row.id as (typeof preferenceKeys)[number]))
      next[row.id] = preferenceSchema.parse(row).value;
  if (isCurrent()) usePreferences.setState(next);
}
export function watchAccountPreferences(database: AccountDatabase) {
  let stopped = false;
  let applying = false;
  const apply = liveQuery(() => database.preferences.toArray()).subscribe({
    next: (rows) => {
      if (stopped) return;
      const next: Record<string, unknown> = {};
      for (const row of rows)
        if (preferenceKeys.includes(row.id as (typeof preferenceKeys)[number]))
          next[row.id] = preferenceSchema.parse(row).value;
      applying = true;
      usePreferences.setState(next);
      applying = false;
    },
  });
  const changes = usePreferences.subscribe((current, previous) => {
    if (stopped || applying) return;
    const changed = preferenceKeys.filter(
      (key) => JSON.stringify(current[key]) !== JSON.stringify(previous[key]),
    );
    if (!changed.length) return;
    void database.transaction(
      "rw",
      database.preferences,
      database.syncQueue,
      async () => {
        for (const id of changed)
          await putAccountRecord(database, "preferences", {
            id,
            value: current[id],
            updatedAt: Date.now(),
          });
      },
    );
  });
  return () => {
    stopped = true;
    changes();
    apply.unsubscribe();
  };
}
export async function saveGuestPreferences() {
  const current = usePreferences.getState();
  await db.transaction("rw", db.preferences, async () => {
    for (const id of preferenceKeys)
      await db.preferences.put({
        id,
        value: current[id],
        updatedAt: Date.now(),
      });
  });
}
