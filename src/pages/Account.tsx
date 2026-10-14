import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/Auth";
import { backendMode } from "@/lib/firebase";
import { authErrorMessage } from "@/lib/learner-auth";
import { Button } from "@/components/ui/button";
import { Badge, PageHeading } from "@/components/Common";
import { useOnline } from "@/lib/hooks";

export default function Account() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mode =
    pathname === "/register"
      ? "register"
      : pathname === "/forgot-password"
        ? "reset"
        : "login";
  const account = auth.learnerAccount;
  const signedIn = !!account && !account.isAnonymous;
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  useEffect(() => {
    setPassword("");
    setConfirmation("");
    setError("");
    setNotice("");
    setShowPassword(false);
  }, [pathname]);
  useEffect(() => {
    setVerificationSent(false);
  }, [account?.uid]);
  const perform = (
    action: () => Promise<void>,
    success?: string,
    method: "email" | "google" = "email",
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    void action()
      .then(() => {
        if (success) setNotice(success);
      })
      .catch((e: unknown) => setError(authErrorMessage(e, method)))
      .finally(() => setBusy(false));
  };
  const disabled =
    busy || auth.learnerLoading || !online || backendMode !== "cloud";
  return (
    <div className="login-wrapper account-wrapper">
      <Link to="/settings" className="text-link">
        <ArrowLeft size={17} />
        Về tùy chọn của em
      </Link>
      <section className="card login-card account-card">
        <span className="login-icon">
          <UserRound size={30} />
        </span>
        <PageHeading
          eyebrow="GIỮ KHU VƯỜN CỦA EM"
          title={
            signedIn
              ? "Tài khoản của em"
              : mode === "register"
                ? "Tạo tài khoản"
                : mode === "reset"
                  ? "Lấy lại mật khẩu"
                  : "Mừng em trở lại"
          }
          description={
            signedIn
              ? "Email giúp em đăng nhập lại và giữ mã nhận thư."
              : mode === "register"
                ? "Dùng Google hoặc email — rồi mình tiếp tục đọc nhé."
                : mode === "reset"
                  ? "Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu."
                  : "Chọn Google hoặc email để trở lại khu vườn."
          }
        />
        {signedIn ? (
          <>
            <p className="account-email">
              <Mail size={18} />
              {account.email}
            </p>
            <Badge className="badge-sage">
              {account.emailVerified
                ? "Đã xác minh email"
                : "Email chưa xác minh"}
            </Badge>
            {!account.emailVerified && (
              <div className="account-verification">
                <p className="muted">
                  Mở email xác minh từ Firebase, rồi quay lại kiểm tra trạng
                  thái.
                </p>
                <div className="button-row">
                  <Button
                    disabled={disabled || verificationSent}
                    variant="secondary"
                    onClick={() =>
                      perform(async () => {
                        await auth.verifyEmail();
                        setVerificationSent(true);
                      }, "Đã yêu cầu gửi email xác minh. Em kiểm tra hộp thư và thư rác nhé.")
                    }
                  >
                    <Mail size={16} />
                    {verificationSent
                      ? "Đã gửi email xác minh"
                      : "Gửi email xác minh"}
                  </Button>
                  <Button
                    disabled={disabled}
                    variant="outline"
                    onClick={() =>
                      perform(
                        auth.refreshAccount,
                        "Đã cập nhật trạng thái xác minh.",
                      )
                    }
                  >
                    <Check size={16} />
                    Em đã xác minh
                  </Button>
                </div>
              </div>
            )}
            <p className="muted">Mã nhận thư của tài khoản</p>
            <code className="device-id">{account.uid}</code>
            <p className="content-note">
              Đăng nhập trên máy khác sẽ dùng cùng mã nhận thư, tiến độ học, từ
              đã lưu và các tùy chọn của tài khoản.
            </p>
            <div className="button-row">
              <Button asChild>
                <Link to="/stories">Tiếp tục đọc</Link>
              </Button>
              <Button
                disabled={disabled}
                variant="ghost"
                onClick={() =>
                  perform(
                    auth.signOutLearner,
                    "Đã đăng xuất. Em đang dùng một mã khách mới; dữ liệu học trên trình duyệt vẫn được giữ.",
                  )
                }
              >
                <LogOut size={16} />
                Đăng xuất tài khoản
              </Button>
            </div>
          </>
        ) : (
          <>
            {mode !== "reset" && (
              <nav className="tabs" aria-label="Tài khoản">
                <Button
                  variant={mode === "register" ? "secondary" : "ghost"}
                  asChild
                >
                  <Link to="/register">Đăng ký</Link>
                </Button>
                <Button
                  variant={mode === "login" ? "secondary" : "ghost"}
                  asChild
                >
                  <Link to="/login">Đăng nhập</Link>
                </Button>
              </nav>
            )}
            {backendMode !== "cloud" && (
              <p className="form-error" role="alert">
                {backendMode === "demo"
                  ? "Chế độ demo chưa kết nối Firebase. Đăng ký cần cấu hình Firebase thật."
                  : "Cấu hình Firebase chưa đầy đủ. Kiểm tra .env.local rồi khởi động lại app."}
              </p>
            )}
            {mode !== "reset" && (
              <div className="google-signin">
                <Button
                  type="button"
                  variant="outline"
                  className="google-button"
                  disabled={disabled}
                  onClick={() =>
                    perform(
                      async () => {
                        await auth.signInGoogle();
                        setPassword("");
                        setConfirmation("");
                        navigate("/account", { replace: true });
                      },
                      undefined,
                      "google",
                    )
                  }
                >
                  <GoogleIcon />
                  Tiếp tục với Google
                </Button>
                <div className="auth-divider">
                  <span>hoặc dùng email</span>
                </div>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (disabled) return;
                if (mode === "reset") {
                  perform(
                    () => auth.resetPassword(email),
                    "Nếu email này có tài khoản, Firebase sẽ gửi hướng dẫn đặt lại mật khẩu. Em kiểm tra hộp thư và thư rác nhé.",
                  );
                  return;
                }
                perform(async () => {
                  if (mode === "register")
                    await auth.register(email, password, confirmation);
                  else await auth.signIn(email, password);
                  setPassword("");
                  setConfirmation("");
                  navigate("/account", { replace: true });
                });
              }}
            >
              <label className="field">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  placeholder="ten@email.com"
                />
              </label>
              {mode !== "reset" && (
                <>
                  <div className="field">
                    <label htmlFor="learner-password">Mật khẩu</label>
                    <div className="password-input">
                      <input
                        id="learner-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          mode === "register"
                            ? "new-password"
                            : "current-password"
                        }
                        required
                        minLength={mode === "register" ? 8 : 1}
                        maxLength={4096}
                        aria-describedby={
                          mode === "register" ? "password-help" : undefined
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={
                          showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </Button>
                    </div>
                  </div>
                  {mode === "register" && (
                    <>
                      <p className="content-note" id="password-help">
                        Ít nhất 8 ký tự. App sẽ kiểm tra thêm các yêu cầu mật
                        khẩu của Firebase.
                      </p>
                      <label className="field">
                        Nhập lại mật khẩu
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          maxLength={4096}
                          value={confirmation}
                          onChange={(e) => setConfirmation(e.target.value)}
                          disabled={busy}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              <Button type="submit" disabled={disabled}>
                {busy
                  ? "Đang thực hiện…"
                  : auth.learnerLoading
                    ? "Đang chuẩn bị tài khoản…"
                    : mode === "register"
                      ? "Tạo tài khoản"
                      : mode === "reset"
                        ? "Gửi hướng dẫn đặt lại"
                        : "Đăng nhập"}
              </Button>
            </form>
            {mode === "login" && (
              <Link to="/forgot-password" className="text-link account-reset">
                Quên mật khẩu?
              </Link>
            )}
            {mode === "reset" && (
              <Link to="/login" className="text-link account-reset">
                Trở về đăng nhập
              </Link>
            )}
            {mode === "register" && (
              <p className="content-note">
                Đăng ký mới giữ mã nhận thư của phiên khách. Nếu Google đã có
                tài khoản, app dùng mã của tài khoản đó. Tiến độ học trên trình
                duyệt vẫn được giữ.
              </p>
            )}
            {mode === "login" && (
              <p className="content-note">
                Đăng nhập sẽ mở dữ liệu học và hộp thư của tài khoản đó. Dữ liệu
                khách vẫn giữ riêng trên máy này.
              </p>
            )}
            <p>
              <Link to="/stories" className="text-link">
                Tiếp tục đọc khi chưa đăng nhập →
              </Link>
            </p>
          </>
        )}
        {!online && (
          <p className="form-error" role="status">
            Đăng ký và thao tác tài khoản cần mạng. Em vẫn đọc và ôn nội dung đã
            lưu được.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="account-notice" role="status">
            {notice}
          </p>
        )}
        <p className="content-note account-security">
          <ShieldCheck size={16} />
          Mật khẩu được gửi trực tiếp tới Firebase Authentication; app không lưu
          mật khẩu trong dữ liệu học.
        </p>
        <Link to="/admin/login" className="text-link">
          Đăng nhập quản trị →
        </Link>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.91a6 6 0 0 1 0-3.82V7.5H3.05a10 10 0 0 0 0 9l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"
      />
    </svg>
  );
}
