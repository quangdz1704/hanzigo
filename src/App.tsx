import { lazy, Suspense, Component, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "./lib/Auth";
import { LettersProvider } from "./components/Letters";
import { Shell } from "./components/Shell";
import { Empty, Loading } from "./components/Common";
import Home from "./pages/Home";
import Stories from "./pages/Stories";
import Reader from "./pages/Reader";
const Review = lazy(() => import("./pages/Review"));
const Games = lazy(() => import("./pages/Games"));
const Garden = lazy(() => import("./pages/Garden"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Settings = lazy(() => import("./pages/Settings"));
const Account = lazy(() => import("./pages/Account"));
const AdminGuard = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminGuard })),
);
const AdminLogin = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminLogin })),
);
const AdminHome = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminHome })),
);
const AdminMessages = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminMessages })),
);
const AdminComposer = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminComposer })),
);
const AdminSettings = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminSettings })),
);
const AdminContent = lazy(() => import("./pages/AdminContent"));
export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AuthProvider>
            <LettersProvider>
              <Shell>
                <Suspense fallback={<Loading />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/stories" element={<Stories />} />
                    <Route path="/stories/:id" element={<Reader />} />
                    <Route path="/review" element={<Review />} />
                    <Route path="/games" element={<Games />} />
                    <Route path="/garden" element={<Garden />} />
                    <Route path="/letters" element={<Inbox />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/register" element={<Account />} />
                    <Route path="/login" element={<Account />} />
                    <Route path="/forgot-password" element={<Account />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminGuard />}>
                      <Route index element={<AdminHome />} />
                      <Route path="messages" element={<AdminMessages />} />
                      <Route path="messages/new" element={<AdminComposer />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="content" element={<AdminContent />} />
                    </Route>
                    <Route
                      path="*"
                      element={
                        <Empty title="Đường nhỏ này chưa có trong vườn">
                          <Link to="/" className="text-link">
                            Trở về hôm nay →
                          </Link>
                        </Empty>
                      }
                    />
                  </Routes>
                </Suspense>
              </Shell>
            </LettersProvider>
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <div className="app-error">
          <h1>Khu vườn cần một chút chăm sóc</h1>
          <p>
            Em thử tải lại trang. Nếu trình duyệt chặn lưu trữ, hãy cho phép
            IndexedDB để giữ tiến độ học.
          </p>
          <pre>{this.state.error}</pre>
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Tải lại
          </button>
        </div>
      );
    return this.props.children;
  }
}
