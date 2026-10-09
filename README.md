# HanziGo V2 🌸

**Khu vườn tiếng Trung của em.** Một PWA học tiếng Trung qua truyện ngắn, từ vựng và những lời nhắn yêu thương. Giao diện tiếng Việt; tiếng Trung giản thể, Pinyin có dấu và bản dịch Việt. Trình độ HSK chỉ mang tính tham khảo.

## Chạy local

Cần Node.js **22.12+** (đã kiểm tra trên 22.14), npm. Không cần Firebase để thử demo.

```sh
npm install
npm run dev
```

Mở địa chỉ Vite in ra. Nếu máy đang chạy app khác trên localhost cùng port, dùng `http://127.0.0.1:5173/` hoặc `npm run dev -- --port 5180`.

```sh
npm run test              # Unit tests: content, SRS, ngày local, IndexedDB, backup, eligibility, popup claim
npm run content:validate  # Kiểm tra seed, IDs, đáp án, glossary mappings
npm run build            # TypeScript strict + Vite + PWA
npm run preview          # Xem bản production / thử service worker
```

PWA/service worker hoạt động trên **bản build**, HTTPS hoặc localhost. Dev server không đăng ký service worker. Không tự deploy hay commit.

## Có thể dùng ngay

- Dashboard có câu tiếng Trung theo **ngày địa phương**, nghe/copy/yêu thích và truyện đang đọc.
- Thư viện 20 truyện hoàn chỉnh; tìm kiếm không dấu và lọc chủ đề, HSK, trạng thái đọc/yêu thích.
- Reader: bật/tắt Pinyin/dịch, cỡ chữ, đọc tiếp vị trí đã lưu, glossary được biên soạn, lưu từ, nghe từng câu/toàn truyện và 3 câu hỏi mỗi truyện.
- 200 mục từ có nghĩa, Pinyin, ví dụ và nguồn truyện. Thêm bộ 10 từ từng truyện, ôn theo truyện, tìm từ đã lưu bằng Hanzi/Pinyin/nghĩa tiếng Việt không dấu. Nút đánh giá hiển thị interval thực tế.
- SRS deterministic: Quên 10 phút, Khó 1 ngày, Nhớ 3 ngày, Dễ 7 ngày ở lần đầu; các lần sau tăng interval, tối đa 365 ngày. Thời điểm ôn là timestamp tuyệt đối; streak dùng ngày local.
- Ghép từ/nghĩa, xếp câu, nghe/chọn nghĩa theo dữ liệu truyện. XP chơi được tính một lần cho mỗi trò/truyện/ngày.
- Thu giọng bằng MediaRecorder sau khi bấm cho phép, nghe lại và xóa. Bản ghi chỉ nằm trong RAM, mất khi rời trang; không upload hay chấm điểm.
- XP và vườn hoa/đồ trang trí, streak từ hoạt động thật. Đọc và quiz không farm XP khi reload; dữ liệu lịch sử không bị xóa khi nghỉ.
- Inbox và admin composer có preview, nháp, gửi ngay/hẹn giờ/mốc học tập, archive, read/heart/favorite, popup claim nguyên tử trên IndexedDB.
- Dark mode, reduced motion, keyboard/focus support, navigation mobile và desktop, offline/error/empty/loading states.
- Xuất/nhập JSON có Zod validation và hợp nhất theo ID. Backup **không** chứa thư, receipts, danh tính hay ghi âm.

## Bàn biên tập V2

Vào `/admin/content` sau khi đăng nhập admin. Form sửa tên, câu Hanzi/Pinyin/dịch, mục từ, mapping, câu hỏi/đáp án và câu xếp từ. Chế độ JSON cho phép sửa toàn bộ metadata/IDs hoặc thêm/bớt câu và mục từ. **Lưu nháp** giữ cả JSON chưa hoàn chỉnh trên IndexedDB. Khi đổi truyện, nháp đang sửa được lưu trước; hãy bấm lưu trước khi đóng tab. Nháp không nằm trong backup tiến độ, cần xuất riêng. Không dùng để lưu nội dung bí mật trên máy chung.

