# Firebase storage · 14/10/2026

## Current production status

- Target project: `hanzigo-eea7d`; existing native Firestore database was verified, no billing/paid service was enabled.
- `content/library` was initialized successfully from the existing app content: **20 stories / 200 vocabulary entries / 30 quotes / 60 questions**. The script read back and validated the stored library. Existing library data would be preserved instead of overwritten.
- **Production Rules publication is blocked pending user approval.** Automatic review rejected the Rules deployment because the new permissions/actors had not been explicitly confirmed. The active Rules remain unchanged. Until approval/publication, new library/account paths may be denied; the UI keeps local data and shows the sync error.
- Existing message composite index is `READY`, matching recipientUid/status/visibleAt. New raw-field index exclusions are optional optimizations in `firestore.indexes.json`; they were not applied to production.
- Frontend/Vercel deployment was not requested. The updated app works in the workspace; an existing hosted frontend needs the new build to use these flows.

## Storage map and proposed access

| Path                                     | Data                                                                                                        | Access after Rules publication                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `content/library`                        | Published stories, Hanzi/Pinyin/translations, glossary, comprehension quizzes, word-order exercises, quotes | Public get; allowlisted admin create/update; no delete/list                                     |
| `users/{uid}`                            | UID, display name, Auth email mirror, creation/update timestamps                                            | Registered owner reads/writes own validated profile; allowlisted admin can get profile metadata |
| `users/{uid}/progress/*`                 | Reading position, completion, highest quiz score                                                            | Registered owner only                                                                           |
| `users/{uid}/cards/*`                    | Saved words and SRS due dates/intervals                                                                     | Registered owner only                                                                           |
| `users/{uid}/activities/*`               | Unique XP events; streak derived from dates                                                                 | Registered owner only; existing events immutable                                                |
| `users/{uid}/reviews/*`                  | Review history                                                                                              | Registered owner only; existing logs immutable                                                  |
| `users/{uid}/favorites/*`                | Story/quote favorites with explicit inactive values                                                         | Registered owner only                                                                           |
| `users/{uid}/preferences/*`              | Pinyin, translation, sound, font size, theme, quiz display, popup preference                                | Registered owner only                                                                           |
| `users/{uid}/preferences/recipientUid`   | Admin's default letter recipient                                                                            | Owner must also be an allowlisted admin to write                                                |
| `users/{uid}/drafts/*`                   | Private editor drafts, including unfinished JSON                                                            | Owning allowlisted admin only                                                                   |
| `devices/{uid}`                          | Compatibility recipient label/name/email and server clock                                                   | Existing owner/admin access retained                                                            |
| `messages/*`, `devices/{uid}/receipts/*` | Letter body/scheduling and seen/read/heart/favorite state                                                   | Existing private recipient/admin policy retained                                                |
| `config/admins`, `config/settings`       | Admin allowlist and global popup flag                                                                       | Existing policy retained; clients cannot alter allowlist                                        |

Guests keep progress and preferences on the device. Anonymous Auth still supplies a session UID, but new learning/profile synchronization only starts for a registered account. New guest inbox writes are local-only. Published content remains shared; it is not copied once per account. Recorder audio is still temporary on the device, with no upload.

## Offline, migration and conflict behavior

Music uses optional catalog metadata in `content/library.raw.music` and private `users/{uid}/musicPlaylists/{playlistId}` records. Guests retain local lists; registered owners use the account cache/outbox. Hiding is reversible and synchronized as a tombstone. The proposed Rules validate bounded playlist metadata and deny other-account/admin access to personal lists. These Rules were tested locally and were not published to production. See `MUSIC.md` for source availability and player limitations.

Daily learning adds two private owner-only collections: `users/{uid}/studyDays/{localDay}` freezes the chosen story and up to five due vocabulary IDs and stores reading completion; `users/{uid}/quizAnswers/{encodedAnswerId}` stores immutable per-question evidence, grouped by attempt UUID. No extra XP is awarded for notebook practice. Additive IndexedDB migrations and backups include both collections; old backups remain readable. Earlier daily plans win across devices, preserving reading completion for the chosen story. Question content changes start a fresh mistake history; old events remain available in the account backup. These permissions are included in the proposed Rules and have only been tested on the emulator; this feature does not publish production Rules.

- Legacy `hanzigo` IndexedDB remains the guest cache. Registered users have separate `hanzigo-account-{uid}` caches and persistent outboxes. A signed-in account's cache is never copied into another account.
- Old browser learning data is claimed once by the first account after this migration. Linking a current guest into a new registered account carries its learning forward. Guest data is retained. Historical browser-only data had no owner UID, so this one-time claim represents the current browser's migration, not proof of past ownership.
- Migration only initializes missing cloud preferences; it does not replace settings already saved by an existing account with guest defaults. Explicit edits remain queued by account UID, including through reload.
- Progress keeps completed=true and the highest quiz result even when an older browser sends its position later. Unique activity IDs prevent duplicate XP. Mutable rows choose the latest client updatedAt; exact timestamp ties choose a deterministic record. These are learning UX records, not trusted evidence for financial rewards or secure milestone unlocks.
- Listener replies, queued writes, preference hydration and imported backups stay associated with their original account, even if the user switches accounts while work is in flight.
- Library content is validated before publication and on receipt. An atomic transaction merges a single story into the latest library so two editors updating different stories do not discard each other's work. The published library is stored as validated JSON (800 KB UTF-8 cap); larger libraries need sharding. Cached cloud content and bundled content provide offline/failure fallback.
- Private editor drafts stay separate from the public library until the admin publishes. Draft cache and legacy default-recipient migrations are claimed once by the first authenticated editor; an existing cloud default is preserved.

## Initialization and rollback

`npm run firebase:seed -- --project hanzigo-eea7d` uses the existing Firebase CLI session on the trusted developer machine. No tokens/service-account keys enter source, frontend bundles, or backups. It creates `content/library` only if absent, using an atomic exists=false precondition; if the library exists it validates and preserves it. CLI updatedBy is a generic bootstrap marker.

Active production Rules were backed up locally at `/tmp/hanzigo-cloud-predeploy-rules.json`; existing indexes at `/tmp/hanzigo-cloud-predeploy-indexes.json`. The Rules backup contains the previous ruleset name and source. No existing user/message records or allowlist entries were changed. Rollback of a future approved Rules release restores that source and redeploys only Rules; preserve library/account documents rather than deleting data.

## Verification

Unit tests cover namespaced caches, guest migration/outbox persistence, stale preference activation, record merges and library format. Firestore emulator tests cover public published content, private account data, anonymous/wrong-account denial, role/extra-field validation, progress non-regression and private editor drafts. Two authenticated SDK sessions verified realtime progress/preferences, persisted unsent changes, migration preference priority and duplicate-XP prevention. Browser checks verified login/settings restoration, draft saving, publication into the learner library, completion after reload, and an uncompleted separate guest state after logout. A fake inbox letter was received and acted on through the same Firebase flow. Screenshots use demo data only.
