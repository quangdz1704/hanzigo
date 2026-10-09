# Verification record · 2026-10-09

- `npm install`: completed, lockfile included. No cloud resources created.
- `npm run test`: **49 tests passed**, 5 files. SRS, local-day boundaries, streak/quotes, schema/mappings, IndexedDB persistence, atomic XP, backups, concurrent popup claims, reading-save/completion race and message eligibility.
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

## Suggested regression flow

1. In a fresh local browser profile, complete the reading/review steps above and reload.
2. Repeat completion/quiz and verify XP does not increase again.
3. Send instant and scheduled demo letters; scheduled should not appear before its time. Repeat with Firebase after setup; try querying a future letter in the emulator tests, which must deny.
4. Publish while learner is reading/playing; ensure badge only, then return home or open inbox.
5. Export learning JSON, import twice; counts/XP must remain unchanged. Invalid format must show an error without partial writes.
6. On production preview, load once online, go offline and refresh each learner route. Restore network before testing new letters/TTS.
