import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { AudioButton } from "./Common";
import { reportError } from "@/lib/store";
export function Recorder({
  text,
  pinyin,
  vi,
}: {
  text: string;
  pinyin: string;
  vi: string;
}) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const objectUrl = useRef<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);
  const start = async () => {
    setPending(true);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Trình duyệt chưa hỗ trợ ghi âm. Hãy dùng HTTPS hoặc localhost trên trình duyệt có micro.",
        );
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const r = new MediaRecorder(s);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        s.getTracks().forEach((t) => t.stop());
        if (mounted.current) {
          setRecording(false);
          reportError(new Error("Không thể thu âm. Em kiểm tra micro nhé."));
        }
      };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        if (timeout.current) clearTimeout(timeout.current);
        if (!mounted.current) return;
        setRecording(false);
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        const next = URL.createObjectURL(
          new Blob(chunks, { type: r.mimeType }),
        );
        objectUrl.current = next;
        setUrl(next);
      };
      r.start();
      setRecording(true);
      timeout.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 60000);
    } catch (e) {
      reportError(
        new Error(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Em chưa cho phép micro. Có thể bật quyền trong trình duyệt, hoặc chỉ nghe mẫu."
            : e instanceof Error
              ? e.message
              : "Không thể mở micro.",
        ),
      );
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  return (
    <section className="card recorder">
      <div className="section-heading">
        <h2>Đọc một câu, nghe giọng mình</h2>
        <Mic size={20} />
      </div>
      <p lang="zh-CN" className="recording-sentence">
        {text}
      </p>
      <p className="pinyin">{pinyin}</p>
      <p className="muted">{vi}</p>
      <div className="button-row">
        <AudioButton text={text} label="Nghe mẫu" />
        <Button
          disabled={pending}
          variant={recording ? "destructive" : "secondary"}
          onClick={() => {
            if (recording && recorder.current?.state === "recording")
              recorder.current.stop();
            else void start();
          }}
        >
          {recording ? <Square size={17} /> : <Mic size={17} />}{" "}
          {recording
            ? "Dừng thu âm"
            : pending
              ? "Đang mở micro…"
              : "Thu giọng của em"}
        </Button>
      </div>
      {recording && (
        <p role="status" className="recording-status">
          ● Đang ghi âm · tối đa 60 giây
        </p>
      )}
      {url && (
        <div className="recording-player">
          <audio controls src={url} aria-label="Nghe lại giọng của em" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Xóa bản ghi"
            onClick={() => {
              URL.revokeObjectURL(url);
              objectUrl.current = null;
              setUrl(null);
            }}
          >
            <Trash2 size={17} />
          </Button>
        </div>
      )}
      <p className="content-note">
        Bản ghi chỉ ở thiết bị này, mất khi rời trang. Em nghe và tự đối chiếu;
        không chấm điểm hay tải lên.
      </p>
    </section>
  );
}
