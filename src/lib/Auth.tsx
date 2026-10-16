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
  onIdTokenChanged,
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
  connectAccountProfile,
  restoreGuestName,
  deviceProfileTransport,
} from "./account-profile";
import { compactInactiveAccountCaches } from "./local-cache";
import type { ProfileStatus } from "./profile-sync";
import {
  db,
  getLearningDatabase,
  migrateGuestLearning,
  selectLearningDatabase,
} from "./db";
import { startAccountSync, type DataSyncStatus } from "./account-sync";
import {
  loadAccountPreferences,
  saveGuestPreferences,
  watchAccountPreferences,
} from "./account-preferences";
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
  profileStatus: ProfileStatus | "local";
  retryProfile: () => void;
  dataSyncStatus: DataSyncStatus;
  learningScope: string;
  retryDataSync: () => void;
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
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | "local">(
    "local",
  );
  const profileRetry = useRef<() => void>(() => {});
  const dataRetry = useRef<() => void>(() => {});
  const [dataSyncStatus, setDataSyncStatus] = useState<DataSyncStatus>("local");
  const [learningScope, setLearningScope] = useState("guest");
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
    let stopProfile = () => {};
    let stopData = () => {};
    let stopPreferences = () => {};
    let previousIdentity: { uid: string; isAnonymous: boolean } | null = null;
    let profileGeneration = 0;
    let generation = 0;
    let active = true;
    const learnerStop = onIdTokenChanged(backend.auth, (user) => {
      const profileVersion = ++profileGeneration;
      stopLetters();
      stopProfile();
      stopData();
      stopPreferences();
      profileRetry.current = () => {};
      dataRetry.current = () => {};
      if (user) {
        setLearnerError(null);
        const before = previousIdentity;
        previousIdentity = { uid: user.uid, isAnonymous: user.isAnonymous };
        setLearnerLoading(true);
        void (async () => {
          if (
            getLearningDatabase() === db &&
            (before?.isAnonymous || !(await db.meta.get("learningMigration")))
          )
            await saveGuestPreferences();
          if (!user.isAnonymous)
            await migrateGuestLearning(
              user.uid,
              !!before?.isAnonymous && before.uid === user.uid,
            );
          if (!active || profileVersion !== profileGeneration) return;
          const database = selectLearningDatabase(
            user.isAnonymous ? null : user.uid,
          );
          void compactInactiveAccountCaches().catch(() => {});
          await loadAccountPreferences(
            database,
            () => active && profileVersion === profileGeneration,
          );
          if (!active || profileVersion !== profileGeneration) return;
          stopPreferences = watchAccountPreferences(database);
          if (!user.isAnonymous) {
            const sync = startAccountSync(
              backend!.store,
              user.uid,
              database,
              (status) => {
                if (active && profileVersion === profileGeneration)
                  setDataSyncStatus(status);
              },
            );
            stopData = sync.stop;
            dataRetry.current = sync.retry;
          } else setDataSyncStatus("local");
          setLearningScope(user.isAnonymous ? "guest" : user.uid);
          setUid(user.uid);
          setLearnerAccount(accountOf(user));
          setLearnerLoading(false);
        })().catch(() => {
          if (active && profileVersion === profileGeneration) {
            selectLearningDatabase(user.isAnonymous ? null : user.uid);
            setLearningScope(user.isAnonymous ? "guest" : user.uid);
            setUid(user.uid);
            setLearnerAccount(accountOf(user));
            setDataSyncStatus("error");
            setLearnerError(
              "Chưa mở được dữ liệu học trên máy này. Tải lại để thử kết nối.",
            );
            setLearnerLoading(false);
          }
        });
        if (user.isAnonymous) {
          restoreGuestName();
          setProfileStatus("local");
        } else {
          const profile = connectAccountProfile(
            backend!.store,
            user,
            (status) => {
              if (active && profileVersion === profileGeneration)
                setProfileStatus(status);
            },
          );
          profileRetry.current = profile.retry;
          stopProfile = profile.stop;
        }
        if (!user.isAnonymous)
          stopLetters = subscribeLearner(user.uid, (e) => {
            if (active && backend?.auth.currentUser?.uid === user.uid)
              setLearnerError(
                `Hộp thư chưa kết nối được (${e.message}). Tiến độ học vẫn lưu trên thiết bị.`,
              );
          });
      } else {
        previousIdentity = null;
        selectLearningDatabase(null);
        void compactInactiveAccountCaches().catch(() => {});
        setLearningScope("guest");
        setDataSyncStatus("local");
        restoreGuestName();
        setProfileStatus("local");
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
    const retryProfile = () => profileRetry.current();
    window.addEventListener("online", retryProfile);
    const profileTimer = setInterval(retryProfile, 60000);
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
      if (!user.isAnonymous)
        void deviceProfileTransport(backend!.adminStore, user)
          .sync(user.displayName || user.email?.split("@")[0] || "em", false)
          .catch(reportError);
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
      profileGeneration++;
      learnerStop();
      adminStop();
      stopLetters();
      stopProfile();
      stopData();
      stopPreferences();
      window.removeEventListener("online", retryProfile);
      clearInterval(profileTimer);
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
    await registerLearner(auth, email, password, confirmation);
  };
  const signIn = async (email: string, password: string) => {
    const auth = await readyLearnerAuth();
    await loginLearner(auth, email, password);
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
    return signInLearnerGoogle(backend.auth).then(() => {});
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
        profileStatus,
        retryProfile: () => profileRetry.current(),
        dataSyncStatus,
        learningScope,
        retryDataSync: () => dataRetry.current(),
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
