import { useState } from "react";
import { Heart, Mail, Bookmark, ArrowUpRight } from "lucide-react";
import { PageHeading, Badge, Empty } from "@/components/Common";
import { EnvelopeArt } from "@/components/Art";
import { Button } from "@/components/ui/button";
import { useLetters } from "@/components/Letters";
import { backendMode } from "@/lib/firebase";
export default function Inbox() {
  const { letters, receipts, unread, openLetter, uid } = useLetters();
  const [filter, setFilter] = useState("all");
  const filtered = letters.filter((m) => {
    const r = receipts.find((r) => r.id === `${uid}:${m.id}`);
    return (
      filter === "all" ||
      (filter === "unread" && !r?.readAt) ||
      (filter === "read" && !!r?.readAt) ||
      (filter === "favorite" && !!r?.favoritedAt)
    );
  });
  return (
    <>
      <PageHeading
        eyebrow="GÓI GHÉM DỊU DÀNG"
        title="Hộp thư yêu thương"
        description="Có những điều anh muốn nói, vào đúng lúc em cần nghe."
        action={<Badge className="badge-rose">{unread} thư chưa đọc</Badge>}
      />
      <div className="tabs">
        {[
          ["all", "Tất cả"],
          ["unread", "Chưa đọc"],
          ["read", "Đã đọc"],
          ["favorite", "Yêu thích"],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant={filter === id ? "secondary" : "ghost"}
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {filtered.length ? (
        <div className="letter-grid">
          {filtered.map((m) => {
            const r = receipts.find((r) => r.id === `${uid}:${m.id}`);
            return (
              <button
                key={m.id}
                className={`card inbox-letter theme-${m.theme}`}
                onClick={() => openLetter(m)}
              >
                <div className="inbox-letter-icon">
                  <Mail size={25} />
                  {!r?.readAt && <span className="unread-dot" />}
                </div>
                <h2>{m.title}</h2>
                <p>
                  {m.viText.slice(0, 100)}
                  {m.viText.length > 100 ? "…" : ""}
                </p>
                <div className="inbox-letter-meta">
                  <span>
                    {new Date(m.visibleAt).toLocaleDateString("vi-VN")}
                  </span>
                  {r?.heartedAt && <Heart size={16} fill="currentColor" />}
                  {r?.favoritedAt && <Bookmark size={16} fill="currentColor" />}
                  <ArrowUpRight size={18} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={
            <div className="empty-envelope">
              <EnvelopeArt />
            </div>
          }
          title={
            filter === "all"
              ? "Một khoảng trống dành cho lời yêu thương"
              : "Chưa có thư ở ngăn này"
          }
        >
          <p>
            {filter === "all"
              ? "Khi một lời nhắn đến, em sẽ thấy nó ở đây. Cứ đọc và học theo nhịp của em nhé."
              : "Những lá thư phù hợp sẽ được cất ở đây."}
          </p>
        </Empty>
      )}
      {backendMode === "demo" && (
        <p className="content-note">
          Hộp thư đang ở chế độ demo trên thiết bị này. Có thể thử soạn thư
          trong Quản trị; kết nối Firebase để gửi giữa hai thiết bị.
        </p>
      )}
      <p className="content-note">
        Thư đã nhận được lưu offline trên thiết bị. Thư mới cần mạng và app đang
        mở.
      </p>
    </>
  );
}
