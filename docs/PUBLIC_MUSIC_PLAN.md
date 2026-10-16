# Shared music and Firebase plan

Use the existing account outbox for private playlists and an atomic public projection for community discovery. Private is the default, including legacy rows. Public documents contain the playlist, owner UID and display name; email and learning data remain private. Only the owner can edit or revoke a shared playlist. Everyone, including guests, can read public playlists. Revoking public visibility removes its public projection in the same transaction that updates the owner's private record.

1. Import the supplied NHẠC HOA playlist: preserve 52 visible video IDs/titles/channel credits, source URL and creator. YouTube reports four unavailable entries; do not fabricate those. Support up to 100 tracks within the existing 50 KB playlist size. Verify schema, references and legacy library compatibility, then commit.
2. Add private/public persistence and secure community reads. Keep old private rows compatible, preserve visibility when adding/reordering/hiding, and prove owner isolation, unpublish, stale updates and spoof protection in emulator tests. Public publication uses the owner's server profile name and never exposes email. Commit after checks.
3. Add visibility controls, creator credits, paginated community playlists, search inclusion and visible Firebase save/retry status. Guests can listen and save locally, and need an account to publish. Verify private/public transitions across two users plus a guest, reload and mobile layout. Commit after checks.
4. Audit deployed Firebase data/Rules, publish the reviewed required Rules and import only the new supplied catalog without overwriting stories or user content. Confirm the persisted catalog and relevant Rules. If release is blocked, report the exact blocker; do not claim cloud persistence is live. No app hosting deployment or git push is included.

## Release verification and rollback

Verified before cloud changes: 104 unit tests, 26 Rules tests, 6 Auth/Firestore integration tests and strict TypeScript/PWA build. Browser evidence confirms source playlist credits, share-link entry, real emulator readback of the canonical user profile and both playlist records, guest visibility without edit controls, and 390 px layout without horizontal overflow. Rules use `getAfter` to require matching private/public writes in one transaction.

The Firebase release adds owner-only music/daily-plan/quiz-history records and public read access only to explicit public playlist projections. Existing profile and learning ownership rules remain. Imported catalog writes use the current library updateTime as a concurrency precondition and verify non-music content afterward. Before applying, read-only audit found 20 stories, no music section, no `users` profile documents, and deployed Rules without the three new learning kinds. Account profile creation remains tied to the learner's next login; do not fabricate names or backfill private Auth accounts into public documents.

Rollback: retain the previous deployed Rules in `/tmp/hanzigo-deployed.rules` before release, and the previous public library snapshot in `/tmp/hanzigo-library-before-music.json`. Restore only after inspecting current data; never roll back the whole library over later story edits. Reverting the app UI does not delete private account records. Public sharing can be revoked through the normal playlist visibility control.

## Completed

All four steps completed on 16 October 2026. Production Rules/indexes deployed successfully; audited Rules exactly match the reviewed source. The trusted catalog import read back 60 tracks/five playlists and preserved 20 stories. Unauthenticated production SDK reads confirmed catalog/public access and private denial. Browser UI verified publication, creator credits, guest visibility, revocation, guest restrictions and mobile scrolling. No production test accounts/user playlists/messages were created. Frontend hosting and git push remain outside this change.
