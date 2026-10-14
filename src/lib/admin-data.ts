import { useEffect, useState } from "react";
import { db, getAccountDatabase, putAccountRecord } from "./db";
import { backend } from "./firebase";
import { useAuth } from "./Auth";
import { startAccountSync, type DataSyncStatus } from "./account-sync";
export function useAdminData() {
  const { adminUser } = useAuth();
  const uid = adminUser?.uid;
  const database = uid ? getAccountDatabase(uid) : db;
  const [status, setStatus] = useState<DataSyncStatus>("local");
  useEffect(() => {
    if (!backend || !uid) return;
    let active = true;
    let stop = () => {};
    void (async () => {
      const claim = await db.meta.get("draftMigration");
      if (!claim) {
        // Preserve pre-cloud drafts once, with the first authenticated editor.
        const drafts = await db.contentDrafts.toArray();
        const legacyRecipient = localStorage
          .getItem("hanzigo-recipient")
          ?.trim();
        await database.transaction(
          "rw",
          database.drafts,
          database.preferences,
          database.syncQueue,
          async () => {
            for (const draft of drafts)
              if (!(await database.drafts.get(draft.id)))
                await putAccountRecord(database, "drafts", draft);
            if (
              legacyRecipient &&
              !(await database.preferences.get("recipientUid"))
            ) {
              await putAccountRecord(database, "preferences", {
                id: "recipientUid",
                value: legacyRecipient,
                updatedAt: Date.now(),
              });
              await database.syncQueue.update("preferences:recipientUid", {
                initializeOnly: true,
              });
            }
          },
        );
        await db.meta.put({ id: "draftMigration", value: uid });
      }
      if (active)
        stop = startAccountSync(backend.adminStore, uid, database, setStatus, [
          "drafts",
          "preferences",
        ]).stop;
    })().catch(() => {
      if (active) setStatus("error");
    });
    return () => {
      active = false;
      stop();
    };
  }, [uid, database]);
  return { uid, database, status };
}