**Tạo bản sao** cấp IDs mới cho truyện, câu, mục từ và câu hỏi. **Xem trước** dùng cùng thành phần reader (Hanzi/Pinyin/dịch/audio/glossary) nhưng không ghi XP/tiến độ. Chỉ dữ liệu hợp lệ, IDs không trùng và glossary gắn đúng câu mới được preview/xuất. Mỗi truyện tối đa 500 KB, audio phải HTTPS. Tất cả nội dung vẫn có trạng thái ngôn ngữ `draft`.

**Xuất truyện** để cập nhật/thêm một truyện, hoặc **Xuất thư viện + bản đang xem** để thay toàn bộ seed. Lệnh import nhận cả hai loại:

```sh
npm run content:import -- /path/to/story.json
# Hoặc full library:
npm run content:import -- /path/to/hanzigo-content.json
npm run content:validate
npm run test
npm run build
```

Import một truyện thay ID đang có hoặc thêm ID mới; không xóa các truyện khác. Export toàn bộ ghép **chỉ bản đang xem** vào seed gốc; để ghép nhiều nháp, xuất rồi import từng truyện. Giữ ID câu/mục từ khi sửa lỗi để bảo toàn lịch sử. Lưu nháp không thay đổi thư viện learner và không tự phát hành lên Firebase. Bản build mới chứa thư viện đã nhập. Content format vẫn `version: 1`; phiên bản app `0.2.0`.

## Demo local

Khi toàn bộ Firebase config cần thiết còn trống, app dùng chế độ **demo local**:

1. Vào `/admin` → bị chuyển về `/admin/login`.
2. Bấm **Mở phiên demo local**. Đây là phiên xem thử trong sessionStorage, **không phải** đăng nhập Firebase hay cơ chế giữ thư bí mật.
3. Soạn tại `/admin/messages/new`, người nhận `demo-device`, preview rồi gửi.
4. Về `/`: thư mở một lần; khi đang ở reader/review/game thì chỉ có badge. Vào hộp thư để mở thủ công.
5. Đóng/xem sau, tim và yêu thích được lưu qua reload. Admin có thể xem receipts và lưu trữ thư.

Demo chỉ dùng được trên cùng browser/origin. Không gửi giữa hai máy. Không có thư tình cá nhân seed trong bundle. Các test UI dùng thư được ghi rõ là demo. Config điền dở sẽ báo lỗi và **không** cho mở demo để tránh giả vờ đang dùng backend đã cấu hình.

## Kết nối Firebase

Người dùng thực hiện các bước console sau; source không tạo tài khoản dịch vụ hay bật billing.

1. Tạo/chọn Firebase project, đăng ký Web App, tạo Firestore và chọn region phù hợp. Bắt đầu ở chế độ khóa, **không bật test mode public**.
2. Authentication → Sign-in method: bật **Anonymous** cho learner và **Google** hoặc **Email/Password** cho admin. Nếu dùng email, tạo người dùng admin trong console.
3. Authentication → Settings → Authorized domains: thêm domain Vercel/custom và localhost theo môi trường. Không dùng mật khẩu demo ở production.
4. Trong workspace này, `.env.local` đã có cấu hình web của **hanzigo-eea7d**, `.firebaserc` đặt project mặc định tương ứng. Khi clone sang máy khác, sao chép `.env.example` sang `.env.local`, điền Firebase **web** config (apiKey, authDomain, projectId, appId bắt buộc). Khởi động lại Vite. Không đưa service account, private key hay Admin SDK vào frontend.
5. Tìm UID admin ở Firebase Authentication. Dùng **Firestore Console** tạo document `config/admins`:

   ```json
   { "uids": ["UID_CUA_ADMIN"] }
   ```

   Document này được bảo vệ; không client nào, kể cả admin, được sửa allowlist. Thay đổi bằng console hoặc công cụ server tin cậy.

