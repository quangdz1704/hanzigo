# HanziGo implementation

Follow the supplied master prompt. Local MVP, no publishing or commits.

1. Foundation: strict React/Vite, accessible application shell, PWA, IndexedDB. Verify build.
2. Reading slice: five original stories, curated glossary, position persistence, sentence audio and comprehension; saving words creates review cards. Verify content schema and browser flow.
3. Practice: deterministic SRS, three authored games, microphone recording. Verify scheduling and idempotent activity rewards.
4. Garden/dashboard: local-calendar streak, 30 stable quotes, growth from meaningful activity. Verify date boundaries.
5. Letters: anonymous learner, separate admin auth, UID allowlist, server-time scheduled access, receipts and composer. Local demo explicitly separate from production authentication. Verify eligibility and deny-by-default rules with emulator.
6. Handoff: validated backup merge, responsive/offline/accessibility checks, setup README. Verify npm test, content validation, production build and representative browser workflows.

Architecture: IndexedDB holds learning progress, deduplicated activities and learner-only cached letters. Firebase has a protected /config/admins allowlist; anonymous /devices identity; /messages with recipientUid, published status and visibleAt; separate per-device receipts. Milestone delivery is explicitly UX-only. No secret content in seed or precache.

Content is original AI-authored draft and requires human Chinese-language review; do not claim certified HSK alignment or editorial approval.
