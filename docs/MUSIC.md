# Góc nghe nhạc

`/music` offers a curated catalog, search by title/artist/pinyin, listening-pace and mood filters, a visible YouTube iframe, previous/next/repeat controls, and a mixed listening queue. Selecting several playlists deduplicates videos before shuffling; ordered playback is also available. The player loads after a listening action and is destroyed when leaving the page. A listening queue can be saved as a personal playlist; unsaved playback itself does not resume on reload.

Personal playlists support YouTube video links, renaming, reordering, removing tracks, and reversible hiding. Each list holds up to 50 validated tracks and 50 KB of metadata. Guests save locally; registered owners sync `users/{uid}/musicPlaylists/{playlistId}` through the existing account cache/outbox. Backups and guest upgrades include playlists. The latest record wins concurrent edits, with deterministic timestamp ties; local mutations use monotonically increasing timestamps. Playlist rows are private to their registered owner, including against administrator reads.

The shared catalog is optional `music` content inside the existing `content/library.raw`. Old libraries remain valid and show the bundled music fallback. An already authenticated allowlisted admin can publish the catalog from the music page; the transaction preserves concurrent story edits. Full-library JSON editing also supports the validated music section. No production library, permissions or deployment were changed during this feature work.

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

- 102 unit tests, 23 Firestore Rules tests, and 5 Auth+Firestore integration tests passed. Coverage includes strict link parsing, mixed-queue deduplication/shuffling, account isolation, backup compatibility, private access and concurrent story/catalog publication.
- Browser: two curated playlists with overlap produced four distinct tracks; saving the mix and adding a URL produced five tracks. Reload retained the list. Guest upgrade carried it to the account; an independent authenticated SDK read confirmed five server-side tracks. Reordering, hiding and responsive editor scrolling worked.
- Responsive QA: 360 px and 390 px layouts had no document horizontal overflow. A 360×640 editor stayed within the viewport and scrolled internally. Both light and dark themes were inspected; `music-player.png` shows an actual Mandarin song playing in the iframe. The existing empty-emulator mailbox warning and installed wallet-extension errors were unrelated to learning/music persistence.
- Production/PWA build passed with the existing chunk-size warning. Production Rules publication and app deployment remain separate pending work.
