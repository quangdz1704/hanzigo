# Verification record · 2026-10-09

- `npm install`: completed, lockfile included. No cloud resources created.
- `npm run test`: **54 tests passed**, 6 files. SRS, local-day boundaries, streak/quotes, schema/mappings, IndexedDB persistence, atomic XP, backups, concurrent popup claims, reading-save/completion race, message eligibility and account validation.
- `npm run content:validate`: 20 original draft stories, 30 quotes, 200 vocabulary entries. Structural validation passes; human language review remains required.
- `npm run test:rules`: **14 tests passed** against local Firestore emulator / demo-hanzigo with Java 21. Includes exact server-bound due query, immediate published listener query, future query denial, wrong-recipient and unauthenticated access denial, admin CRUD, allowlist protection and receipts.
- `npm run build`: strict TypeScript and production Vite/PWA build completed. Generated service worker, manifest and local fonts/icons. Admin route code excluded from precache; Firestore content is never precached.
- Chrome browser flow: reader → curated word lookup → save word → finish story → 3/3 quiz → SRS review → reload. Saved word and due status persist; XP/progress update.
- Chrome local admin demo: unauthorized `/admin` redirects to `/admin/login`; explicit demo session → composer preview → publish → inbox → heart/favorite/read → reload. Receipts persist and dismissed letters do not auto-open again.
- Deferred popup: new demo letter stays hidden in `/stories/bookshop`, then opens on returning to `/`. Automatic delivery verified after correcting a stale local clock tick.
- Games: matching all five pairs and authored sentence order completed through UI, correct results and rewards shown.
- 360px: Home and all eight core reader/library/review/game/garden/inbox/settings/composer routes checked; document scrollWidth == 360, no horizontal overflow.
- Production PWA cache: loaded on :4173, then stopped the preview server; curl confirmed connection failure. A previously unvisited `/stories/balcony` rendered from service-worker cache. Saved `阳台`, completed the story, opened `/review`, rated the card, reloaded, then opened `/garden`; persisted state showed 1 story, 1 saved word, 2 activities and 35 XP while the server remained unreachable.
- 1440px: dashboard and game layout checked, no horizontal overflow; light/dark theme tested. Default viewport restored. `dashboard.jpg` is the finished 1440px capture.

## V2 additions verified

- Project config: all seven public web fields present in ignored `.env.local`, emulators false, `.firebaserc` selects `hanzigo-eea7d`. No Analytics events initialized.
- Real Firebase request: initial `auth/configuration-not-found` resolved during this session; learner now has a real anonymous UID. Firestore unauthenticated diagnostic GET returns `403 SERVICE_DISABLED` (API not enabled). App shows mailbox unavailable while local learning remains usable. Admin login/cloud delivery is not claimed verified.
- Content: 20 stories, 200 vocabulary entries, 60 comprehension questions. IDs of the original five stories retained. Structural/tone tests pass; editorial status remains draft.
- Editor in isolated demo origin :5182: guard redirects before login; form and JSON modes; empty title disables preview/export; save and reopen; incomplete JSON survives reload and blocks export; copy generates valid fresh references; reader preview and glossary render; preview cannot save vocabulary or record XP.
- Export/merge functions tested for existing-ID updates, new-story insertion, cross-story collisions and malformed input. Full-library CLI import completed using current seed. Browser download-event inspection timed out; file-download behavior remains a manual browser check.
- Review: adding ten terms from a selected story immediately creates ten due cards; ratings show 10 minutes/1/3/7 days; rating Good reduces due count to nine; reload retains cards and rating. Search `zhongzi` finds `种子`; accentless `chuyen di` finds both matching story titles.
- 360px: review and editor have no horizontal overflow; preview dialog width 328px. Desktop library at 1728px contains 20 cards and no horizontal overflow; editor at 1440px also has no overflow. V2 screenshot: `v2-library.jpg`.
- Latest build and 14 local Firestore emulator tests passed. Admin and AdminContent chunks both excluded from PWA precache. Offline server-stop check above was performed on V1; V2 artifacts retain the same PWA architecture and bundle all twenty stories.

## Checks requiring a configured environment or device

- Cloud Google/email admin login and actual cross-device realtime delivery: web config now present; Anonymous provider now works; still requires Firestore database/API, Google/email admin provider, admin UID allowlist and deployed rules/index.
- Vercel direct deep-link refresh on a hosted URL: configuration supplied, no deployment requested or performed.
- Physical-device installation, mic permission/recording and speech output: browser/device dependent. Unsupported paths show truthful messages; no fake scoring. Microphone permission was not requested during browser smoke testing.
- Browser `navigator.onLine` banner and real device airplane-mode behavior: cache operation was verified with the production server unreachable, rather than changing the user's system network. Online-only audio and cloud delivery still require device-specific checks.

## Account registration additions verified · 2026-10-09

