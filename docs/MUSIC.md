# Góc nghe nhạc

`/music` offers a curated catalog, search by title/artist/pinyin, listening-pace and mood filters, a visible YouTube iframe, previous/next/repeat controls, and a mixed listening queue. Selecting several playlists deduplicates videos before shuffling; ordered playback is also available. The player loads after a listening action and is destroyed when leaving the page. A listening queue can be saved as a personal playlist; unsaved playback itself does not resume on reload.

Search covers the shared catalog and all active personal playlists, deduplicated by video ID. It accepts Chinese, Vietnamese and pinyin, with or without accents, and matches multiple words in any order. Pace and mood filters include uncategorized personal tracks. An empty result shows “Không tìm thấy bài hát phù hợp”, a reset action and “Tìm trên YouTube”. That link opens a new tab with the original trimmed query safely URL-encoded; a blank query defaults to “nhạc tiếng Trung”. Searches run locally; YouTube is opened only when the user follows the link.

Personal playlists support YouTube video links, renaming, reordering, removing tracks, and reversible hiding. Each list holds up to 100 validated tracks and 50 KB of metadata. Guests save locally; registered owners sync `users/{uid}/musicPlaylists/{playlistId}` through the existing account cache/outbox. Backups and guest upgrades include playlists. The latest record wins concurrent edits, with deterministic timestamp ties; local mutations use monotonically increasing timestamps. Owner records remain private, including against administrator reads. A playlist defaults to private; registered owners can explicitly publish a separate public projection to `publicMusicPlaylists/{uid}_{playlistId}`. It contains only the owner UID, profile display name and playlist metadata. The owner record and public projection are updated atomically; private visibility or a hidden list removes the public copy. Guests can read public lists but cannot publish, edit or read private account lists. The public author name is checked against the owner's server profile. It is the display name at the latest playlist publication; a later profile rename appears on the next playlist edit.

The shared catalog is optional `music` content inside the existing `content/library.raw`. Old libraries remain valid and show the bundled music fallback. An already authenticated allowlisted admin can publish the catalog from the music page; the transaction preserves concurrent story edits. Full-library JSON editing also supports the validated music section. The initial music work did not publish production Rules. The follow-up audit found that deployed Rules lacked music/daily-plan/quiz-history support and the shared library had no music section; see `PUBLIC_MUSIC_PLAN.md` for the scoped release and verification.

## Imported NHẠC HOA playlist

