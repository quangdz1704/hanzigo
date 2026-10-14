import type { Vocabulary } from "@/content/schema";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { AudioButton } from "./Common";
import { Button } from "./ui/button";
import { BookmarkPlus, Check } from "lucide-react";
import { saveVocabulary } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { getLearningDatabase } from "@/lib/db";
import { reportError, useUI } from "@/lib/store";
export function VocabularySheet({
  word,
  onClose,
  preview = false,
}: {
  word: Vocabulary | null;
  onClose: () => void;
  preview?: boolean;
}) {
  const card = useLiveQuery(
    () => (word ? getLearningDatabase().cards.get(word.id) : undefined),
    [word?.id],
  );
  return (
    <Dialog
      open={!!word}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="word-sheet">
        {word && (
          <>
            <p className="eyebrow">MỘT TỪ MỚI CHO EM</p>
            <DialogTitle className="word-title" lang="zh-CN">
              {word.hanzi}
            </DialogTitle>
            <DialogDescription className="pinyin">
              {word.pinyin}
            </DialogDescription>
            <p className="word-meaning">{word.meaning}</p>
            <div className="word-example">
              <p lang="zh-CN">{word.example}</p>
              <p className="pinyin">{word.examplePinyin}</p>
              <p className="muted">{word.exampleVi}</p>
            </div>
            <div className="button-row">
              <AudioButton text={word.hanzi} url={word.audioUrl} />
              {!preview && (
                <Button
                  disabled={!!card}
                  onClick={() => {
                    void saveVocabulary(word.id)
                      .then(() =>
                        useUI.getState().notify("Đã thêm từ vào vườn từ vựng."),
                      )
                      .catch(reportError);
                  }}
                >
                  {card ? <Check size={17} /> : <BookmarkPlus size={17} />}{" "}
                  {card ? "Đã lưu từ" : "Lưu để ôn"}
                </Button>
              )}
              {preview && (
                <span className="muted">Xem trước · không lưu từ</span>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
