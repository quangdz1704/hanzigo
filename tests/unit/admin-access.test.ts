import { describe, expect, it } from "vitest";
import { adminAccessErrorMessage } from "../../src/lib/admin-access";
describe("admin permission check errors", () => {
  it("does not claim a missing UID when Rules reject access", () => {
    const message = adminAccessErrorMessage({ code: "permission-denied" });
    expect(message).toContain("Firestore từ chối");
    expect(message).toContain("Rules");
    expect(message).not.toContain("UID chưa được cho phép");
  });
  it("separates temporary connection failures from permission failures", () => {
    for (const code of [
      "unavailable",
      "deadline-exceeded",
      "firestore/unavailable",
    ])
      expect(adminAccessErrorMessage({ code })).toContain("Chưa kết nối");
  });
  it("provides a session recovery instruction for rejected authentication", () => {
    expect(adminAccessErrorMessage({ code: "unauthenticated" })).toContain(
      "Đăng xuất",
    );
  });
  it("does not expose raw SDK response data", () => {
    expect(
      adminAccessErrorMessage(new Error("private server response")),
    ).not.toContain("private");
  });
});
