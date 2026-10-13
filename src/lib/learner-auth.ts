import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInAnonymously,
  validatePassword,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signInWithCredential,
  type Auth,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { z } from "zod";
const guestRequests = new WeakMap<
  Auth,
  Promise<import("firebase/auth").User>
>();
export function ensureGuest(auth: Auth) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  const pending = guestRequests.get(auth);
  if (pending) return pending;
  const request = signInAnonymously(auth)
    .then((result) => result.user)
    .finally(() => {
      guestRequests.delete(auth);
    });
  guestRequests.set(auth, request);
  return request;
}

export const emailSchema = z
  .email("Email chưa đúng định dạng.")
  .trim()
  .max(254);
export const registrationSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
      .max(4096, "Mật khẩu quá dài."),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    path: ["confirmation"],
    message: "Hai mật khẩu chưa khớp.",
  });

export async function registerLearner(
  auth: Auth,
  email: string,
  password: string,
  confirmation: string,
) {
  const input = registrationSchema.parse({
    email: email.trim(),
    password,
    confirmation,
  });
  await auth.authStateReady();
  if (auth.currentUser && !auth.currentUser.isAnonymous)
    throw new Error(
      "Em đang đăng nhập. Hãy đăng xuất trước khi tạo tài khoản khác.",
    );
  // Firebase Auth emulator does not implement getPasswordPolicy. Production
  // always validates the project's policy; the emulator uses the local schema.
  const policy = auth.emulatorConfig
    ? null
    : await validatePassword(auth, input.password);
  if (policy && !policy.isValid) {
    const missing: string[] = [];
    if (policy.meetsMinPasswordLength === false)
      missing.push(
        `ít nhất ${policy.passwordPolicy.customStrengthOptions.minPasswordLength ?? 8} ký tự`,
      );
    if (policy.meetsMaxPasswordLength === false)
      missing.push(
        `không quá ${policy.passwordPolicy.customStrengthOptions.maxPasswordLength} ký tự`,
      );
    if (policy.containsLowercaseLetter === false) missing.push("chữ thường");
    if (policy.containsUppercaseLetter === false) missing.push("chữ hoa");
    if (policy.containsNumericCharacter === false) missing.push("chữ số");
    if (policy.containsNonAlphanumericCharacter === false)
      missing.push("ký tự đặc biệt");
    throw new Error(
      `Mật khẩu cần ${missing.length ? missing.join(", ") : "đáp ứng chính sách của Firebase"}.`,
    );
  }
  const user = auth.currentUser;
  if (user && !user.isAnonymous)
    throw new Error(
      "Em đang đăng nhập. Hãy đăng xuất trước khi tạo tài khoản khác.",
    );
  // Linking upgrades the guest in place: recipient UID and existing mail access stay intact.
  return user?.isAnonymous
    ? (
        await linkWithCredential(
          user,
          EmailAuthProvider.credential(input.email, input.password),
        )
      ).user
    : (await createUserWithEmailAndPassword(auth, input.email, input.password))
        .user;
}
export async function loginLearner(
  auth: Auth,
  email: string,
  password: string,
) {
  const normalized = emailSchema.parse(email.trim());
  if (!password) throw new Error("Em nhập mật khẩu nhé.");
  return (await signInWithEmailAndPassword(auth, normalized, password)).user;
}
export function signInLearnerGoogle(auth: Auth) {
  const guest = auth.currentUser;
  if (guest && !guest.isAnonymous)
    return Promise.reject(
      new Error("Em đang đăng nhập. Hãy đăng xuất trước khi đổi tài khoản."),
    );
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  // Start the popup directly from the click, before any await, so browsers
  // retain user activation. The UI waits for guest initialization beforehand.
  const request = guest
    ? linkWithPopup(guest, provider)
    : signInWithPopup(auth, provider);
  return request
    .then((result) => result.user)
    .catch((error: unknown) => {
      if (
        !guest ||
        !auth.currentUser?.isAnonymous ||
        auth.currentUser.uid !== guest.uid ||
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        ![
          "auth/credential-already-in-use",
          "auth/email-already-in-use",
        ].includes(String(error.code))
      )
        throw error;
      const credential = GoogleAuthProvider.credentialFromError(
        error as FirebaseError,
      );
      if (!credential) throw error;
      // An existing Google account keeps its own UID; never delete the guest or
      // merge private letters across identities. Local learning stays in place.
      return signInWithCredential(auth, credential).then(
        (result) => result.user,
      );
    });
}
export function authErrorMessage(
  error: unknown,
  method: "email" | "google" = "email",
): string {
  if (error instanceof z.ZodError) return error.issues[0].message;
  const code =
    error && typeof error === "object" && "code" in error ? error.code : "";
  switch (code) {
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
      return "Email này đã có tài khoản. Em chuyển sang Đăng nhập nhé.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email hoặc mật khẩu chưa đúng. Em kiểm tra lại nhé.";
    case "auth/invalid-email":
      return "Email chưa đúng định dạng.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Mật khẩu chưa đáp ứng yêu cầu bảo mật của Firebase.";
    case "auth/operation-not-allowed":
      return `Chưa bật ${method === "google" ? "Google" : "Email/Password"}. Mở Firebase Console → Authentication → Sign-in method để bật.`;
    case "auth/popup-blocked":
      return "Trình duyệt đang chặn cửa sổ đăng nhập. Cho phép popup cho HanziGo rồi bấm Google lại nhé.";
    case "auth/popup-closed-by-user":
      return "Cửa sổ Google đã đóng. Em có thể bấm lại để tiếp tục.";
    case "auth/cancelled-popup-request":
      return "Một cửa sổ đăng nhập khác đang mở. Em hoàn tất hoặc đóng cửa sổ đó trước nhé.";
    case "auth/unauthorized-domain":
      return "Domain này chưa được cho phép đăng nhập. Thêm domain trong Firebase Authentication → Settings → Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "Email này đã dùng một cách đăng nhập khác. Em dùng cách đăng nhập trước đây để vào tài khoản nhé.";
    case "auth/configuration-not-found":
      return "Firebase Authentication chưa được khởi tạo trong Console.";
    case "auth/network-request-failed":
      return "Chưa kết nối được Firebase. Em kiểm tra mạng rồi thử lại nhé.";
    case "auth/too-many-requests":
      return "Đã thử quá nhiều lần. Em chờ một chút rồi thử lại nhé.";
    case "auth/user-disabled":
      return "Tài khoản này đang bị vô hiệu hóa. Hãy liên hệ người quản trị.";
    default:
      return error instanceof Error && !code
        ? error.message
        : "Chưa thực hiện được. Em thử lại sau nhé.";
  }
}
