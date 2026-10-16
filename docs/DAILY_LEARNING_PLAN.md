# Daily learning and mistake notebook

Scope: a stable plan for each local calendar day (up to five due words, one story, its quiz), plus a notebook of comprehension questions answered incorrectly. Existing SRS and XP rules remain the reward system. Guests use local storage; registered accounts enqueue the same records for private Firebase sync.

1. **Persist learning evidence.** Add additive IndexedDB migrations, validated immutable question-answer history, and a daily plan. Record all answers atomically with the existing quiz result; preserve older backups. Verify wrong/correct retries, account isolation, reload, and backup round trips with unit tests.
2. **Build the notebook.** Group history by question and content version, show explanations after answering, schedule errors after one day and the first correction after three days, and mark two consecutive corrections as learned. Provide Vietnamese/Chinese/pinyin controls and links to the source story. Verify schedule boundaries and updated/deleted content.
3. **Build the daily path.** Freeze the chosen story and due-word IDs on first visit each day. Show actual review/read/quiz completion and the next action, including repeat reading after the library is completed. Verify midnight rollover, repeated submissions, and empty due decks.
4. **Connect cloud and polish.** Extend account merge, migration, backup and owner-only Rules; test across independent authenticated caches and wrong-account denial. Verify desktop/mobile and light/dark layouts in the browser, run the production build and review the diff, then commit verified increments.

Dependencies: evidence before notebook/path; cloud verification after schemas and UI are connected. No new dependencies or production deployment. Production Rules publication remains a separate pending approval from the previous cloud migration; emulator tests must verify the proposed Rules without changing live permissions.

Acceptance: an incorrect story answer appears in the notebook after reload; correction updates its schedule; completed steps remain complete after navigation/account sync; the plan does not select another story immediately after completing it; guest/account data remain separate; studying again does not duplicate existing XP rewards.
