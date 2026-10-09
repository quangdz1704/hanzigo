import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  backend,
  backendMode,
  adminAllowed,
  subscribeLearner,
} from "./firebase";
import { reportError } from "./store";
interface AuthState {
  uid: string | null;
  learnerError: string | null;
  adminUser: User | null;
  isAdmin: boolean;
  adminLoading: boolean;
  adminDenied: boolean;
  demoAdmin: boolean;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(
    backendMode === "demo" ? "demo-device" : null,
  );
  const [learnerError, setLearnerError] = useState<string | null>(
    backendMode === "invalid"
      ? "Cấu hình Firebase chưa đầy đủ. Học offline vẫn hoạt động; hãy kiểm tra .env."
      : null,
  );
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isAdmin, setAdmin] = useState(false);
  const [adminLoading, setLoading] = useState(!!backend);
  const [adminDenied, setDenied] = useState(false);
  const [demoAdmin, setDemo] = useState(
    backendMode === "demo" &&
      sessionStorage.getItem("hanzigo-demo-admin") === "true",
  );
  useEffect(() => {
    if (!backend) return;
    let stopLetters = () => {};
    let generation = 0;
    let active = true;
    const learnerStop = onAuthStateChanged(backend.auth, (user) => {
      stopLetters();
      if (user) {
        setLearnerError(null);
        setUid(user.uid);
        stopLetters = subscribeLearner(user.uid, (e) => {
          if (active)
            setLearnerError(
              `Hộp thư chưa kết nối được (${e.message}). Tiến độ học vẫn lưu trên thiết bị.`,
            );
        });
      } else {
        setUid(null);
        void signInAnonymously(backend!.auth).catch((e) => {
          if (active)
            setLearnerError(
              e.code === "auth/configuration-not-found"
                ? "Firebase Authentication chưa được khởi tạo. Vào Console → Authentication → Get started và bật Anonymous."
                : e.code === "auth/admin-restricted-operation" ||
                    e.code === "auth/operation-not-allowed"
                  ? "Firebase chưa bật Anonymous Auth. Bật nhà cung cấp Anonymous trong Authentication → Sign-in method."
                  : "Chưa cấp được mã thiết bị. Kiểm tra Anonymous Auth và kết nối Firebase.",
            );
          console.error(e);
        });
      }
    });
    const adminStop = onAuthStateChanged(backend.adminAuth, (user) => {
      const version = ++generation;
      setLoading(true);
      setAdmin(false);
      setAdminUser(user);
      setDenied(false);
      if (!user) {
        setLoading(false);
        return;
      }
      void adminAllowed(user.uid, backend!.adminStore)
        .then((allowed) => {
          if (active && version === generation) {
            setAdmin(allowed);
            setDenied(!allowed);
          }
        })
        .catch(() => {
          if (active && version === generation) setDenied(true);
        })
        .finally(() => {
          if (active && version === generation) setLoading(false);
        });
    });
    return () => {
      active = false;
      generation++;
      learnerStop();
      adminStop();
      stopLetters();
    };
  }, []);
  const loginGoogle = async () => {
    if (!backend) throw new Error("Firebase chưa được cấu hình.");
    await backend.adminReady;
    await signInWithPopup(backend.adminAuth, new GoogleAuthProvider());
  };
  const loginEmail = async (email: string, password: string) => {
    if (!backend) throw new Error("Firebase chưa được cấu hình.");
    await backend.adminReady;
    await signInWithEmailAndPassword(backend.adminAuth, email, password);
  };
  const loginDemo = () => {
    if (backendMode !== "demo") return;
    sessionStorage.setItem("hanzigo-demo-admin", "true");
    setDemo(true);
  };
  const logout = async () => {
    if (backend) await signOut(backend.adminAuth);
    sessionStorage.removeItem("hanzigo-demo-admin");
    setDemo(false);
    setAdmin(false);
  };
  return (
    <AuthContext.Provider
      value={{
        uid,
        learnerError,
        adminUser,
        isAdmin,
        adminLoading,
        adminDenied,
        demoAdmin,
        loginGoogle,
        loginEmail,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider required");
  return context;
};
