import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Heart, Bookmark, Mail, Clock3 } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  db,
  claimLetterPopup,
  type CachedLetter,
  type Receipt,
} from "@/lib/db";
import { useAuth } from "@/lib/Auth";
import { useLearning, useNow } from "@/lib/hooks";
import { messageEligible, milestoneLabels } from "@/lib/messages";
import {
  markReceipt,
  syncPendingReceipts,
  backend,
  backendMode,
} from "@/lib/firebase";
import { usePreferences, reportError, run } from "@/lib/store";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { EnvelopeArt } from "./Art";
interface LettersContext {
  letters: CachedLetter[];
  receipts: Receipt[];
  unread: number;
  openLetter: (letter: CachedLetter) => void;
  uid: string | null;
}
const Context = createContext<LettersContext | null>(null);
export const useLetters = () => {
  const c = useContext(Context);
  if (!c) throw new Error("LettersProvider required");
  return c;
};
export function LetterBody({
  letter,
}: {
  letter: Pick<
    CachedLetter,
    "title" | "zhText" | "pinyin" | "viText" | "theme"
  >;
}) {
  return (
    <div className={`letter-body theme-${letter.theme}`}>
      <div className="letter-flower">✿</div>
      <h2>{letter.title}</h2>
      {letter.zhText && (
        <p className="letter-zh" lang="zh-CN">
          {letter.zhText}
        </p>
      )}
      {letter.pinyin && <p className="pinyin">{letter.pinyin}</p>}
      <p className="letter-text">{letter.viText}</p>
      <p className="letter-signature">Gửi em, với tất cả dịu dàng ♡</p>
    </div>
  );
}
export function LettersProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const { storiesRead, streak, reviews } = useLearning();
  const now = useNow();
  const path = useLocation().pathname;
  const auto = usePreferences((s) => s.autoLetters);
  const [enabled, setEnabled] = useState(true);
  const [current, setCurrent] = useState<CachedLetter | null>(null);
  const opening = useRef(false);
  const latest = useRef({ path, uid });
  latest.current = { path, uid };
  const cached = useLiveQuery(
    () => (uid ? db.letters.where("recipientUid").equals(uid).toArray() : []),
    [uid],
    [],
  );
  const receipts = useLiveQuery(
    () => (uid ? db.receipts.where("recipientUid").equals(uid).toArray() : []),
    [uid],
    [],
  );
  const letters = cached
    .filter((m) =>
      messageEligible(
        m,
        uid ?? "",
        backendMode === "cloud"
          ? Number.MAX_SAFE_INTEGER
          : Math.max(now, Date.now()),
        { stories: storiesRead, streak, reviews },
      ),
    )
    .sort((a, b) => b.visibleAt - a.visibleAt);
  const unread = letters.filter(
    (m) => !receipts.find((r) => r.id === `${uid}:${m.id}`)?.readAt,
  ).length;
  useEffect(() => {
    if (!backend || !uid) return;
    return onSnapshot(
      doc(backend.store, "config", "settings"),
      (s) => setEnabled(s.data()?.popupsEnabled !== false),
      () => setEnabled(true),
    );
  }, [uid]);
  const openLetter = (letter: CachedLetter) => {
    if (!uid) return;
    run(async () => {
      await markReceipt(uid, letter.id, "seenAt");
      await markReceipt(uid, letter.id, "readAt");
      setCurrent(letter);
    });
  };
  useEffect(() => {
    if (
      !uid ||
      current ||
      opening.current ||
      !auto ||
      !enabled ||
      path.startsWith("/admin") ||
      path.startsWith("/review") ||
      path.startsWith("/games") ||
      /^\/stories\//.test(path)
    )
      return;
    const next = letters.find(
      (m) => !receipts.find((r) => r.id === `${uid}:${m.id}`)?.seenAt,
    );
    if (!next) return;
    opening.current = true;
    void claimLetterPopup(uid, next.id)
      .then((claimed) => {
        const context = latest.current;
        const busy = /^\/(admin|review|games)(\/|$)|^\/stories\//.test(
          context.path,
        );
        if (claimed && context.uid === uid && !busy) setCurrent(next);
        void syncPendingReceipts(uid).catch(() => {});
      })
      .catch(reportError)
      .finally(() => {
        opening.current = false;
      });
  }, [uid, letters, receipts, current, path, auto, enabled]);
  const currentReceipt = receipts.find((r) => r.id === `${uid}:${current?.id}`);
  return (
    <Context.Provider value={{ letters, receipts, unread, openLetter, uid }}>
      {children}
      <Dialog
        open={!!current}
        onOpenChange={(open) => {
          if (!open && current && uid) {
            run(() => markReceipt(uid, current.id, "dismissedAt"));
            setCurrent(null);
          }
        }}
      >
        <DialogContent
          className={`love-dialog theme-${current?.theme ?? "rose"}`}
        >
          {current && (
            <>
              <DialogTitle className="sr-only">{current.title}</DialogTitle>
              <DialogDescription className="letter-label">
                MỘT LỜI NHẮN DÀNH CHO EM
              </DialogDescription>
              <LetterBody letter={current} />
              {current.deliveryType === "milestone" && (
                <p className="content-note">
                  Mốc {current.milestoneCount}{" "}
                  {milestoneLabels[current.milestoneKind]} · Hiệu ứng học tập;
                  nội dung không khóa bảo mật theo tiến độ.
                </p>
              )}
              <div className="letter-actions">
                <Button
                  variant="secondary"
                  aria-pressed={!!currentReceipt?.heartedAt}
                  onClick={() =>
                    run(() =>
                      markReceipt(
                        uid!,
                        current.id,
                        "heartedAt",
                        !!currentReceipt?.heartedAt,
                      ),
                    )
                  }
                >
                  <Heart
                    size={17}
                    fill={currentReceipt?.heartedAt ? "currentColor" : "none"}
                  />
                  Thả tim
                </Button>
                <Button
                  variant="ghost"
                  aria-pressed={!!currentReceipt?.favoritedAt}
                  onClick={() =>
                    run(() =>
                      markReceipt(
                        uid!,
                        current.id,
                        "favoritedAt",
                        !!currentReceipt?.favoritedAt,
                      ),
                    )
                  }
                >
                  <Bookmark
                    size={17}
                    fill={currentReceipt?.favoritedAt ? "currentColor" : "none"}
                  />
                  Yêu thích
                </Button>
              </div>
              <div className="letter-footer-actions">
                <Button
                  variant="ghost"
                  onClick={() => {
                    run(() => markReceipt(uid!, current.id, "dismissedAt"));
                    setCurrent(null);
                  }}
                >
                  <Clock3 size={15} />
                  Xem sau
                </Button>
                <Button
                  onClick={() =>
                    run(async () => {
                      await markReceipt(uid!, current.id, "readAt");
                      setCurrent(null);
                    })
                  }
                >
                  <Mail size={16} />
                  Cất vào hộp thư
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
