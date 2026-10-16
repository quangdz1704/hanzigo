import { useLibraryRevision } from "@/content";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download,
  Upload,
  ShieldCheck,
  Copy,
  Smartphone,
  Heart,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePreferences, useUI, reportError } from "@/lib/store";
import { useAuth } from "@/lib/Auth";
import { compactInactiveAccountCaches } from "@/lib/local-cache";
import { backendMode } from "@/lib/firebase";
import {
  db,
  exportLearning,
  importLearning,
  getLearningDatabase,
} from "@/lib/db";
import { PageHeading, AudioButton } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { useLearning } from "@/lib/hooks";
import { quotes } from "@/content";
export default function Settings() {
  useLibraryRevision();
  const prefs = usePreferences();
  const {
    uid,
    learnerError,
    learnerAccount,
    profileStatus,
    retryProfile,
    dataSyncStatus,
    retryDataSync,
    learningScope,
  } = useAuth();
  const database = getLearningDatabase();
  const deviceStorage = useLiveQuery(
    async () => ({
      storyBytes: new TextEncoder().encode(
        (await db.libraryCache.get("published"))?.raw ?? "",
      ).length,
      pending: await database.syncQueue.count(),
    }),
    [learningScope],
    { storyBytes: 0, pending: 0 },
  );
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { favorites } = useLearning();
  const savedQuotes = quotes.filter((q) =>
    favorites.some((f) => f.id === `quote:${q.id}` && f.active),
  );
  return (
    <>
      <PageHeading
        eyebrow="THEO NHỊP CỦA EM"
        title="Một vài tùy chọn"
        description="Để khu vườn này dễ chịu hơn với em."
      />
      <div className="settings-grid">
        <section className="card settings-section">
          <h2>Khi em đọc</h2>
          <label className="field">
            Mình gọi em là
            <input
              maxLength={40}
              value={prefs.name}
              onChange={(e) => prefs.set({ name: e.target.value })}
              placeholder="em"
            />
          </label>
          <p className="content-note" role="status">
            {profileStatus === "local"
              ? "Tên gọi được lưu trên trình duyệt này. Đăng nhập để giữ tên khi đổi thiết bị."
              : profileStatus === "synced"
                ? "Tên gọi đã đồng bộ theo tài khoản."
                : profileStatus === "error"
                  ? "Tên gọi đang lưu trên máy này, chưa đồng bộ được. App sẽ thử lại khi có mạng."
                  : profileStatus === "saving"
                    ? "Đang lưu tên gọi vào tài khoản…"
                    : "Đang lấy tên gọi của tài khoản…"}
          </p>
          {profileStatus === "error" && (
            <Button variant="outline" onClick={retryProfile}>
              Thử đồng bộ lại
            </Button>
          )}
          <Toggle
            label="Hiện Pinyin"
            description="Pinyin có dấu dưới mỗi câu"
            checked={prefs.pinyin}
            onChange={(pinyin) => prefs.set({ pinyin })}
          />
          <Toggle
            label="Hiện bản dịch"
            description="Dịch tiếng Việt trong trình đọc"
            checked={prefs.translation}
            onChange={(translation) => prefs.set({ translation })}
          />
          <Toggle
            label="Âm thanh"
            description="Bật nút nghe và giọng đọc mẫu"
            checked={prefs.sound}
            onChange={(sound) => prefs.set({ sound })}
          />
          <label className="field">
            Cỡ chữ Hán · {prefs.fontSize}px
            <input
              type="range"
              min={20}
              max={36}
              step={2}
              value={prefs.fontSize}
              onChange={(e) => prefs.set({ fontSize: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Giao diện
            <select
              value={prefs.theme}
              onChange={(e) =>
                prefs.set({ theme: e.target.value as typeof prefs.theme })
              }
            >
              <option value="light">Ban ngày dịu dàng</option>
              <option value="dark">Buổi tối êm đềm</option>
              <option value="system">Theo thiết bị</option>
            </select>
          </label>
          <Toggle
            label="Mở lời nhắn mới"
            description="Chỉ mở một lần, khi em không đang đọc hoặc chơi"
            checked={prefs.autoLetters}
            onChange={(autoLetters) => prefs.set({ autoLetters })}
          />
        </section>
        <div>
          <section className="card settings-section">
            <h2>
              <UserRound size={20} />
              Tài khoản của em
            </h2>
            {learnerAccount && !learnerAccount.isAnonymous ? (
              <>
                <p className="account-email">{learnerAccount.email}</p>
                <p className="muted">
                  {learnerAccount.emailVerified
                    ? "Email đã được xác minh."
                    : "Em có thể xác minh email trong trang tài khoản."}
                </p>
                <Button asChild variant="secondary">
                  <Link to="/account">Quản lý tài khoản</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="muted">
                  Gắn email vào tài khoản đang dùng để giữ mã nhận thư khi đổi
                  thiết bị.
                </p>
                <div className="button-row">
                  <Button asChild>
                    <Link to="/register">Đăng ký</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/login">Đăng nhập</Link>
                  </Button>
                </div>
              </>
            )}
            <p className="content-note">
              {learnerAccount && !learnerAccount.isAnonymous
                ? "Tiến độ, từ đã lưu, yêu thích và tùy chọn đi theo tài khoản. Bản trên máy giúp em tiếp tục học offline."
                : "Khách lưu tiến độ trên máy. Đăng ký để giữ dữ liệu học theo tài khoản."}
            </p>
            {learnerAccount && !learnerAccount.isAnonymous && (
              <>
                <p role="status">
                  {dataSyncStatus === "synced"
                    ? "Dữ liệu học đã đồng bộ Firebase."
                    : dataSyncStatus === "error"
                      ? "Chưa đồng bộ được. Thay đổi vẫn giữ trên máy và sẽ gửi lại khi kết nối được."
                      : dataSyncStatus === "saving"
                        ? "Đang đồng bộ thay đổi…"
                        : "Đang tải dữ liệu của tài khoản…"}
                </p>
                {dataSyncStatus === "error" && (
                  <Button variant="outline" onClick={retryDataSync}>
                    Thử đồng bộ dữ liệu
                  </Button>
                )}
              </>
            )}
          </section>
          <section className="card settings-section">
            <h2>Dữ liệu trên thiết bị</h2>
            <p>
              Cache truyện: {Math.ceil(deviceStorage.storyBytes / 1024)} KB /
              512 KB. Thay đổi chờ đồng bộ: {deviceStorage.pending}.
            </p>
            <p className="muted">
              Nhạc tải từ thư viện trực tuyến khi em mở Góc nghe nhạc. App không
              lưu file nhạc hay video trên thiết bị.
            </p>
            <p className="content-note">
              Cache truyện tối đa 512 KB. Cache dữ liệu học của tài khoản đã
              đăng xuất sẽ được dọn sau khi đồng bộ; thay đổi chưa gửi và bản
              nháp vẫn được giữ.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void compactInactiveAccountCaches()
                  .then((removed) =>
                    useUI
                      .getState()
                      .notify(
                        `Đã dọn ${removed} bản ghi cache có thể tải lại từ tài khoản.`,
                      ),
                  )
                  .catch(reportError);
              }}
            >
              Dọn cache tài khoản đã đăng xuất
            </Button>
          </section>
          <section className="card settings-section">
            <h2>Giữ những gì em đã học</h2>
            <p className="muted">
              Em có thể xuất bản sao riêng hoặc nhập để hợp nhất tiến độ. Khi
              đăng nhập, dữ liệu nhập cũng đồng bộ vào tài khoản.
            </p>
            <div className="button-row">
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => {
                  setBusy(true);
                  void exportLearning()
                    .then((data) => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(data, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `hanzigo-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      useUI.getState().notify("Đã xuất bản sao tiến độ học.");
                    })
                    .catch(reportError)
                    .finally(() => setBusy(false));
                }}
              >
                <Download size={17} />
                Xuất dữ liệu
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => file.current?.click()}
              >
                <Upload size={17} />
                Nhập bản sao
              </Button>
            </div>
            <input
              ref={file}
              className="sr-only"
              aria-label="Nhập bản sao tiến độ"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                e.target.value = "";
                if (f.size > 10_000_000) {
                  reportError(new Error("Bản sao quá lớn (tối đa 10 MB)."));
                  return;
                }
                setBusy(true);
                const ownerDatabase = getLearningDatabase();
                void f
                  .text()
                  .then((text) =>
                    importLearning(JSON.parse(text), ownerDatabase),
                  )
                  .then(() =>
                    useUI
                      .getState()
                      .notify(
                        "Đã hợp nhất tiến độ. Những mục trùng không được tính hai lần.",
                      ),
                  )
                  .catch(() =>
                    reportError(
                      new Error(
                        "Bản sao không đúng định dạng HanziGo hoặc có dữ liệu không hợp lệ.",
                      ),
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            />
            <p className="content-note">
              Bản sao chỉ chứa tiến độ học và yêu thích, không chứa thư riêng,
              danh tính Firebase hay bản ghi âm.
            </p>
          </section>
          <section className="card settings-section">
            <h2>
              <Smartphone size={20} />
              Danh tính nhận thư
            </h2>
            {backendMode === "cloud" && (
              <p className="muted">
                Firebase · {import.meta.env.VITE_FIREBASE_PROJECT_ID}
              </p>
            )}
            {learnerError && (
              <p role="alert" className="form-error">
                {learnerError}
              </p>
            )}
            {learnerError && (
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Thử lại kết nối
              </Button>
            )}
            <p className="muted">
              Gửi mã này cho anh để chọn đúng người nhận khi soạn thư. Khi đăng
              nhập, mã đi theo tài khoản trên các thiết bị.
            </p>
            <code className="device-id">{uid ?? "Chưa có mã thiết bị"}</code>
            <Button
              variant="ghost"
              disabled={!uid}
              onClick={() => {
                void navigator.clipboard
                  .writeText(uid!)
                  .then(() =>
                    useUI.getState().notify("Đã sao chép mã thiết bị."),
                  )
                  .catch(reportError);
              }}
            >
              <Copy size={16} />
              Sao chép mã
            </Button>
            <p className="content-note">
              {backendMode === "demo"
                ? "Demo local: thư chỉ dùng trên trình duyệt này."
                : learnerAccount && !learnerAccount.isAnonymous
                  ? "Đăng nhập cùng tài khoản sẽ khôi phục mã nhận thư và dữ liệu học trên thiết bị khác."
                  : "Đăng ký bằng email để giữ mã nhận thư. Xóa dữ liệu trình duyệt khi còn ẩn danh có thể làm mất mã này."}
            </p>
          </section>
          <section className="card privacy-card">
            <ShieldCheck size={24} />
            <div>
              <h3>Một khu vườn riêng tư</h3>
              <p className="muted">
                Bản ghi âm không được tải lên. Không có quảng cáo, thông báo gây
                áp lực hay hình phạt vì nghỉ học.
              </p>
              <Link to="/admin/login" className="text-link">
                Góc quản trị dành cho anh →
              </Link>
            </div>
          </section>
        </div>
      </div>
      {!!savedQuotes.length && (
        <section className="saved-quotes">
          <h2>
            <Heart size={21} />
            Những câu em yêu thích
          </h2>
          {savedQuotes.map((q) => (
            <div className="card saved-quote" key={q.id}>
              <div>
                <p lang="zh-CN">{q.hanzi}</p>
                <p className="pinyin">{q.pinyin}</p>
                <p className="muted">{q.vi}</p>
              </div>
              <AudioButton compact text={q.hanzi} />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <span className="muted">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
    </label>
  );
}