6. Deploy rules/indexes từ máy của bạn, sau khi login Firebase CLI:

   ```sh
   npx firebase login
   npx firebase use hanzigo-eea7d
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```

   Chờ composite index xây xong trước khi dùng inbox. Không có Cloud Function/cron trong MVP.

7. Mở app trên máy của em: anonymous Auth tự cấp UID, ghi `devices/{uid}` với timestamp server. Lấy mã trong `/settings` hoặc tìm tại `/admin/settings`; đặt mã người nhận mặc định trên browser admin.
8. Đăng nhập `/admin/login`. App kiểm tra allowlist bằng request thật đến Firestore; UID không được whitelist không được mở quản trị. Rules bảo vệ dữ liệu ngay cả nếu client route guard bị sửa.
9. Soạn và gửi thư. Có thể mở app learner và admin trên hai máy để kiểm tra realtime.

Learner và admin dùng **hai Firebase app/Auth instances riêng**. Đăng nhập hoặc logout admin không thay đổi UID learner trên cùng máy. Phiên admin dùng session persistence. Thư quản trị từ cloud không được ghi vào IndexedDB hay service-worker runtime cache.

## Mô hình bảo mật thư

| Dữ liệu                              | Quyền                                                              |
| ------------------------------------ | ------------------------------------------------------------------ |
| `config/admins`                      | Chỉ UID trong allowlist được get; không client nào được write/list |
| `config/settings`                    | Authenticated được get cờ popup, admin được write schema giới hạn  |
| `devices/{uid}`                      | Learner đọc/đăng ký đúng UID; admin đọc/list                       |
| `messages/{id}`                      | Admin CRUD; learner chỉ đọc thư được release cho UID của mình      |
| `devices/{uid}/receipts/{messageId}` | Chỉ learner tương ứng ghi schema receipt; admin đọc                |
| Mọi path khác                        | Deny by default                                                    |

**Gửi ngay:** trạng thái `published` có nghĩa là admin đã phát hành nội dung. Rules chỉ cho admin ghi, và yêu cầu thời điểm phát hành không nằm trong tương lai. Listener `recipientUid == uid, status == published` nhận gần realtime khi app mở có mạng. Không có push khi app đóng.

**Hẹn giờ:** trạng thái `scheduled` và `visibleAt == scheduledAt`. Rules dùng **`request.time` từ server**, không dùng clock máy để cho phép đọc. Không được đọc draft, thư tương lai hay thư của UID khác. Client đồng bộ timestamp server từ `lastPing`, dùng performance clock cộng thời gian đã trôi, lùi 5 giây để query chắc chắn nằm trước server. Query thư đến hạn được cập nhật mỗi phút, timestamp anchor cập nhật mỗi 5 phút. Đổi giờ máy về tương lai không giúp tải nội dung: query quá tương lai bị Rules từ chối toàn bộ. App mới mở quá sớm có thể cần chờ tối đa khoảng 1 phút và khoảng đệm 5 giây sau giờ hẹn. Không cần cron; `scheduled` còn nguyên trạng thái kể cả sau khi đủ giờ.

**Mốc học tập:** MVP là **hiệu ứng UX**, hiển thị sau N truyện/streak/lượt ôn local. Sau publish, authenticated recipient có thể tải nội dung trước khi đạt mốc, và nội dung có thể được cache. Composer, popup và README đều ghi rõ giới hạn này. Không dùng để giữ bí mật trước mốc. Mở khóa an toàn cần tài khoản learner ổn định, tiến độ server tin cậy và server-side unlock ở giai đoạn tiếp theo.

