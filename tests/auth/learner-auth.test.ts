import { afterAll, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  connectAuthEmulator,
  signOut,
  sendEmailVerification,
  applyActionCode,
  reload,
  sendPasswordResetEmail,
  confirmPasswordReset,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
} from "firebase/auth";
import {
  ensureGuest,
  registerLearner,
  loginLearner,
} from "../../src/lib/learner-auth";

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (host !== "127.0.0.1:9099" && host !== "localhost:9099")
  throw new Error(
    "Auth tests require the local demo emulator; cloud testing is forbidden.",
  );
const apps: FirebaseApp[] = [];
let sequence = 0;
function freshAuth() {
  const app = initializeApp(
    {
      apiKey: "fake-api-key",
      projectId: "demo-hanzigo",
      authDomain: "demo-hanzigo.firebaseapp.com",
      appId: "demo-test",
    },
    `auth-test-${sequence++}`,
  );
  apps.push(app);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
  return auth;
}
const password = "Local-test-only-42!";
const email = () => `learner-${Date.now()}-${sequence}@example.test`;
function fakeGoogleCredential(address?: string) {
  // Unsigned tokens are accepted ONLY by the local Auth emulator.
  const subject = `google-test-${Date.now()}-${sequence}`;
  const encode = (data: unknown) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");
  const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: subject, iss: "https://accounts.google.com", aud: "demo-client", email: address ?? `${subject}@example.test`, email_verified: true, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
  return GoogleAuthProvider.credential(token);
}
afterAll(async () => {
  await Promise.all(apps.map(deleteApp));
});
describe("learner Firebase Auth integration", () => {
  it("uses the original UID when verified Google email matches a password account", async () => {
    const owner = freshAuth();
    const address = `hanzigo-emulator-${Date.now()}-${sequence}@gmail.com`;
    const account = await registerLearner(owner, address, password, password);
    const auth = freshAuth();
    await ensureGuest(auth);
    const signedIn = (
      await signInWithCredential(auth, fakeGoogleCredential(address))
    ).user;
    expect(signedIn.uid).toBe(account.uid);
    expect(signedIn.email).toBe(address);
  });
  it("links a Google identity to a guest and restores its UID on another device", async () => {
    const auth = freshAuth();
    const guest = await ensureGuest(auth);
    const uid = guest.uid;
    const credential = fakeGoogleCredential();
    const linked = (await linkWithCredential(guest, credential)).user;
    expect(linked.uid).toBe(uid);
    expect(linked.isAnonymous).toBe(false);
    expect(
      linked.providerData.some(
        (provider) => provider.providerId === "google.com",
      ),
    ).toBe(true);
    const other = freshAuth();
    expect((await signInWithCredential(other, credential)).user.uid).toBe(uid);
  });
  it("keeps the guest intact on Google collision and can restore the existing Google account", async () => {
    const owner = freshAuth();
    const credential = fakeGoogleCredential();
    const existing = (await signInWithCredential(owner, credential)).user;
    const auth = freshAuth();
    const guest = await ensureGuest(auth);
    const uid = guest.uid;
    await expect(linkWithCredential(guest, credential)).rejects.toMatchObject({
      code: "auth/credential-already-in-use",
    });
    expect(auth.currentUser?.uid).toBe(uid);
    expect(auth.currentUser?.isAnonymous).toBe(true);
    expect((await signInWithCredential(auth, credential)).user.uid).toBe(
      existing.uid,
    );
  });
  it("deduplicates concurrent guest creation", async () => {
    const auth = freshAuth();
    const guests = await Promise.all([
      ensureGuest(auth),
      ensureGuest(auth),
      ensureGuest(auth),
    ]);
    expect(new Set(guests.map((user) => user.uid)).size).toBe(1);
    expect(guests[0].isAnonymous).toBe(true);
  });
  it("upgrades the guest in place and restores its UID on another device", async () => {
    const auth = freshAuth();
    const guest = await ensureGuest(auth);
    const uid = guest.uid;
    const address = email();
    const user = await registerLearner(
      auth,
      ` ${address} `,
      password,
      password,
    );
    expect(user.uid).toBe(uid);
    expect(user.isAnonymous).toBe(false);
    expect(user.email).toBe(address);
    expect(user.emailVerified).toBe(false);
    const otherDevice = freshAuth();
    const restored = await loginLearner(otherDevice, address, password);
    expect(restored.uid).toBe(uid);
    await signOut(auth);
    expect((await ensureGuest(auth)).uid).not.toBe(uid);
    expect((await loginLearner(auth, address, password)).uid).toBe(uid);
  });
  it("can create an account without anonymous provider identity", async () => {
    const auth = freshAuth();
    const user = await registerLearner(auth, email(), password, password);
    expect(user.isAnonymous).toBe(false);
  });
  it("preserves guest identity when an existing email cannot be linked", async () => {
    const owner = freshAuth();
    const address = email();
    await registerLearner(owner, address, password, password);
    const guestAuth = freshAuth();
    const guest = await ensureGuest(guestAuth);
    await expect(
      registerLearner(guestAuth, address, password, password),
    ).rejects.toMatchObject({ code: "auth/email-already-in-use" });
    expect(guestAuth.currentUser?.uid).toBe(guest.uid);
    expect(guestAuth.currentUser?.isAnonymous).toBe(true);
  });
  it("rejects invalid input and failed login without changing current identity", async () => {
    const auth = freshAuth();
    const guest = await ensureGuest(auth);
    await expect(
      registerLearner(auth, email(), password, "different"),
    ).rejects.toThrow();
    expect(auth.currentUser?.uid).toBe(guest.uid);
    const address = email();
    const user = await registerLearner(auth, address, password, password);
    await expect(
      registerLearner(auth, email(), password, password),
    ).rejects.toThrow("đăng xuất");
    await expect(
      loginLearner(auth, address, "wrong-password"),
    ).rejects.toThrow();
    expect(auth.currentUser?.uid).toBe(user.uid);
  });
  it("keeps learner and admin sessions independent", async () => {
    const learner = freshAuth(),
      admin = freshAuth();
    const learnerUser = await registerLearner(
      learner,
      email(),
      password,
      password,
    );
    const adminUser = await registerLearner(admin, email(), password, password);
    await signOut(learner);
    await ensureGuest(learner);
    expect(admin.currentUser?.uid).toBe(adminUser.uid);
    await loginLearner(learner, learnerUser.email!, password);
    await signOut(admin);
    expect(learner.currentUser?.uid).toBe(learnerUser.uid);
  });
  it("verifies email and resets password through local Firebase action codes", async () => {
    const auth = freshAuth();
    const address = email();
    const user = await registerLearner(auth, address, password, password);
    await sendEmailVerification(user);
    const codes = async () => {
      const response = await fetch(
        `http://${host}/emulator/v1/projects/demo-hanzigo/oobCodes`,
      );
      if (!response.ok)
        throw new Error("Cannot read local emulator action codes");
      return (await response.json()).oobCodes as {
        email: string;
        requestType: string;
        oobCode: string;
      }[];
    };
    const verify = (await codes()).find(
      (code) => code.email === address && code.requestType === "VERIFY_EMAIL",
    )!;
    expect(verify).toBeDefined();
    await applyActionCode(auth, verify.oobCode);
    await reload(user);
    expect(user.emailVerified).toBe(true);
    await sendPasswordResetEmail(auth, address);
    const reset = (await codes()).find(
      (code) => code.email === address && code.requestType === "PASSWORD_RESET",
    )!;
    expect(reset).toBeDefined();
    const updatedPassword = "Updated-local-only-43!";
    await confirmPasswordReset(auth, reset.oobCode, updatedPassword);
    const second = freshAuth();
    await expect(loginLearner(second, address, password)).rejects.toThrow();
    expect((await loginLearner(second, address, updatedPassword)).uid).toBe(
      user.uid,
    );
  });
});
