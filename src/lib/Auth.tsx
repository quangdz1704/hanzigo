import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  type User,
} from "firebase/auth";
import {
  backend,
  backendMode,
  adminAllowed,
  subscribeLearner,
} from "./firebase";
import { reportError } from "./store";
import { adminAccessErrorMessage } from "./admin-access";
import {
  registerLearner,
  loginLearner,
  emailSchema,
  ensureGuest,
  signInLearnerGoogle,
} from "./learner-auth";
interface LearnerAccount {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
}
const accountOf = (user: User): LearnerAccount => ({
  uid: user.uid,
  email: user.email,
  isAnonymous: user.isAnonymous,
  emailVerified: user.emailVerified,
});
interface AuthState {
  uid: string | null;
  learnerError: string | null;
  learnerAccount: LearnerAccount | null;
  learnerLoading: boolean;
  register: (
    email: string,
    password: string,
    confirmation: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutLearner: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  adminUser: User | null;
  isAdmin: boolean;
  adminLoading: boolean;
  adminDenied: boolean;
  adminCheckError: string | null;
  demoAdmin: boolean;
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const guestAttempt = useRef<Promise<unknown> | null>(null);
  const [learnerAccount, setLearnerAccount] = useState<LearnerAccount | null>(
    null,
  );
  const [learnerLoading, setLearnerLoading] = useState(!!backend);
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
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);
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
        setLearnerAccount(accountOf(user));
        setLearnerLoading(false);
        stopLetters = subscribeLearner(user.uid, (e) => {
          if (active && backend?.auth.currentUser?.uid === user.uid)
            setLearnerError(
              `Hộp thư chưa kết nối được (${e.message}). Tiến độ học vẫn lưu trên thiết bị.`,
            );
        });
      } else {
        setUid(null);
        setLearnerAccount(null);
        setLearnerLoading(true);
        guestAttempt.current = ensureGuest(backend!.auth)
          .catch((e) => {
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
          })
          .finally(() => {
            if (active) setLearnerLoading(false);
          });
      }
    });
    const adminStop = onAuthStateChanged(backend.adminAuth, (user) => {
      const version = ++generation;
      setLoading(true);
      setAdmin(false);
      setAdminUser(user);
      setDenied(false);
      setAdminCheckError(null);
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
        .catch((error: unknown) => {
          if (active && version === generation)
            setAdminCheckError(adminAccessErrorMessage(error));
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
  const readyLearnerAuth = async () => {
    if (!backend)
      throw new Error("Cần cấu hình Firebase để đăng ký và đăng nhập.");
    await backend.auth.authStateReady();
    await guestAttempt.current;
    return backend.auth;
  };
  const register = async (
    email: string,
    password: string,
    confirmation: string,
  ) => {
    const auth = await readyLearnerAuth();
    const user = await registerLearner(auth, email, password, confirmation);
    setLearnerAccount(accountOf(user));
    setUid(user.uid);
  };
  const signIn = async (email: string, password: string) => {
    const auth = await readyLearnerAuth();
    const user = await loginLearner(auth, email, password);
    setLearnerAccount(accountOf(user));
    setUid(user.uid);
  };
  const signOutLearner = async () => {
    const auth = await readyLearnerAuth();
    await signOut(auth);
    // The observer returns to a new guest; existing local learning is preserved.
  };
  const signInGoogle = () => {
    if (!backend)
      return Promise.reject(
        new Error("Cần cấu hình Firebase để đăng nhập Google."),
      );
    return signInLearnerGoogle(backend.auth).then((user) => {
      setLearnerAccount(accountOf(user));
      setUid(user.uid);
    });
  };
  const resetPassword = async (email: string) => {
    const auth = await readyLearnerAuth();
    try {
      await sendPasswordResetEmail(auth, emailSchema.parse(email.trim()));
    } catch (e) {
      if (!(
        e &&
        typeof e === "object" &&
        "code" in e &&
        e.code === "auth/user-not-found"
      ))
        throw e;
    }
  };
  const verifyEmail = async () => {
    const auth = await readyLearnerAuth();
    if (!auth.currentUser || auth.currentUser.isAnonymous)
      throw new Error("Em cần đăng nhập trước.");
    await sendEmailVerification(auth.currentUser);
  };
  const refreshAccount = async () => {
    const auth = await readyLearnerAuth();
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setLearnerAccount(accountOf(auth.currentUser));
  };
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
        learnerAccount,
        learnerLoading,
        register,
        signIn,
        signInGoogle,
        signOutLearner,
        resetPassword,
        verifyEmail,
        refreshAccount,
        adminUser,
        isAdmin,
        adminLoading,
        adminDenied,
        adminCheckError,
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
