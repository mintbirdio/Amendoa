# PRD — Reply-in-Amendoa + Sent-Reply Log (Step 1)

Status: **draft v1** — written after a failed first implementation. Intent: re-spec the feature clearly so an alternative approach can be evaluated.

---

## 1. Background

Amendoa scores X (Twitter) timeline tweets and surfaces a "reply queue" of high-opportunity tweets. Today the user still clicks a tweet, leaves Amendoa, goes to X's UI, replies, comes back. There is no structured history of what the user replied to, what they said, or how it performed — which blocks every future phase (voice learning, performance analytics, outcome polling, AI drafting).

The long-term goal is an audience-growth OS for reply-guy strategy. This feature is the **foundational plumbing** for that: make replying a first-class action inside Amendoa and capture every reply as structured data.

## 2. Users

Single user persona for now: **Pedro**, the Amendoa owner. Desktop Chrome only. Authenticated to X. Uses Amendoa daily for queue-driven replies.

## 3. Goals

1. Reduce friction of replying to a queue item (fewer clicks, cursor ready in the right place).
2. Log every sent reply with enough context to drive future features:
   - Original tweet (id, author, content, timestamp, author follower count at reply time)
   - Our reply (id, full text, send timestamp)
   - Source (`amendoa` if initiated from our sidebar, `native` if sent via X's own UI)
   - Placeholders for outcome tracking (likes, reply-backs, author-liked, author-replied)
3. Surface that log in a **Sent** tab so it's visible, navigable, shareable.

## 4. Non-goals (explicit — do not build)

- AI draft generation
- Voice/style learning
- Outcome polling (fields exist as placeholders only)
- Auto-send / scripted submission of the Post button
- Mobile / X mobile web / X native app support
- Quote-tweet, retweet, DM flows
- Multi-account support

## 5. Constraints

- **No X API.** Too expensive; we work off what the content script already sees.
- **ToS-defensible.** We may pre-fill the composer (like a password manager). We may NOT programmatically click the Post button. The user always completes the send manually.
- **Desktop Chrome only.** No cross-browser targets this phase.
- **Privacy.** Everything local to IndexedDB (via Dexie). No telemetry beyond what already exists.
- **Shadow DOM isolation.** The sidebar lives in a Shadow DOM; our CSS/events must not leak or be leaked into.
- **Don't break existing flows.** Scoring, badge injection, target list, gamification, native reply detection must all continue working.

## 6. User stories

1. **As Pedro**, when I see a high-scored tweet in the Amendoa queue, I want to click one button and be reading the reply composer with the cursor already in the text field, so I can start typing immediately.
2. **As Pedro**, after I send any reply on X (whether I started it from Amendoa or used X's native UI), I want a structured record written to Amendoa, so I can see my history and build analytics later.
3. **As Pedro**, I want to open a Sent tab in Amendoa and see the last N replies I sent, newest first, with the original tweet, my reply, the author, the age, and whether it went via Amendoa or natively.
4. **As Pedro**, if anything in the flow breaks (X DOM changes, composer doesn't appear, focus fails), I want a visible diagnostic so I know what went wrong instead of silently losing data.

## 7. Functional requirements

### 7.1 Reply button on each queue card
- Every opportunity card in the reply queue must have a primary action button labeled "Reply" with a send icon, clearly distinct from a secondary "Jump to tweet" icon.
- Clicking the Reply button initiates the reply flow (7.2 – 7.5).

### 7.2 Open X's compose box for the target tweet
- If the user is already on the target tweet's status page: open X's inline compose modal for that tweet.
- If the user is on any other page: navigate to the target tweet's status page first, then open the compose modal after navigation settles.
- The mechanism must be resilient to X DOM changes (selector changes / markup refactors) — degrade gracefully with at least one fallback.

### 7.3 Pre-fill the compose textarea
- A "prefill" entry point must exist in code, accepting a draft string.
- In this phase, draft is always `""` (empty). The entry point must work end-to-end anyway so later phases (drafting) can pass a real string with no plumbing changes.
- Pre-filling must correctly update the composer's internal state so X's own "Post" button enables when the draft is non-empty.

### 7.4 Focus the textarea
- After the composer opens, the textarea (or the caret inside it) must be focused such that the user can start typing immediately without clicking.
- Focus must survive X's modal-opening animations and React focus management.
- If focus cannot be established within a reasonable budget (e.g. 1 second), the flow must still leave the composer open and not throw.

### 7.5 Detect send, write structured log
- When any reply is sent (via Amendoa's flow OR via X's native UI), a log row is written to IndexedDB.
- Detection mechanism: reuse the existing XHR/Fetch interceptor that already captures `CreateTweet` GraphQL mutations. No additional network plumbing.
- Writes are idempotent (same replyId → one row), even if detection fires twice.
- Side effects (XP, gamification) fire at most once per unique replyId.

### 7.6 Source attribution
- If the user initiated the reply via Amendoa's Reply button, the log row must be tagged `source: 'amendoa'`.
- If the reply was sent via X's native UI (user ignored Amendoa's button for this one), the row must be tagged `source: 'native'`.
- Attribution must survive an SPA navigation between Amendoa's button click and the actual send.

### 7.7 Sent tab UI
- Sidebar has two tabs: Queue (existing) and Sent (new), switchable.
- Sent tab lists the last 50 replies, newest first, live-updating as new ones log.
- Each row shows: author handle, age, `via Amendoa` / `native` badge, original tweet snippet (1 line), user's reply (2 lines), link to open the reply tweet in a new tab.
- Empty state: clear copy telling the user what to do.
- Optional summary line: total count, split by source.

### 7.8 Diagnostics surface
- A small visible status line (bottom of Sent tab or similar) exposes the last reply-flow attempt: did the status page load, did the composer mount, did prefill succeed, did focus succeed, was any fallback used.
- Zero noise in the console during happy-path usage. Errors and fallbacks log explicitly with the prefix `[Amendoa]`.

### 7.9 Migration
- Existing `ourReplies` rows (from prior Amendoa versions) must migrate cleanly. All new fields must default to safe values (`source: 'native'`, placeholders zero/empty/null). A one-shot smoke test proves the migration against a seeded DB.

## 8. Data model

```ts
interface OurReply {
    replyId: string;                    // PK
    inReplyToTweetId: string;
    inReplyToHandle: string;
    repliedAt: number;
    content: string;

    source: 'amendoa' | 'native';
    originalTweetContent: string;
    originalPostedAt: number;
    authorFollowerCountAtReply: number;
    draftText: string;

    // Outcome placeholders — not populated this phase
    likesReceived: number;
    repliesReceived: number;
    gotAuthorReply: boolean;
    authorReplyTimestamp: number | null;
    authorLiked: boolean;
    lastPolledAt: number | null;
}
```

Indexes: `replyId` (PK), `inReplyToHandle`, `repliedAt`, `source`.

## 9. Acceptance criteria

| # | Criterion | How to verify |
|---|---|---|
| A1 | Clicking Reply on any queue card opens X's compose modal for that tweet within 3 seconds, on timeline, home, or status pages. | Live test. |
| A2 | The compose textarea is focused — cursor is inside it, no extra click needed — by the time the modal finishes animating. | Live test. |
| A3 | When Reply is initiated from Amendoa and the user clicks X's Post, a row is written to `ourReplies` with `source === 'amendoa'`, correct `replyId`, `inReplyToTweetId`, non-empty `content`, non-null `originalTweetContent` and `authorFollowerCountAtReply` snapshots. | DB inspection. |
| A4 | When the user replies via X's native UI (no Amendoa button click), a row is written with `source === 'native'` and the other fields populated correctly. | DB inspection. |
| A5 | The Sent tab lists the last 50 rows newest first, updating live as new rows write. | Live test + DB write. |
| A6 | The diagnostic status line reflects the last attempt with correct selectors used / focus/prefill results. | Live test. |
| A7 | Existing Amendoa flows (scoring, badge injection, target list, gamification, streaks) continue to work with no regressions. | Live test. |
| A8 | Dexie migration from any prior version completes without data loss and populates all new fields on existing rows. | `node scripts/verify-migration.mjs` |
| A9 | No new Chrome permissions requested. No direct calls from Amendoa to X API endpoints. No programmatic click on X's Post button anywhere in the codebase. | Grep + manifest diff. |

## 10. What we tried and what broke (v1 attempt)

- **Implementation approach:** React button with `onClick` handler → handler calls `openReplyComposer(tweetId, handle, draft)` → function navigates (via `window.location.href`) or stays on page → waits for focal tweet article → calls `.click()` on X's native Reply button to open composer → waits for `data-testid="tweetTextarea_0"` contenteditable → focuses it → calls `execCommand('insertText', ...)` for prefill → detects send via existing `CreateTweet` XHR interceptor → attributes via `pendingReplyContext` persisted to `chrome.storage.session`.
- **What worked:** Badge injection, queue rendering, card rendering, native reply logging (`source: 'native'`), Dexie v10 migration with smoke test, Sent tab UI.
- **What failed:** Clicking the Amendoa Reply button never reached our handler. Aggressive instrumentation (shadow-root click listener, document-level click listener, button `onMouseDown`, `onPointerDown`, data attributes) all showed ZERO click events inside the Amendoa container during testing. Cards render, badges inject — but no click ever registers inside our Shadow DOM mount. Root cause unknown; we could not isolate it remotely. Options: Shadow DOM event isolation quirk, CSS stacking / pointer-events / visual misalignment, double-mount conflict, or user clicking the wrong affordance.

## 11. Alternative technical approaches to evaluate

The user wants to try a different approach. Options to weigh:

1. **Keep React + Shadow DOM, attach click handler to the button via ref + native `addEventListener` instead of React's onClick.** Bypasses React's synthetic event system which may be misbehaving in Shadow DOM.
2. **Render the sidebar WITHOUT Shadow DOM** — use a scoped CSS reset or CSS Modules to prevent style leakage. Simplifies event flow; lots of working Chrome extensions do this.
3. **Keyboard-shortcut-initiated reply flow** — user presses Ctrl+Shift+R on a tweet card (or status page) to trigger the flow, instead of a click. Sidesteps any click-delivery issue entirely. Can be a complement to the button, not a replacement.
4. **Two-step UX** — Amendoa's button simply navigates to the status page (that path works today via the existing Jump button); then on the status page, Amendoa auto-opens the compose modal without waiting for a second click. Splits the flow into two independently-verifiable steps.
5. **URL-based deep link** — build URLs like `https://x.com/intent/tweet?in_reply_to_status_id=<id>` and open those directly. X opens its compose flow. Less elegant but very robust. Skip our own click/prefill for the open step; prefill only once the compose mounts.
6. **Drop Shadow DOM for just the Reply button** — render the queue cards normally and only use Shadow DOM for visual isolation of other parts. Localized fix.
7. **Instead of detecting the Amendoa-button click from inside Shadow DOM, use a global keyboard event or URL hash** — e.g. Amendoa sets a hash `#amendoa-reply:<tweetId>` and navigates; the content script reads the hash on load and triggers the flow. No click handler needed at all.

Each has tradeoffs in reliability, complexity, ToS posture, and UX. The re-spec is neutral on which to pick.

## 12. Risks

- **X DOM drift.** X updates its markup regularly; selectors break. Mitigation: fallback selectors + visible diagnostic when a fallback fires.
- **Deprecation of `execCommand('insertText')`.** Mitigation: `InputEvent` fallback; test path.
- **X migration to Lexical from Draft.js.** May affect prefill mechanism. Mitigation: degrade to "composer opens, user types manually, send still detected" — the LOG still works even if prefill fails.
- **Over-engineering for a Step 1.** The goal is foundation, not polish. Ship reliable minimum; iterate.

## 13. Open questions

1. Which alternative approach (§11) do we pick?
2. Should the diagnostic status line always be visible, or only when there's a recent failure?
3. If the composer fails to open, should we auto-fallback to `/intent/tweet` or just show a toast telling the user to click X's Reply themselves?
4. Is a keyboard shortcut a reasonable addition to the button, or should it replace it entirely?