**Read/heart/favorite:** ở nhánh receipt riêng; learner không sửa body. Receipt local được lưu ngay, đồng bộ nền theo thứ tự và thử lại khi có mạng. Timestamp cloud dùng serverTimestamp. Popup claim nguyên tử tránh hiển thị lại sau reload hay trên nhiều tab cùng browser. Trong khi đọc/chơi, chỉ có badge; app mở popup sau khi rời phần học, hoặc mở khi em chủ động vào inbox.

**Cache:** chỉ thư đã được server cho phép nhận được ghi vào IndexedDB theo recipient UID. Không precache thư, không cache Firestore bằng service worker; SDK dùng memory cache mặc định. Archive không thu hồi bản nội dung đã nhận/cache. Có thể vẫn đọc lịch sử offline. Người có quyền mở profile trình duyệt của learner có thể đọc thư đã nhận, vì MVP không mã hóa thư tại thiết bị.

**Danh tính ẩn danh:** xóa browser/site data, dùng private mode hoặc chuyển origin/thiết bị có thể mất UID và tiến độ. Mã backup không khôi phục Auth UID. Cần chọn lại thiết bị người nhận. Nên link anonymous identity với tài khoản ở giai đoạn tiếp theo nếu cần chuyển thiết bị ổn định. Learning state local không phải bằng chứng bảo mật cho unlock.

## Test Firestore Rules

Cần Java **21+** trên PATH. `npm run test` không yêu cầu Java hoặc Firebase cloud.

```sh
npm run test:rules
```

Emulator dùng project `demo-hanzigo`, không dùng dữ liệu production. Tests bao gồm unauthenticated, wrong-recipient, non-admin, draft/future, đúng query recipient/due, admin CRUD, allowlist không tự sửa, device identity và read/heart receipt riêng. Nếu dùng Homebrew Java trên macOS:

```sh
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:rules
```

Muốn dùng emulator khi phát triển UI: điền config Web giả cho project `demo-hanzigo`, `VITE_USE_FIREBASE_EMULATORS=true`, Auth :9099, Firestore :8080; tạo Auth admin/allowlist trong emulator bằng công cụ test. **Không bật flag emulator trên Vercel**.

## PWA & deploy Vercel khi bạn sẵn sàng

1. `npm run build`, `npm run preview`; thử read/review và reload deep links.
2. Import repo hoặc dùng Vercel CLI theo tài khoản của bạn. Framework **Vite**, build `npm run build`, output `dist`.
3. Thêm các biến `VITE_FIREBASE_*` vào environment của Vercel trước khi build. Đây là biến compile-time; đổi biến cần rebuild.
4. `vercel.json` có SPA rewrite cho `/admin`, reader và các deep links. Assets/service worker vẫn được serve như file tĩnh. Không rewrite Auth Firebase handler ở hosting này; `authDomain` nên dùng domain Firebase Auth đã cung cấp.
5. Thêm domain deploy vào Firebase Authorized domains. Deploy rules/indexes đúng Firebase project trước khi thử gửi thư.
6. Vào URL HTTPS, kiểm tra refresh trực tiếp `/stories/rainy-cafe`, `/review`, `/admin/messages/new`; route admin chưa đăng nhập phải về login.
7. Mở lần đầu có mạng, đợi app shell được cache rồi thử offline. Truyện/quiz/SRS/garden đã được precache, fonts có file local. Admin chunk được loại khỏi precache. TTS tùy thiết bị, không hứa offline audio. Không cache Firebase requests hay admin response bằng service worker.
8. Test Add to Home Screen trên Android/desktop và Safari iOS. Update PWA là prompt để người học tự chọn lúc tải lại.

**Chưa deploy trong phiên triển khai này.** Không tạo cloud resources hay bật dịch vụ trả phí.

## Nội dung và mở rộng

`src/content/seed.json`: versioned seed; `schema.ts`: Zod schema + mapping/answer/unique-ID validation; `index.ts`: engine tách UI. Thêm tới 20 truyện bằng cách giữ cấu trúc, glossary source IDs, 3–5 câu hỏi và câu game đã biên soạn.