On 16 October 2026, the [user-supplied public playlist](https://www.youtube.com/playlist?list=PLZtL-wUb5dUqGjUKTSzOPAMR7g3Dl7X4l) showed 56 total videos with four unavailable entries hidden. The app imports all 52 visible video IDs, original titles and channel credits, plus creator “Thế Quang Nguyễn” and a source link. This is a dated snapshot, not automatic YouTube playlist synchronization. No unavailable entries, pinyin or performer names were invented. Imported channel credits are explicitly labeled “Kênh”; listeners can enter a singer/channel credit for their own shared video links.

The catalog now has 60 unique videos and five suggested playlists. Song results render 24 at a time; public discovery subscribes to 24 playlists at a time with a load-more action. Search includes personal and loaded public tracks and can filter by source. Listening queues and personal playlists are limited to 100 videos; a chosen song starts within its group of at most 100. Private/public visibility survives add, reorder, rename, hide, restore, backup, guest upgrade and outbox sync. Firebase status and retry controls are visible on the music page.

Run `node --import tsx scripts/publish-music-catalog.ts --project hanzigo-eea7d` to preview the catalog merge; append `--apply` to publish. The CLI uses existing credentials only in memory, retains non-music content, preserves existing editorial tracks/lists, refreshes the explicitly requested source playlist and rejects concurrent library changes with an updateTime precondition. No client credential or Admin SDK key is embedded.

## Sources and playback limits

Metadata for these eight suggestions was checked with YouTube's public oEmbed endpoint on 16 October 2026:

- [你好歌, Hello Song — Little Fox Chinese](https://www.youtube.com/watch?v=m_rDIzj6DRE)
- [Greetings — Chinese Buddy](https://www.youtube.com/watch?v=0fm11XFw8uY)
- [月亮代表我的心 — Teresa Teng / Universal Music topic channel](https://www.youtube.com/watch?v=eOtATMfvfg8)
- [童話 — Michael Wong / ROCK RECORDS](https://www.youtube.com/watch?v=bBcp_ljCBGU)
- [朋友, graduation version — Wakin Chau / ROCK RECORDS](https://www.youtube.com/watch?v=dUgw9i7xWlE)
- [小幸運, official live — Hebe Tien / HIM International](https://www.youtube.com/watch?v=CFTZSSJyy7A)
- [告白氣球 — Jay Chou](https://www.youtube.com/watch?v=bu7nU9Mhpyo)
- [知足 — Mayday / ROCK RECORDS](https://www.youtube.com/watch?v=_o0oeyCtoFA)

Title pinyin, Vietnamese title meanings and listening tips are editorial metadata; no song lyrics or audio files are copied into the app. Pace labels are suggestions rather than HSK classifications. Videos can change availability, embedding policy or regional restrictions independently of the app. oEmbed metadata availability does not guarantee playable embedding.

The implementation follows the official [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) and [player parameters](https://developers.google.com/youtube/player_parameters). Player frames remain visible and at least 200 px high, retain native controls, use the app origin, and retain a Referer. Autoplay blocking prompts a native Play action. Errors 100/101/150/153 show a clear fallback to the video's canonical YouTube URL; restrictions are not bypassed.

During local browser QA, both songs in “Chào bằng một bài hát” played in the visible iframe. The first song ended and automatically advanced to the second. The official API sample video also played successfully. The mainstream music MVs tested returned YouTube embedding-denied errors in this local environment; the app displayed the fallback and switched queue items correctly. Their full playback was not verified. Recheck these music sources on the deployed origin before presenting them as guaranteed embedded playback.

## Verification

Search follow-up: 103 unit tests and production/PWA build passed. Browser QA matched “teng anh trang” to Teresa Teng and “hao ni” to 你好歌. A locally saved personal song was found with the uncategorized/personal filters and disappeared after hiding its playlist. An unmatched “晴天 周杰伦” displayed the empty state; clicking the YouTube action opened a new tab whose search field contained that exact query and rendered search results. Reset restored the catalog. The 390×740 layout had no horizontal overflow. Screenshots: `music-search.png` and `music-search-mobile.png`.

- 103 unit tests, 23 Firestore Rules tests, and 5 Auth+Firestore integration tests passed. Coverage includes strict link parsing, mixed-queue deduplication/shuffling, account isolation, backup compatibility, private access and concurrent story/catalog publication.
- Browser: two curated playlists with overlap produced four distinct tracks; saving the mix and adding a URL produced five tracks. Reload retained the list. Guest upgrade carried it to the account; an independent authenticated SDK read confirmed five server-side tracks. Reordering, hiding and responsive editor scrolling worked.
- Responsive QA: 360 px and 390 px layouts had no document horizontal overflow. A 360×640 editor stayed within the viewport and scrolled internally. Both light and dark themes were inspected; `music-player.png` shows an actual Mandarin song playing in the iframe. The existing empty-emulator mailbox warning and installed wallet-extension errors were unrelated to learning/music persistence.
- Production/PWA build passed with the existing chunk-size warning. The subsequent public/private music release published production Rules and the catalog; app hosting deployment remains separate.

## Public/private follow-up verification

104 unit tests, 26 Rules tests and six Auth/Firestore integration tests passed, plus strict TypeScript/PWA build. Rules checks cover atomic publication/revocation, private ownership, anonymous publication denial, author/content spoofing and email-field rejection. Integration checks include an older offline public edit failing to undo a newer private change and durable public outbox replay. Browser registration created a real emulator profile with name/email; an independent SDK confirmed both private owner data and the public projection without email. A guest saw the public list without edit controls; switching back to private removed it on the server and from the guest UI. A 390×740 editor measured 354×698 with internal scrollHeight 1218 and no horizontal overflow. Screenshots: `music-public-desktop.png`, `music-public-mobile.png`.

The implementation follows Firebase's [atomic Rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) and [realtime listener metadata](https://firebase.google.com/docs/firestore/query-data/listen). All test accounts and personal playlists used demo emulators, not production.

Production release on 16 October 2026: Rules and indexes deployed; source readback matches `firestore.rules`. The catalog was published and verified with 60 tracks/five playlists while preserving 20 stories. An unauthenticated SDK read the 52-track source playlist and public collection, and private reads were denied. No production user profiles or private/public test playlists were fabricated; profiles populate when real learners log into the updated app. Frontend hosting and git push were not performed.

## Canonical Firestore collections · cloud-first follow-up

The catalog's canonical storage is now `musicTracks/{videoId}`, `musicPlaylists/{slug}` and the active revision/ID manifest at `musicCatalog/current`. Production contains 60 tracks and five lists; music was removed from `content/library.raw`. Opening `/music` lazily subscribes to the manifest and performs two bounded revision queries. All rows and reference IDs are validated before display; old asynchronous replies cannot replace a newer revision. Cloud mode does not use the bundled music seed or write a music catalog to IndexedDB. Invalid/missing Firebase catalog state shows an explicit error/retry rather than silently showing local song data. Offline playback still requires YouTube connectivity.

`publishMusicCatalog` now writes the normalized catalog atomically. `publishLibrary` accepts legacy optional music imports, writes normalized music in the same transaction, and retains only story content in the library document. The trusted migration script supports `--profiles` for missing registered Auth profiles, avoids overwriting existing profiles, and uses optimistic preconditions for all production writes. Preview after migration reported zero writes.

Verification: 109 unit tests, 27 Rules tests and seven Auth/Firestore integration tests passed, including normalized publication/public reads and cache recovery without losing unsent changes. The actual user's localhost app reports “60 bài · 5 playlist gợi ý. Đã tải từ Firebase.” An unauthenticated production SDK confirmed the 60 tracks/five lists, all 52 source entries, preservation of 20 stories, removal of legacy music JSON and denial of access to both real profiles. Settings reports 183 KiB story cache with a 512 KiB cap. Screenshots: `firebase-music-collections.png`, `cloud-storage-cache.png`.
