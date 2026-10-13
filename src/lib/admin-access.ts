export function adminAccessErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code).replace(/^firestore\//, "")
      : "unknown";
  if (code === "permission-denied")
    return "Firestore từ chối kiểm tra quyền quản trị. Kiểm tra UID bên dưới đã có trong config/admins và Firestore Rules đã được triển khai đúng project.";
  if (code === "unavailable" || code === "deadline-exceeded")
    return "Chưa kết nối được Firestore để kiểm tra quyền quản trị. Kiểm tra mạng, Firestore Database/API rồi thử lại.";
  if (code === "unauthenticated")
    return "Phiên đăng nhập chưa được Firestore chấp nhận. Đăng xuất rồi đăng nhập lại.";
  return "Chưa kiểm tra được quyền quản trị. Kiểm tra cấu hình Firestore và thử lại.";
}
