import { useEffect, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { applyLibrary, useLibraryState } from "@/content";
import { backend } from "@/lib/firebase";
import { db } from "@/lib/db";
import { unpackLibrary } from "@/lib/cloud-content";
import { offlineLibrarySnapshot } from "@/lib/local-cache";
export function ContentProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let active = true;
    let remoteSeen = false;
    void db.libraryCache
      .get("published")
      .then((cached) => {
        if (cached && active && !remoteSeen) {
          const raw = offlineLibrarySnapshot(cached.raw);
          if (raw) {
            applyLibrary(unpackLibrary(raw), "cache");
            if (raw !== cached.raw)
              void db.libraryCache
                .put({ id: "published", raw })
                .catch(() => {});
          } else void db.libraryCache.delete("published").catch(() => {});
        }
      })
      .catch(() => {});
    if (!backend) {
      useLibraryState.setState({ status: "ready" });
      return () => {
        active = false;
      };
    }
    const stop = onSnapshot(
      doc(backend.store, "content", "library"),
      (snapshot) => {
        if (!active) return;
        remoteSeen = true;
        if (!snapshot.exists()) {
          useLibraryState.setState({ status: "empty" });
          return;
        }
        try {
          const raw = snapshot.data().raw;
          applyLibrary(unpackLibrary(raw), "firebase");
          const compact = offlineLibrarySnapshot(raw);
          if (compact)
            void db.libraryCache
              .put({ id: "published", raw: compact })
              .catch(() => {});
          else void db.libraryCache.delete("published").catch(() => {});
        } catch {
          useLibraryState.setState({ status: "error" });
        }
      },
      () => {
        if (active) useLibraryState.setState({ status: "error" });
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, []);
  return children;
}
