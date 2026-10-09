import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  Flower2,
  Gamepad2,
  Home,
  Mail,
  PanelLeftClose,
  Settings,
  Sprout,
  WifiOff,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
import { motion } from "motion/react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { usePreferences, useUI } from "@/lib/store";
import { useOnline } from "@/lib/hooks";
import { useAuth } from "@/lib/Auth";
import { useLetters } from "./Letters";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { backendMode } from "@/lib/firebase";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const navigation = [
  { to: "/", label: "Hôm nay", icon: Home },
  { to: "/stories", label: "Thư viện truyện", short: "Truyện", icon: BookOpen },
  { to: "/review", label: "Vườn từ vựng", short: "Ôn từ", icon: Sprout },
  { to: "/games", label: "Góc chơi nhỏ", short: "Chơi", icon: Gamepad2 },
  { to: "/garden", label: "Khu vườn", short: "Vườn", icon: Flower2 },
  { to: "/letters", label: "Hộp thư yêu thương", short: "Thư", icon: Mail },
];
export function Shell({ children }: { children: ReactNode }) {
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const pref = usePreferences();
  const online = useOnline();
  const auth = useAuth();
  const { unread } = useLetters();
  const location = useLocation();
  const { toast, clearToast } = useUI();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        pref.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : pref.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [pref.theme]);
  useEffect(() => {
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    const installed = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 4500);
    return () => clearTimeout(id);
  }, [toast, clearToast]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  const current =
    navigation.find((n) => n.to !== "/" && location.pathname.startsWith(n.to))
      ?.label ??
    (location.pathname.startsWith("/settings")
      ? "Tùy chọn"
      : location.pathname.startsWith("/admin")
        ? "Góc quản trị"
        : "Hôm nay");
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Đến nội dung chính
      </a>
      <aside className={`sidebar ${menu ? "mobile-open" : ""}`}>
        {menu && (
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-close"
            aria-label="Đóng menu"
            onClick={() => setMenu(false)}
          >
            <X size={19} />
          </Button>
        )}
        <Link to="/" className="brand" aria-label="HanziGo · Trang chủ">
          <span className="brand-icon">
            花<span>✿</span>
          </span>
          <span className="brand-name">
            Hanzi<span>Go</span>
            <small>KHU VƯỜN TIẾNG TRUNG CỦA EM</small>
          </span>
        </Link>
        <div className="sidebar-label">GÓC NHỎ CỦA EM</div>
        <nav aria-label="Điều hướng chính">
          {navigation.map((n) => (
            <NavLink
              key={n.to}
              end={n.to === "/"}
              to={n.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.to === "/letters" && !!unread && (
                <span className="count-badge">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>❀</span>
            <p>
              Chậm một chút,
              <br />
              vui nhiều một chút.
            </p>
            <small>Mỗi ngày đều là một khởi đầu.</small>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Settings size={19} />
            Tùy chọn của em
          </NavLink>
          <button
            className="nav-item install-link"
            onClick={() => {
              if (install) {
                void install
                  .prompt()
                  .then(() => install.userChoice)
                  .then(() => setInstall(null));
              } else setHelp(true);
            }}
          >
            <Download size={18} />
            Thêm vào màn hình chính
          </button>
          <div className="sidebar-profile">
            <div>✿</div>
            <span>
              <strong>Khu vườn của {pref.name || "em"}</strong>
              <small>
                {backendMode === "demo"
                  ? "Đang dùng demo local"
                  : "Một chút tiến bộ mỗi ngày"}
              </small>
            </span>
            <HeartMark />
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu"
              aria-label="Mở menu"
              onClick={() => setMenu(!menu)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>Khu vườn của em</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <span className="connection-status">
              <span className={`status-dot ${online ? "" : "offline"}`} />
              {online ? "Một ngày thật dịu dàng" : "Đang đọc offline"}
            </span>
            <Link
              to="/letters"
              className="header-mail"
              aria-label={`Hộp thư, ${unread} thư chưa đọc`}
            >
              <Mail size={20} />
              {!!unread && <span className="unread-dot" />}
            </Link>
            <Link
              className="profile-button"
              to="/settings"
              aria-label="Cài đặt của em"
            >
              ✿
            </Link>
          </div>
        </header>
        {!online && (
          <div className="network-banner">
            <WifiOff size={16} />
            Em vẫn đọc và ôn được nội dung đã lưu. Thư mới và âm thanh online
            cần mạng.
          </div>
        )}
        {auth.learnerError && (
          <div className="network-banner" role="status">
            {auth.learnerError}
          </div>
        )}
        {needRefresh && (
          <div className="network-banner">
            <RefreshCw size={16} />
            Có phiên bản mới.{" "}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void updateServiceWorker(true)}
            >
              Cập nhật khi em sẵn sàng
            </Button>
          </div>
        )}
        <motion.main
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          id="main"
          className="main-content"
          tabIndex={-1}
        >
          {children}
        </motion.main>
        <nav className="bottom-nav" aria-label="Điều hướng mobile">
          {navigation.map((n) => (
            <NavLink
              key={n.to}
              end={n.to === "/"}
              to={n.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <n.icon size={20} />
              <span>{n.short ?? n.label}</span>
              {n.to === "/letters" && !!unread && <i className="unread-dot" />}
            </NavLink>
          ))}
        </nav>
        {offlineReady && (
          <span className="offline-ready sr-only" role="status">
            Nội dung đã sẵn sàng để đọc offline.
          </span>
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Đóng thông báo"
            onClick={clearToast}
          >
            <X size={17} />
          </Button>
        </div>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogTitle className="dialog-heading">
            Mang khu vườn theo em
          </DialogTitle>
          <DialogDescription>
            Thêm HanziGo vào màn hình chính để mở như một ứng dụng.
          </DialogDescription>
          <p>
            Trên iPhone: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính.
          </p>
          <p>
            Trên Android hoặc desktop: mở menu trình duyệt → Cài đặt ứng dụng.
            Tính năng này cần HTTPS và bản build PWA.
          </p>
          <p className="muted">
            Truyện và tiến độ đọc dùng được offline sau lần tải đầu. Âm thanh
            phụ thuộc giọng đọc trên thiết bị.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function HeartMark() {
  return (
    <span aria-hidden="true" className="heart-mark">
      ♡
    </span>
  );
}