```sh
npm run content:import -- /path/to/full-content.json
npm run content:validate
```

Import tooling thay thế file seed sau khi validate, không thêm nội dung sai schema. Seed và SVG/icons do HanziGo tự biên soạn/tạo, license **CC0-1.0**; không copy sách hay dataset bên ngoài. Fonts Be Vietnam Pro và Lora do @fontsource phân phối theo **SIL Open Font License**; package có license đi kèm. Các thư người dùng tự viết không thuộc CC0 content seed.

**Nội dung Trung/Pinyin là bản nháp được tạo với AI, chưa được người bản ngữ kiểm duyệt.** Schema test xác minh cấu trúc, ánh xạ và đáp án theo seed; không chứng minh độ chính xác ngôn ngữ/HSK. Cần người có chuyên môn đọc lại trước khi dùng lâu dài, thu audio và xuất bản.

## Cấu trúc source

```text
src/content/      Stories, quotes, vocabulary, Zod schemas
src/lib/          Dexie, SRS/date/XP, backups, UI prefs, audio, Firebase/Auth
src/components/   App shell, original SVG art, reader quiz, recorder, love popup
src/components/ui/ shadcn-style Button và Radix Dialog đã tùy biến
src/pages/        Learner routes và admin flows
scripts/          Content validation/import, dependency-free icon generation
 tests/unit/      Unit/IndexedDB integration tests
 tests/rules/     Firestore emulator tests
firestore.rules   Deny-by-default policy
```

## Chi phí và giới hạn hiện tại

Firebase/Vercel có quota và điều kiện plan có thể thay đổi; **không khẳng định luôn miễn phí**. Không bật billing trong mã. Theo dõi Firebase Usage và plan hiện có trước khi deploy. Một app mở liên tục có thể tạo khoảng 60 lần làm mới query scheduled và 12 lần ping server mỗi giờ; ping gồm ghi timestamp và đọc lại. Realtime listener, message/receipt changes, thiết bị mới và admin queries tạo thêm reads/writes. Bật ngân sách/quota alert nếu chọn plan có billing.

V2 có 20 truyện/200 mục từ/30 quotes; 60 câu hỏi đọc hiểu. 5 truyện V1 giữ nguyên ID. Không chatbot/OCR/speech scoring/push nền. Không tự đồng bộ tiến độ học giữa thiết bị. Không bảo vệ milestone bằng local data. Không hồi phục Auth UID từ backup. Mic/TTS/installability phụ thuộc trình duyệt; cần HTTPS cho mic trên host thật. Web config đã được cập nhật. Kiểm tra cuối ngày 09/10/2026: Anonymous Auth đã cấp UID thành công (lỗi `auth/configuration-not-found` ở lần đầu đã được xử lý phía Console). Firestore REST hiện trả `403 SERVICE_DISABLED`: Cloud Firestore API chưa bật/chưa từng dùng. Vào Firebase Console → Firestore Database → Create database; sau đó cấu hình allowlist và triển khai rules/indexes trước khi dùng thư trên cloud. Kiểm thử cross-device và deep-link trên URL Vercel còn chờ cấu hình/deploy.

Giai đoạn tiếp theo: duyệt ngôn ngữ và audio thu sẵn; link anonymous account; đồng bộ tiến độ; tiến độ tin cậy và milestone unlock phía server; notification sender/push khi cần. Measurement ID được giữ trong cấu hình; app chưa khởi tạo Analytics hoặc gửi sự kiện.

## Tài liệu chính thức

- [Firebase: Rules không phải filter, query phải chứng minh quyền](https://firebase.google.com/docs/firestore/security/rules-query).
- [Firebase: Anonymous Authentication](https://firebase.google.com/docs/auth/web/anonymous-auth).
- [Vite PWA: service worker và manifest](https://vite-pwa-org.netlify.app/guide/).
- [shadcn/ui: cài đặt thủ công và components](https://ui.shadcn.com/docs/installation/manual).
