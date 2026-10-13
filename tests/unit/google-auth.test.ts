import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signInWithCredential,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import {
  signInLearnerGoogle,
  authErrorMessage,
} from "../../src/lib/learner-auth";
vi.mock("firebase/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/auth")>()),
  linkWithPopup: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
}));
const guest = { uid: "guest-1", isAnonymous: true } as User;
const fakeAuth = (user: User | null = guest) => ({ currentUser: user }) as Auth;
const result = (uid: string) =>
  ({ user: { uid, isAnonymous: false } }) as UserCredential;
const collision = () =>
  new FirebaseError("auth/credential-already-in-use", "", {
    _tokenResponse: {
      oauthIdToken: "fake-test-only-id-token",
      oauthAccessToken: "fake-test-only-access-token",
    },
  });
beforeEach(() => vi.resetAllMocks());
describe("learner Google popup flow", () => {
  it("starts guest linking synchronously from the click and requests account choice", async () => {
    const auth = fakeAuth();
    vi.mocked(linkWithPopup).mockResolvedValue(result(guest.uid));
    const pending = signInLearnerGoogle(auth);
    expect(linkWithPopup).toHaveBeenCalledOnce();
    const provider = vi.mocked(linkWithPopup).mock
      .calls[0][1] as GoogleAuthProvider;
    expect(provider.getCustomParameters()).toEqual({
      prompt: "select_account",
    });
    expect((await pending).uid).toBe(guest.uid);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
  it("uses learner Auth for popup sign-in if no guest exists", async () => {
    const auth = fakeAuth(null);
    vi.mocked(signInWithPopup).mockResolvedValue(result("new-google"));
    expect((await signInLearnerGoogle(auth)).uid).toBe("new-google");
    expect(signInWithPopup).toHaveBeenCalledWith(
      auth,
      expect.any(GoogleAuthProvider),
    );
    expect(linkWithPopup).not.toHaveBeenCalled();
  });
  it("reuses the credential to restore an existing Google UID without another popup", async () => {
    const auth = fakeAuth();
    vi.mocked(linkWithPopup).mockRejectedValue(collision());
    vi.mocked(signInWithCredential).mockResolvedValue(
      result("existing-google"),
    );
    expect((await signInLearnerGoogle(auth)).uid).toBe("existing-google");
    expect(signInWithCredential).toHaveBeenCalledWith(
      auth,
      expect.objectContaining({ providerId: "google.com" }),
    );
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
  it("does not switch identities after cancellation", async () => {
    const error = new FirebaseError("auth/popup-closed-by-user", "");
    const auth = fakeAuth();
    vi.mocked(linkWithPopup).mockRejectedValue(error);
    await expect(signInLearnerGoogle(auth)).rejects.toBe(error);
    expect(auth.currentUser?.uid).toBe(guest.uid);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });
  it("can use a Google credential when the matching email already has an account", async () => {
    const error = new FirebaseError(
      "auth/email-already-in-use",
      "",
      collision().customData,
    );
    const auth = fakeAuth();
    vi.mocked(linkWithPopup).mockRejectedValue(error);
    vi.mocked(signInWithCredential).mockResolvedValue(
      result("existing-email-account"),
    );
    expect((await signInLearnerGoogle(auth)).uid).toBe(
      "existing-email-account",
    );
    expect(signInWithCredential).toHaveBeenCalledOnce();
  });
  it("does not retry a collision when no Google credential is available", async () => {
    const error = new FirebaseError("auth/credential-already-in-use", "", {});
    vi.mocked(linkWithPopup).mockRejectedValue(error);
    await expect(signInLearnerGoogle(fakeAuth())).rejects.toBe(error);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });
  it("does not replace an account changed while the popup was open", async () => {
    const auth = fakeAuth();
    vi.mocked(linkWithPopup).mockRejectedValue(collision());
    const pending = signInLearnerGoogle(auth);
    Object.assign(auth, {
      currentUser: { uid: "another-session", isAnonymous: true },
    });
    await expect(pending).rejects.toMatchObject({
      code: "auth/credential-already-in-use",
    });
    expect(signInWithCredential).not.toHaveBeenCalled();
  });
  it("requires logout before replacing a registered account", async () => {
    await expect(
      signInLearnerGoogle(
        fakeAuth({ uid: "member", isAnonymous: false } as User),
      ),
    ).rejects.toThrow("đăng xuất");
    expect(linkWithPopup).not.toHaveBeenCalled();
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
  it("explains Google provider and popup setup without exposing credentials", () => {
    expect(
      authErrorMessage({ code: "auth/operation-not-allowed" }, "google"),
    ).toContain("Chưa bật Google");
    expect(
      authErrorMessage({ code: "auth/popup-blocked" }, "google"),
    ).toContain("Cho phép popup");
    expect(
      authErrorMessage({ code: "auth/unauthorized-domain" }, "google"),
    ).toContain("Authorized domains");
  });
});
