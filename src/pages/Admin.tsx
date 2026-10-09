import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  ArrowLeft,
  Archive,
  Copy,
  Eye,
  Heart,
  LogOut,
  Mail,
  Plus,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/Auth";
import {
  backend,
  backendMode,
  subscribeAdminMessages,
  writeMessage,
  parseLetter,
  archiveMessage,
} from "@/lib/firebase";
import { db, type CachedLetter } from "@/lib/db";
import { milestoneLabels, type MessageInput } from "@/lib/messages";
import { useUI, usePreferences, reportError, run } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LetterBody } from "@/components/Letters";
import { PageHeading, Badge, Loading, Empty } from "@/components/Common";
export function AdminGuard() {
  const { isAdmin, demoAdmin, adminLoading } = useAuth();
  if (adminLoading) return <Loading />;
  return isAdmin || (backendMode === "demo" && demoAdmin) ? (
    <AdminLayout />
  ) : (
    <Navigate to="/admin/login" replace />
  );
}
function AdminLayout() {
  const { logout } = useAuth();
  return (
    <div className="admin-space">
      <div className="admin-nav">
        <span>
          <ShieldCheck size={17} />
          Góc của anh
        </span>
        <nav aria-label="Quản trị">
          <NavLink to="/admin" end>
            Tổng quan
          </NavLink>
          <NavLink to="/admin/messages">Những lá thư</NavLink>
          <NavLink to="/admin/content">Bàn biên tập</NavLink>
          <NavLink to="/admin/settings">Thiết bị & thông báo</NavLink>
        </nav>
        <Button variant="ghost" size="sm" onClick={() => run(logout)}>
          <LogOut size={16} />
          Đăng xuất
        </Button>
      </div>
      {backendMode === "demo" && (
        <div className="demo-notice">
          Demo local · Phiên xem thử, không phải xác thực quản trị Firebase. Thư
          chỉ lưu trên trình duyệt này.
        </div>
      )}
      <Outlet />
    </div>
  );
}
export function AdminLogin() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.isAdmin || (backendMode === "demo" && auth.demoAdmin))
      navigate("/admin", { replace: true });
  }, [auth.isAdmin, auth.demoAdmin, navigate]);
  const login = (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    void action()
      .catch((e) => {
        console.error(e);
        setError(
          "Không thể đăng nhập. Kiểm tra thông tin đăng nhập, nhà cung cấp Auth và miền được cho phép.",
        );
      })
      .finally(() => setBusy(false));
  };
  return (
    <div className="login-wrapper">
      <Link to="/" className="text-link">
        <ArrowLeft size={17} />
        Về khu vườn của em
      </Link>
      <section className="card login-card">
        <span className="login-icon">
          <Mail size={30} />
        </span>
        <PageHeading
          eyebrow="NHỮNG ĐIỀU ANH MUỐN NÓI"
          title="Góc nhỏ dành cho anh"
          description="Soạn một lời nhắn, gửi một chút yêu thương."
        />
        {backendMode === "demo" ? (
          <>
            <p className="muted">
              Firebase chưa được kết nối. Phiên demo cho phép thử soạn và nhận
              thư ngay trên thiết bị này.
            </p>
            <Button onClick={auth.loginDemo}>Mở phiên demo local</Button>
            <p className="content-note">
              Không bảo vệ thư bằng mật khẩu trong demo. Không dùng để lưu thư
              bí mật trên thiết bị chung.
            </p>
          </>
        ) : backendMode === "invalid" ? (
          <p role="alert">
            Cấu hình Firebase chưa đầy đủ. Hãy điền các biến trong .env.example
            rồi khởi động lại app.
          </p>
        ) : (
          <>
            <Button
              disabled={busy || auth.adminLoading}
              variant="secondary"
              onClick={() => login(auth.loginGoogle)}
            >
              Đăng nhập với Google
            </Button>
            <div className="login-divider">hoặc dùng email đã được tạo</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                login(() => auth.loginEmail(email, password));
              }}
            >
              <label className="field">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                Mật khẩu
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={busy || auth.adminLoading}>
                {busy ? "Đang đăng nhập…" : "Đăng nhập"}
              </Button>
            </form>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {auth.adminDenied && (
          <div className="form-error" role="alert">
            <p>
              Tài khoản đã đăng nhập nhưng UID chưa được cho phép trong
              /config/admins. Không có quyền quản lý thư.
            </p>
            <code className="device-id">{auth.adminUser?.uid}</code>
            <Button variant="ghost" onClick={() => run(auth.logout)}>
              Đăng xuất tài khoản này
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
function useAdminMessages() {
  const local = useLiveQuery(
    () => (backendMode === "demo" ? db.letters.toArray() : []),
    [],
    [],
  );
  const [remote, setRemote] = useState<CachedLetter[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!backend);
  useEffect(() => {
    if (!backend) return;
    return subscribeAdminMessages(
      (data) => {
        setRemote(data);
        setLoading(false);
        setError("");
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, []);
  return {
    messages: [...(backend ? remote : local)].sort(
      (a, b) => b.createdAt - a.createdAt,
    ),
    error,
    loading,
  };
}
export function AdminHome() {
  const { messages, error, loading } = useAdminMessages();
  if (loading) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow="GỬI EM MỘT CHÚT DỊU DÀNG"
        title="Những lời yêu thương"
        description="Một câu ngắn cũng có thể làm ngày của em ấm hơn."
        action={
          <Button asChild>
            <Link to="/admin/messages/new">
              <Plus size={17} />
              Viết một lá thư
            </Link>
          </Button>
        }
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="stats-grid">
        {[
          ["Bản nháp", messages.filter((m) => m.status === "draft").length],
          ["Đã gửi", messages.filter((m) => m.status === "published").length],
          [
            "Đang hẹn giờ",
            messages.filter((m) => m.status === "scheduled").length,
          ],
        ].map(([label, count]) => (
          <div className="card stat-card" key={label}>
            <Mail />
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section className="card admin-guide">
        <h2>Một lá thư, đúng lúc</h2>
        <p>
          <strong>Gửi ngay:</strong> em nhận khi app đang mở và có mạng.
        </p>
        <p>
          <strong>Hẹn giờ:</strong> máy chủ bảo vệ nội dung đến giờ gửi. App tự
          kiểm tra mỗi phút khi mở.
        </p>
        <p>
          <strong>Mốc học tập:</strong> hiệu ứng mở thư theo tiến độ local. Nội
          dung không được khóa bí mật trước mốc.
        </p>
        <Link to="/admin/messages" className="text-link">
          Xem những lá thư đã soạn →
        </Link>
      </section>
    </>
  );
}
const statusLabels = {
  draft: "Bản nháp",
  scheduled: "Hẹn giờ",
  published: "Đã gửi",
  archived: "Đã lưu trữ",
};
export function AdminMessages() {
  const { messages, error, loading } = useAdminMessages();
  const local = useLiveQuery(
    () => (backendMode === "demo" ? db.receipts.toArray() : []),
    [],
    [],
  );
  const [receipts, setReceipts] = useState<
    Record<string, { read: boolean; seen: boolean; heart: boolean }>
  >({});
  useEffect(() => {
    if (!backend) return;
    const uids = [...new Set(messages.map((m) => m.recipientUid))];
    const stops = uids.map((uid) =>
      onSnapshot(
        collection(backend!.adminStore, "devices", uid, "receipts"),
        (s) => {
          setReceipts((prev) => {
            const next = { ...prev };
            for (const d of s.docs)
              next[`${uid}:${d.id}`] = {
                read: !!d.data().readAt,
                seen: !!d.data().seenAt,
                heart: !!d.data().heartedAt,
              };
            return next;
          });
        },
        reportError,
      ),
    );
    return () => stops.forEach((s) => s());
  }, [
    messages
      .map((m) => m.recipientUid)
      .sort()
      .join(","),
  ]);
  return (
    <>
      <PageHeading
        title="Những lá thư của anh"
        description="Lưu nháp, gửi đúng lúc, rồi cất lại những lời thương."
        action={
          <Button asChild>
            <Link to="/admin/messages/new">
              <Plus size={17} />
              Viết thư
            </Link>
          </Button>
        }
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <Loading />
      ) : messages.length ? (
        <div className="admin-message-list">
          {messages.map((m) => {
            const lr = local.find((r) => r.id === `${m.recipientUid}:${m.id}`);
            const receipt = receipts[`${m.recipientUid}:${m.id}`] ?? {
              read: !!lr?.readAt,
              seen: !!lr?.seenAt,
              heart: !!lr?.heartedAt,
            };
            return (
              <article className="card admin-message-row" key={m.id}>
                <div>
                  <div className="button-row">
                    <h2>{m.title}</h2>
                    <Badge>{statusLabels[m.status]}</Badge>
                  </div>
                  <p className="muted">
                    {m.deliveryType === "scheduled"
                      ? `Hẹn ${new Date(m.visibleAt).toLocaleString("vi-VN")}`
                      : m.deliveryType === "milestone"
                        ? `Mốc ${m.milestoneCount} ${milestoneLabels[m.milestoneKind]} · không khóa bảo mật`
                        : "Gửi ngay"}{" "}
                    ·{" "}
                    {receipt.read
                      ? "Đã đọc"
                      : receipt.seen
                        ? "Đã hiện trên thiết bị"
                        : "Chưa có xác nhận"}{" "}
                    {receipt.heart ? "♥" : ""}
                  </p>
                  <p className="muted recipient-label">
                    Thiết bị: {m.recipientUid}
                  </p>
                </div>
                <div className="button-row">
                  {m.status === "draft" && (
                    <Button asChild variant="secondary" size="sm">
                      <Link to={`/admin/messages/new?edit=${m.id}`}>
                        Sửa nháp
                      </Link>
                    </Button>
                  )}
                  {m.status !== "archived" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => run(() => archiveMessage(m.id))}
                    >
                      <Archive size={16} />
                      Lưu trữ
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Mail size={35} />} title="Chưa có lá thư nào">
          <p>Bắt đầu bằng một điều giản dị mà anh muốn nói với em.</p>
          <Button asChild>
            <Link to="/admin/messages/new">Viết lá thư đầu tiên</Link>
          </Button>
        </Empty>
      )}
    </>
  );
}
const initial: MessageInput = {
  recipientUid: "",
  title: "",
  zhText: "",
  pinyin: "",
  viText: "",
  theme: "rose",
  deliveryType: "instant",
  milestoneKind: "stories",
  milestoneCount: 1,
};
export function AdminComposer() {
  const { uid } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const edit = params.get("edit");
  const [form, setForm] = useState<MessageInput>({
    ...initial,
    recipientUid:
      localStorage.getItem("hanzigo-recipient") ??
      (backendMode === "demo" ? (uid ?? "") : ""),
  });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(!edit);
  useEffect(() => {
    if (!edit) return;
    let active = true;
    void (async () => {
      let m: CachedLetter | undefined;
      if (backend) {
        const s = await getDocFromServer(
          doc(backend.adminStore, "messages", edit),
        );
        if (s.exists()) m = parseLetter(s.id, s.data());
      } else m = await db.letters.get(edit);
      if (!m || m.status !== "draft")
        throw new Error("Chỉ có thể chỉnh sửa bản nháp.");
      if (active) {
        setForm({
          ...m,
          scheduledAt: m.deliveryType === "scheduled" ? m.visibleAt : undefined,
        });
        setReady(true);
      }
    })().catch((e) => {
      setError((e as Error).message);
    });
    return () => {
      active = false;
    };
  }, [edit]);
  const set = (next: Partial<MessageInput>) => setForm({ ...form, ...next });
  const save = async (publish: boolean) => {
    setBusy(true);
    setError("");
    try {
      await writeMessage(form, publish, edit ?? undefined);
      useUI
        .getState()
        .notify(publish ? "Đã gửi hoặc hẹn giờ lá thư." : "Đã lưu bản nháp.");
      navigate("/admin/messages");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu thư.");
    } finally {
      setBusy(false);
    }
  };
  const localDate = (ms?: number) => {
    if (!ms) return "";
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return (
    <>
      <PageHeading
        title={edit ? "Chăm chút bản nháp" : "Viết một lá thư cho em"}
        description="Nói điều anh muốn nói, bằng cách của anh."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {ready && (
        <form
          className="composer-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void save(true);
          }}
        >
          <section className="card settings-section">
            <label className="field">
              Tiêu đề
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Một điều nhỏ anh muốn nói"
              />
            </label>
            <label className="field">
              Câu tiếng Trung <span className="muted">(tùy chọn)</span>
              <textarea
                rows={2}
                maxLength={500}
                lang="zh-CN"
                value={form.zhText}
                onChange={(e) => set({ zhText: e.target.value })}
              />
            </label>
            <label className="field">
              Pinyin <span className="muted">(tùy chọn, có dấu)</span>
              <input
                maxLength={1000}
                value={form.pinyin}
                onChange={(e) => set({ pinyin: e.target.value })}
              />
            </label>
            <label className="field">
              Lời nhắn tiếng Việt
              <textarea
                required
                rows={7}
                maxLength={5000}
                value={form.viText}
                onChange={(e) => set({ viText: e.target.value })}
                placeholder="Hôm nay anh nghĩ đến em…"
              />
            </label>
            <label className="field">
              Màu của lá thư
              <select
                value={form.theme}
                onChange={(e) =>
                  set({ theme: e.target.value as MessageInput["theme"] })
                }
              >
                <option value="rose">Hồng dịu dàng</option>
                <option value="sage">Xanh bình yên</option>
                <option value="lavender">Tím êm đềm</option>
              </select>
            </label>
          </section>
          <section className="card settings-section">
            <h2>Gửi vào lúc nào?</h2>
            <label className="field">
              Mã thiết bị của em
              <input
                required
                maxLength={128}
                value={form.recipientUid}
                onChange={(e) => set({ recipientUid: e.target.value })}
              />
            </label>
            <p className="content-note">
              Lấy mã ở Cài đặt trên thiết bị của em, hoặc chọn tại Thiết bị &
              thông báo.
            </p>
            <label className="field">
              Cách gửi
              <select
                value={form.deliveryType}
                onChange={(e) =>
                  set({
                    deliveryType: e.target
                      .value as MessageInput["deliveryType"],
                  })
                }
              >
                <option value="instant">Gửi ngay khi em mở app</option>
                <option value="scheduled">Hẹn ngày và giờ</option>
                <option value="milestone">Sau một mốc học tập (UX)</option>
              </select>
            </label>
            {form.deliveryType === "scheduled" && (
              <label className="field">
                Ngày và giờ (giờ địa phương)
                <input
                  type="datetime-local"
                  required
                  value={localDate(form.scheduledAt)}
                  onChange={(e) =>
                    set({
                      scheduledAt: e.target.value
                        ? new Date(e.target.value).getTime()
                        : undefined,
                    })
                  }
                />
              </label>
            )}
            {form.deliveryType === "milestone" && (
              <>
                <label className="field">
                  Mốc mở thư
                  <select
                    value={form.milestoneKind}
                    onChange={(e) =>
                      set({
                        milestoneKind: e.target
                          .value as MessageInput["milestoneKind"],
                      })
                    }
                  >
                    {Object.entries(milestoneLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Số lượng
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={form.milestoneCount}
                    onChange={(e) =>
                      set({ milestoneCount: Number(e.target.value) })
                    }
                  />
                </label>
                <p className="demo-notice">
                  Mốc được kiểm tra trên thiết bị. Nội dung được phép tải ngay
                  sau publish; không dùng cho thư cần giữ bí mật đến khi đạt
                  mốc.
                </p>
              </>
            )}
            <div className="composer-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreview(true)}
              >
                <Eye size={17} />
                Xem trước
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void save(false)}
              >
                Lưu nháp
              </Button>
              <Button type="submit" disabled={busy}>
                <Send size={17} />
                {busy
                  ? "Đang lưu…"
                  : form.deliveryType === "scheduled"
                    ? "Hẹn gửi thư"
                    : "Gửi lời yêu thương"}
              </Button>
            </div>
            <p className="content-note">
              Không gửi push khi app đóng. Lưu trữ thư không thể thu hồi nội
              dung đã nhận và cache trên thiết bị.
            </p>
          </section>
        </form>
      )}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className={`love-dialog theme-${form.theme}`}>
          <DialogTitle className="sr-only">Xem trước lá thư</DialogTitle>
          <DialogDescription className="letter-label">
            XEM TRƯỚC · GIAO DIỆN CỦA EM
          </DialogDescription>
          <LetterBody
            letter={{
              ...form,
              title: form.title || "Tiêu đề của lá thư",
              viText: form.viText || "Lời nhắn của anh sẽ ở đây.",
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
export function AdminSettings() {
  const [devices, setDevices] = useState<{ uid: string; label: string }[]>([]);
  const demoPopups = usePreferences((s) => s.autoLetters);
  const setPrefs = usePreferences((s) => s.set);
  const [popups, setPopups] = useState(demoPopups);
  const [recipient, setRecipient] = useState(
    localStorage.getItem("hanzigo-recipient") ??
      (backendMode === "demo" ? "demo-device" : ""),
  );
  const [loading, setLoading] = useState(!!backend);
  useEffect(() => {
    if (!backend) return;
    const stop = onSnapshot(
      collection(backend!.adminStore, "devices"),
      (s) => {
        setDevices(
          s.docs.map((d) => ({
            uid: d.id,
            label: String(d.data().label ?? "Thiết bị của em"),
          })),
        );
        setLoading(false);
      },
      (e) => {
        reportError(e);
        setLoading(false);
      },
    );
    const settingsStop = onSnapshot(
      doc(backend.adminStore, "config", "settings"),
      (s) => setPopups(s.data()?.popupsEnabled !== false),
      reportError,
    );
    return () => {
      stop();
      settingsStop();
    };
  }, []);
  return (
    <>
      <PageHeading
        title="Thiết bị & thông báo"
        description="Chọn đúng nơi những lời thương sẽ đến."
      />
      <section className="card settings-section admin-settings">
        <label className="field">
          Thiết bị mặc định
          <input
            value={recipient}
            maxLength={128}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </label>
        <Button
          onClick={() => {
            localStorage.setItem("hanzigo-recipient", recipient.trim());
            useUI
              .getState()
              .notify("Đã lưu mã thiết bị mặc định trên trình duyệt quản trị.");
          }}
        >
          Lưu thiết bị mặc định
        </Button>
        <label className="toggle-row">
          <span>
            <strong>Cho phép popup thư mới</strong>
            <span className="muted">
              Em vẫn có thể tắt riêng trên thiết bị của mình.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Cho phép popup thư mới"
            checked={popups}
            onChange={(e) => {
              const checked = e.target.checked;
              if (!backend) {
                setPopups(checked);
                setPrefs({ autoLetters: checked });
                useUI
                  .getState()
                  .notify("Đã cập nhật popup trên thiết bị demo.");
                return;
              }
              run(async () => {
                await setDoc(doc(backend!.adminStore, "config", "settings"), {
                  popupsEnabled: checked,
                });
                setPopups(checked);
              });
            }}
          />
        </label>
        <h2>Thiết bị đã mở app</h2>
        {loading ? (
          <Loading />
        ) : backendMode === "demo" ? (
          <div className="device-row">
            <span>Demo local</span>
            <code>demo-device</code>
            <Button variant="ghost" onClick={() => setRecipient("demo-device")}>
              Chọn
            </Button>
          </div>
        ) : devices.length ? (
          devices.map((d) => (
            <div className="device-row" key={d.uid}>
              <span>{d.label}</span>
              <code>{d.uid}</code>
              <Button variant="ghost" onClick={() => setRecipient(d.uid)}>
                Chọn
              </Button>
            </div>
          ))
        ) : (
          <p className="muted">
            Chưa có thiết bị. Mở app trên thiết bị của em để đăng ký danh tính
            ẩn danh.
          </p>
        )}
        <p className="content-note">
          MVP không gửi thông báo hệ thống khi app đóng. Firebase web config là
          public; quyền quản trị do Firestore Rules và UID allowlist quyết định.
        </p>
      </section>
    </>
  );
}
