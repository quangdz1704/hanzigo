import { describe, expect, it, vi } from "vitest";
import { validatePassword, type Auth } from "firebase/auth";
import {
  authErrorMessage,
  registrationSchema,
  registerLearner,
} from "../../src/lib/learner-auth";
vi.mock("firebase/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/auth")>()),
  validatePassword: vi.fn(),
}));
describe("registration input and safe error messages", () => {
  it("rejects malformed email, short passwords and mismatching confirmation", () => {
    for (const input of [
      { email: "bad", password: "abcdefgh", confirmation: "abcdefgh" },
      { email: "a@example.com", password: "short", confirmation: "short" },
      {
        email: "a@example.com",
        password: "abcdefgh",
        confirmation: "abcdefgi",
      },
    ])
      expect(registrationSchema.safeParse(input).success).toBe(false);
  });
  it("preserves intentional spaces in passwords", () => {
    const input = registrationSchema.parse({
      email: "a@example.com",
      password: " password ",
      confirmation: " password ",
    });
    expect(input.password).toBe(" password ");
  });
  it("does not expose raw SDK errors or distinguish missing users from wrong passwords", () => {
    expect(
      authErrorMessage({
        code: "auth/internal-error",
        message: "sensitive response",
      }),
    ).not.toContain("sensitive");
    expect(authErrorMessage({ code: "auth/user-not-found" })).toBe(
      authErrorMessage({ code: "auth/wrong-password" }),
    );
    expect(authErrorMessage({ code: "auth/email-already-in-use" })).toContain(
      "Đăng nhập",
    );
    expect(authErrorMessage({ code: "auth/operation-not-allowed" })).toContain(
      "Email/Password",
    );
  });
  it("requires the production password policy before upgrading a guest", async () => {
    const auth = {
      currentUser: { isAnonymous: true },
      authStateReady: async () => {},
      emulatorConfig: null,
    } as unknown as Auth;
    vi.mocked(validatePassword).mockResolvedValue({
      isValid: false,
      containsUppercaseLetter: false,
      passwordPolicy: { customStrengthOptions: {} },
    } as Awaited<ReturnType<typeof validatePassword>>);
    await expect(
      registerLearner(auth, "a@example.com", "abcdefgh", "abcdefgh"),
    ).rejects.toThrow("chữ hoa");
    expect(validatePassword).toHaveBeenCalledWith(auth, "abcdefgh");
  });
  it("does not bypass production policy when Firebase cannot validate it", async () => {
    const auth = {
      currentUser: null,
      authStateReady: async () => {},
      emulatorConfig: null,
    } as unknown as Auth;
    vi.mocked(validatePassword).mockRejectedValue({
      code: "auth/network-request-failed",
    });
    await expect(
      registerLearner(auth, "a@example.com", "abcdefgh", "abcdefgh"),
    ).rejects.toMatchObject({ code: "auth/network-request-failed" });
  });
});