- `/register`, `/login`, `/forgot-password` and `/account` routes added with Settings/sidebar entry points; public signup grants no admin role.
- **7 Auth emulator integration tests passed**: concurrent anonymous requests share one UID; linking email preserves UID; login restores UID on another Auth instance; logout creates a new guest; duplicate-email failure preserves the guest; invalid input/wrong password are rejected; learner/admin sessions remain independent; verification/reset action codes work end to end. All accounts/email delivery stayed within the local `demo-hanzigo` emulator.
- Unit coverage includes password confirmation, credential error sanitization, preserving password spaces, rejecting invalid production password policy and propagating policy network failure. Emulator does not implement `getPasswordPolicy`; production validation is always used outside the emulator.
- **14 Firestore rule tests passed again**; non-admin, wrong-recipient, future-letter and allowlist protections remain in place. Strict TypeScript and production/PWA build passed after account edits.
- Real-config Chrome checks: Settings account section, registration/login/reset navigation, required email field and show/hide password. Registration and login have document width **360px** at a **360px** viewport. Real guest UID remained unchanged throughout UI inspection; no production account was created or real verification/reset email requested.
- Screenshot export and final viewport cleanup were interrupted by browser connection loss, then automatic approval review failed because its transport disconnected. No screenshot artifact is claimed. Cloud signup still needs Email/Password enabled; actual email delivery and signed-in account UI remain manual checks using the user's own account.

## Admin access diagnostics · 2026-10-13

- Fixed misleading admin denial: errors from reading `config/admins` no longer set `adminDenied`; separate `adminCheckError` explains permission rejection, connectivity and expired/invalid authentication. A failed check never grants access.
- Added admin UID copy, exact document/field setup guidance and a reload button to recheck permission after Console changes. No cloud allowlist or Rules were modified.
- Unauthenticated REST diagnostic for `config/admins` now returns `403 PERMISSION_DENIED`, not the earlier `SERVICE_DISABLED`. This confirms an API response only; it does not establish membership of the UID shown in the user's screenshot.
- Added four regression tests for permission error wording, transient connectivity, session recovery and sanitization. **58 unit tests passed**; strict TypeScript and production/PWA build passed.

## UI spacing and theme review · 2026-10-13

- Replaced green-tinted dark page/card backgrounds with warm charcoal (`#1c1b1a` / `#252422`); green remains an accent. Added theme-specific button foreground, lavender/peach text and neutral overlays. Book/travel/home/friends illustration panels now follow dark theme tokens. Fixed the undefined account notice background token.
- Reproduced a **0px** gap between review filters and tabs; browser measurement after the fix is **20px**. Account forms now use a **20px** grid gap. Editor heading/select spacing is **16px**, form field grid gap is **20px**; settings action/help copy and composer note/following field now have explicit separation.
- Reader toolbar controls have **40px** height on mobile. Admin navigation uses wrapping links with padding and larger text; logout stays beside the admin label above the mobile navigation. Admin permission notice uses a spaced grid with grouped actions; cloud permission changes were not made.
- Found the generic Radix description selector also matched dialog titles, shrinking the vocabulary heading. Scoped it to description elements; actual word title is now **44.8px** in the browser. Popup open/close and desktop editor preview were checked after the change.
- **360px** dark learner checks: stories, reader, vocabulary/review, games, garden, inbox, settings and registration had no document horizontal overflow. Separate demo origin :5183: light composer/editor checked at 360px; dark composer/editor and preview checked at 1440px. Composer also checked at 768px; main settings/registration checked in light mode at 768px. Preview only; no draft or message was published.
- Supporting text contrast calculations against the card surface: **4.81:1 light**, **7.31:1 dark**; primary button text **6.39:1 light**, **8.48:1 dark**. These are token calculations, not a claim of a complete accessibility audit.
- **58 unit tests passed**; strict TypeScript and production/PWA build passed. No CSS-only tests added. Viewport override reset; main dashboard left open with the revised dark theme. Screenshot: `ui-dark-dashboard.png`.

## Learner Google sign-in · 2026-10-13

- Added **Tiếp tục với Google** to `/register` and `/login`, above the email form; reset-password route stays focused on email recovery. Uses learner Auth; the existing admin Google login remains separate.
- Popup starts from the click without awaiting background initialization. New Google identity links to the guest UID. A credential/email collision with a recoverable Google credential signs into the existing account; a changed session or cancellation does not trigger this fallback. No guest account is deleted and no private letters are merged between UIDs.
- **67 unit tests passed**, including nine Google popup-flow tests: synchronous launch, new-account sign-in, credential/email collisions, cancellation, missing credential, concurrent identity change, registered-account guard and setup error messages.
- **10 Auth emulator integration tests passed**. Added real SDK/local-server Google credential checks for guest UID preservation, sign-in on another Auth instance, collision handling and matching verified Google email/password account UID. Fake unsigned Google ID tokens are used only inside `demo-hanzigo`; no Google or production Firebase accounts were created.
- Strict TypeScript and production/PWA build passed. Chrome confirms Google button enabled after guest initialization on both account routes; no horizontal overflow at **360px** or **1728px**. Viewport reset. Screenshot: `google-registration.png`.
- Real Google OAuth/account selection was not completed. Requires Google provider enabled, authorized hostname and actual user sign-in. Popup transport is mocked in unit tests; Firebase credential processing uses the real SDK and local Auth emulator.

## Quiz language toggles · 2026-10-13

- Added independent persisted **Chữ Hán / Pinyin / Tiếng Việt** display preferences for quiz prompts, options and explanations. At least one language stays enabled; Vietnamese-only legacy imports remain readable. Reader controls retain their separate preferences and stop sticking at the end of the reading area.
- Added complete `chinese` data for all **60 questions / 180 options / 60 explanations** across 20 stories. Parsed data comparison with a pre-change snapshot confirms original IDs, Vietnamese content and answer indexes unchanged. Used temporary pypinyin 0.55 tooling to assist accented pronunciation, then adjusted selected polyphonic/contextual readings, light tones and 一/不 pronunciations; no runtime dependency or remote conversion. Editorial review status remains draft.
- **74 unit tests passed**. New coverage: preference migration, last-language guard, all seven nonempty combinations, legacy fallback, all seeded translations, missing Pinyin/misaligned options rejection and copy/export/import preservation. `content:validate` and strict TypeScript/production/PWA build passed.
- Chrome, isolated demo :5185: select answer → hide Pinyin and Vietnamese → selected count stays one → complete Chinese-only quiz → **3/3** → re-enable Pinyin → all three selections remain checked and all nine radios stay disabled. Explanations follow the toggles. Reload retains language settings.
- Main UI separately verified Pinyin-only (12 Pinyin lines, zero Chinese/Vietnamese quiz lines), Vietnamese-only, and restored all three without submitting scores. Demo scoring does not change main-origin quiz scores. Light quiz at **360px** and dark quiz at **1728px** have no horizontal overflow; viewport reset.
- Editor at 360px exposes translated prompt/options/explanation fields. Clearing question Pinyin disables preview and reports its exact path; restoring it re-enables preview. Editor preview displays the translated correct answer and explanation. No draft/message was published.
- Screenshot: `quiz-languages.png`; main app left open at `/stories/rainy-cafe#quiz`. Mobile physical-device behavior and human language review remain outside this local check.

## Suggested regression flow

1. In a fresh local browser profile, complete the reading/review steps above and reload.
2. Repeat completion/quiz and verify XP does not increase again.
3. Send instant and scheduled demo letters; scheduled should not appear before its time. Repeat with Firebase after setup; try querying a future letter in the emulator tests, which must deny.
4. Publish while learner is reading/playing; ensure badge only, then return home or open inbox.
5. Export learning JSON, import twice; counts/XP must remain unchanged. Invalid format must show an error without partial writes.
6. On production preview, load once online, go offline and refresh each learner route. Restore network before testing new letters/TTS.

## Account name synchronization · 13/10/2026

- `npm test`: **79 unit tests passed**; profile cases cover server-name priority, typing during an in-flight write, offline pending edits/retry, stopped callbacks and separation of guest/account A/account B names.
- `npm run test:rules`: **17 tests passed** with Firestore emulator. Added own profile metadata, Auth-token email matching, wrong-account/admin edit denial, name length/extra-field validation and migration from anonymous legacy device documents.
- `npm run test:profiles`: **1 integration test passed** with both Auth and Firestore emulators. Actual guest upgrade triggered `onIdTokenChanged`; two independently authenticated SDK sessions restored the same UID/name and received a name change realtime. Device `createdAt` and UID stayed unchanged, email/label were populated.
- Browser against `demo-hanzigo` emulators: login loaded server name; Settings edit showed pending then synced; reload restored `Mai Anh`; allowlisted admin saw the same name/email/UID. Admin page had no horizontal overflow at 360px. Screenshots: `account-profile.png`, `account-recipients.png`. No application console errors; installed wallet extensions emitted unrelated provider-injection errors.
- Production/PWA build passed. No Firebase production records, credentials, allowlist or Rules were changed. The new `firestore.rules` must be published to `hanzigo-eea7d` before cloud metadata sync works. Learning progress and other reading preferences remain local.

## Sidebar on short screens · 14/10/2026

- Fixed sidebar now uses the visible viewport height (`100dvh`, with `100vh` fallback), scrolls vertically when content is taller, and keeps child sections from shrinking together. Overscroll is contained within the sidebar.
- Browser checks at desktop 1280×500 and mobile menu 390×480 reached the bottom account/settings links with keyboard scrolling while the main page stayed at scrollY=0. Screenshot: `sidebar-short-screen.png`. Temporary viewport override was reset after testing.
- Production/PWA build and all 79 unit tests passed. No cloud configuration changes.
