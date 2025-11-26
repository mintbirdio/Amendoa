# Amendoa v2 Phase 1 Implementation Plan

## Overview

**Goal:** Build the core "What should I reply to right now?" HUD

**Timeline:** ~3-4 weeks

**Approach:** Hybrid - keep working infrastructure (XHR interception, Shadow DOM, Dexie), rebuild logic and UI

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CHROME EXTENSION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │  injector.ts     │────▶│  processor.ts    │                  │
│  │  (KEEP AS-IS)    │     │  (REWRITE)       │                  │
│  │  XHR/Fetch patch │     │  Extract tweets  │                  │
│  └──────────────────┘     │  + author data   │                  │
│                           └────────┬─────────┘                  │
│                                    │                            │
│                                    ▼                            │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │  scoreEngine.ts  │◀────│  IndexedDB       │                  │
│  │  (NEW)           │     │  (NEW SCHEMA)    │                  │
│  │  Opportunity     │────▶│  • TargetAccounts│                  │
│  │  Score calc      │     │  • TweetCache    │                  │
│  └────────┬─────────┘     │  • OurReplies    │                  │
│           │               │  • Conversations │                  │
│           │               │  • DailyStats    │                  │
│           ▼               └──────────────────┘                  │
│  ┌──────────────────┐              │                            │
│  │  badgeInjector   │              │                            │
│  │  (NEW)           │◀─────────────┘                            │
│  │  DOM overlays    │                                           │
│  └──────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                    SIDEBAR (NEW)                      │      │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │      │
│  │  │ Reply Queue │ │ Obligations │ │ Daily Stats │     │      │
│  │  └─────────────┘ └─────────────┘ └─────────────┘     │      │
│  │  ┌─────────────────────────────────────────────┐     │      │
│  │  │           Target List Manager               │     │      │
│  │  └─────────────────────────────────────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Week 1: Foundation

### 1.1 Database Schema (Day 1-2)

**File:** `src/db/index.ts`

Replace existing schema with v2 schema:

```typescript
// TargetAccounts - accounts we're tracking
interface TargetAccount {
  handle: string;              // @username (primary key)
  displayName: string;
  followerCount: number;
  followingCount: number;
  isPremium: boolean;
  tier: 'titan' | 'star' | 'rising' | 'emerging' | 'peer';
  relationshipStatus: 'mutual' | 'following' | 'follower' | 'none';
  lastInteraction: number;     // timestamp
  interactionCount: number;    // times they've engaged with us
  ourEngagementCount: number;  // times we've engaged with them
  replyBackRate: number;       // % of our replies they respond to (0-100)
  addedAt: number;
  notes: string;
  notificationsEnabled: boolean;
}

// TweetCache - tweets we've seen and scored
interface TweetCache {
  tweetId: string;             // primary key
  authorHandle: string;
  content: string;
  postedAt: number;            // extracted from snowflake ID
  firstSeenAt: number;         // when we first saw it
  hasMedia: boolean;
  isThread: boolean;
  isReply: boolean;

  // Latest engagement snapshot
  likes: number;
  retweets: number;
  replies: number;
  views: number;

  // Calculated scores
  opportunityScore: number;

  // Our interaction
  didReply: boolean;
  replyTimestamp: number | null;
  gotReplyBack: boolean;
}

// OurReplies - track replies we've sent
interface OurReply {
  replyId: string;             // primary key
  inReplyToTweetId: string;
  inReplyToHandle: string;
  repliedAt: number;
  content: string;

  // Performance
  likesReceived: number;
  repliesReceived: number;
  gotAuthorReply: boolean;
  authorReplyTimestamp: number | null;
}

// ConversationQueue - unanswered replies to us
interface Conversation {
  id: string;                  // primary key
  otherPartyHandle: string;
  otherPartyTier: string;
  lastMessageFrom: 'us' | 'them';
  lastMessageAt: number;
  lastMessagePreview: string;
  threadUrl: string;
  isObligation: boolean;       // true if they replied and we haven't
  isDismissed: boolean;
}

// DailyStats - daily performance metrics
interface DailyStats {
  date: string;                // YYYY-MM-DD (primary key)
  repliesSent: number;
  repliesGotResponse: number;
  conversationsStarted: number;
  conversationsContinued: number;
  firstResponderCount: number; // times we were in first 5 replies
}
```

**Tasks:**
- [ ] Define TypeScript interfaces for all tables
- [ ] Create new Dexie schema with proper indexes
- [ ] Clean wipe v1 data (schema is fundamentally different)
- [ ] Create helper functions for common queries

---

### 1.2 Opportunity Score Engine (Day 2-3)

**File:** `src/services/scoreEngine.ts` (NEW)

Implement the scoring algorithm from spec:

```typescript
interface ScoreComponents {
  authorValue: number;      // 0-40
  timingMultiplier: number; // 0.1-2.0
  competitionFactor: number;// 0.5-1.5
  relationshipBonus: number;// 0-20
  riskPenalty: number;      // 0-30
}

function calculateOpportunityScore(
  tweet: TweetData,
  author: TargetAccount | null,
  now: number
): { score: number; components: ScoreComponents; badge: string }
```

**Scoring breakdown:**

```
AuthorValue (0-40):
├── FollowerTier: titan=25, star=22, rising=20, emerging=15, peer=10
├── PremiumBonus: +8 if verified
└── EngagementQuality: +0 to +7 based on their avg velocity

TimingMultiplier (0.1x - 2.0x):
├── 0-2 min:    2.0x
├── 2-5 min:    1.7x
├── 5-10 min:   1.3x
├── 10-30 min:  1.0x
├── 30-60 min:  0.6x
├── 1-3 hrs:    0.3x
└── 3+ hrs:     0.1x

CompetitionFactor (0.5x - 1.5x):
├── 0 replies:    1.5x
├── 1-3 replies:  1.3x
├── 4-10 replies: 1.0x
├── 11-25:        0.7x
├── 26-50:        0.5x
└── 50+:          0.3x

RelationshipBonus (0-20):
├── Mutual + recent interaction: +20
├── Mutual, no recent:           +12
├── They follow us:              +15
├── We follow them:              +5
├── No relationship:             +0
└── They've replied to us before: +8

RiskPenalty (0-30 deducted):
├── Low follower/following ratio: -10
├── Already replied today:        -5
└── Author rarely engages:        -10

Final = (AuthorValue × Timing × Competition + RelationshipBonus) - RiskPenalty

Badges:
├── 80-100: 🔥 HOT
├── 60-79:  ⚡ HIGH
├── 40-59:  ✓ GOOD
├── 20-39:  ~ MEH
└── 0-19:   ✗ SKIP
```

**Tasks:**
- [ ] Implement `calculateAuthorValue()`
- [ ] Implement `calculateTimingMultiplier()` (reuse snowflake parsing from v1)
- [ ] Implement `calculateCompetitionFactor()`
- [ ] Implement `calculateRelationshipBonus()`
- [ ] Implement `calculateRiskPenalty()`
- [ ] Implement main `calculateOpportunityScore()` function
- [ ] Add score caching to avoid recalculation

---

### 1.3 Processor Rewrite (Day 3-4)

**File:** `src/services/processor.ts`

Keep the tweet extraction logic, but output to new schema:

**Tasks:**
- [ ] Extract tweet parsing logic from v1 processor
- [ ] Map extracted data to new `TweetCache` schema
- [ ] Add author extraction (handle, followerCount, isPremium)
- [ ] Detect if author is in TargetAccounts
- [ ] Call score engine for each tweet from a target
- [ ] Emit events: `AMENDOA_TWEET_SCORED`, `AMENDOA_TARGET_POSTED`
- [ ] Remove v1 velocity calculation (replaced by opportunity score)
- [ ] Remove v1 classifier (not needed for Phase 1)

---

### 1.4 Keep/Update Infrastructure (Day 4-5)

**Files to KEEP unchanged:**
- `src/content/injector.ts` - XHR/Fetch interception
- `src/content/index.tsx` - Shadow DOM mounting (minor updates for new components)
- `src/services/velocity.ts` - Keep `extractTimestampFromSnowflake()` function only

**Files to DELETE:**
- `src/services/ghostScore.ts`
- `src/services/reciprocity.ts`
- `src/services/classifier.ts`
- `src/services/styleScraper.ts`
- `src/services/openai.ts`
- `src/components/TheForge.tsx`
- `src/components/Pulse.tsx`
- `src/components/Flow.tsx`
- `src/components/GlobalSync.tsx`
- `src/components/Orbit.tsx`
- `src/components/OrbitRings.tsx`
- `src/hooks/usePulse.ts`
- `src/hooks/useFlow.ts`
- `src/hooks/useOrbit.ts`

**Tasks:**
- [ ] Audit injector.ts - confirm it captures all needed data
- [ ] Update content/index.tsx to mount new sidebar
- [ ] Remove deleted files
- [ ] Update imports throughout codebase

---

## Week 2: Target List & Tweet Badges

### 2.1 Target List Management (Day 1-2)

**File:** `src/services/targetManager.ts` (NEW)

```typescript
// Core CRUD operations
async function addTarget(handle: string, tier?: Tier): Promise<TargetAccount>
async function removeTarget(handle: string): Promise<void>
async function updateTarget(handle: string, updates: Partial<TargetAccount>): Promise<void>
async function getTarget(handle: string): Promise<TargetAccount | null>
async function getAllTargets(): Promise<TargetAccount[]>
async function getTargetsByTier(tier: Tier): Promise<TargetAccount[]>

// Auto-tier based on follower count
function inferTier(followerCount: number): Tier

// Relationship detection (from API intercepts)
function updateRelationshipStatus(handle: string, status: RelationshipStatus): Promise<void>
```

**Tasks:**
- [ ] Implement CRUD operations for TargetAccounts table
- [ ] Implement tier inference from follower count
- [ ] Add deduplication (normalize handles to lowercase)
- [ ] Add validation (handle format, tier values)
- [ ] Add soft warning system for tier counts (no hard limits)
- [ ] Create hook: `useTargets()` for React components

---

### 2.2 Target List UI (Day 2-3)

**File:** `src/components/TargetList.tsx` (NEW)

```
┌─────────────────────────────────────────┐
│  🎯 TARGETS                    [+ Add]  │
├─────────────────────────────────────────┤
│                                         │
│  👑 TITANS (3)                     ▼    │
│  ├── @levelsio    380k  🔷  [×]        │
│  ├── @naval       2.1M  🔷  [×]        │
│  └── @julian      520k  🔷  [×]        │
│                                         │
│  ⭐ STARS (2)                      ▼    │
│  ├── @dickiebush  98k   🔷  [×]        │
│  └── @sahilbloom  67k   🔷  [×]        │
│                                         │
│  🚀 RISING (0)                     ▼    │
│  └── [+ Add Rising]                     │
│                                         │
│  🌱 EMERGING (0)                   ▼    │
│  └── [+ Add Emerging]                   │
│                                         │
│  🤝 PEERS (0)                      ▼    │
│  └── [+ Add Peer]                       │
│                                         │
└─────────────────────────────────────────┘
```

**Tasks:**
- [ ] Create collapsible tier sections
- [ ] Add target inline display (handle, followers, premium badge)
- [ ] Create "Add Target" modal with handle input
- [ ] Add remove button per target
- [ ] Show tier counts in headers
- [ ] Add empty state for each tier

---

### 2.3 Tweet Badge Injector (Day 3-4)

**File:** `src/services/badgeInjector.ts` (NEW)

Simpler than v1's tweetHighlighter - just inject compact badges.

**Badge design (fighter jet HUD style - inline after timestamp):**
```
┌─────────────────────────────────────────────────────────┐
│  @levelsio · 3m · 🔥92                                  │
│                    ▲                                    │
│  Just crossed $50k MRR with PhotoAI.                   │
│                    │                                    │
│            Inline badge in                              │
│            natural scan path                            │
└─────────────────────────────────────────────────────────┘
```

**Badge HTML structure (inserted after timestamp):**
```html
<span class="amendoa-badge amendoa-badge--hot">
  <span class="amendoa-badge__icon">🔥</span>
  <span class="amendoa-badge__score">92</span>
</span>
```

**Tasks:**
- [ ] Create MutationObserver to watch for new tweets
- [ ] Extract tweet ID from DOM element
- [ ] Look up score from TweetCache
- [ ] Find timestamp element and inject badge inline after it
- [ ] Style badges: compact, monospace, color-coded
- [ ] Add hover tooltip with score breakdown
- [ ] Handle tweet removal (cleanup badges)
- [ ] Only show badges for tweets from targets (or above threshold)

---

### 2.4 Badge Styles (Day 4)

**File:** `src/styles/badges.css` (NEW)

```css
/* Fighter jet HUD aesthetic */
.amendoa-badge {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 1px solid;
}

.amendoa-badge--hot {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.amendoa-badge--high {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
  color: #f59e0b;
}

.amendoa-badge--good {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
  color: #22c55e;
}

.amendoa-badge--meh {
  background: rgba(156, 163, 175, 0.15);
  border-color: rgba(156, 163, 175, 0.3);
  color: #9ca3af;
}

/* Tooltip on hover */
.amendoa-badge:hover .amendoa-tooltip {
  display: block;
}

.amendoa-tooltip {
  display: none;
  position: absolute;
  /* ... positioning and styling */
}
```

**Tasks:**
- [ ] Define color palette for each score tier
- [ ] Create badge base styles
- [ ] Create tier-specific color variants
- [ ] Add hover tooltip styles
- [ ] Ensure badges don't break tweet layout
- [ ] Test in both light and dark Twitter themes

---

## Week 3: Sidebar & Conversations

### 3.1 New Sidebar Shell (Day 1)

**File:** `src/components/Sidebar.tsx` (REWRITE)

```
┌────────────────────────────────────────┐
│  AMENDOA                    [−] [⚙️]   │
├────────────────────────────────────────┤
│                                        │
│  [⚡ Queue] [💬 Convos] [🎯 Targets]   │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │     Tab Content Area             │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 📊 TODAY                         │  │
│  │ Replies: 12 • Responses: 4 (33%) │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

**Tasks:**
- [ ] Create sidebar container with collapse toggle
- [ ] Add tab navigation (Queue, Convos, Targets)
- [ ] Add settings gear icon
- [ ] Create daily stats footer
- [ ] Implement collapse/expand animation
- [ ] Save sidebar state to localStorage

---

### 3.2 Reply Queue Tab (Day 1-2)

**File:** `src/components/ReplyQueue.tsx` (NEW)

```
┌──────────────────────────────────────┐
│ 🔥 92  @levelsio            2m ago  │
│ "Just crossed $50k MRR..."          │
│ 0 replies • 12 likes                │
│ [→ Jump]                            │
├──────────────────────────────────────┤
│ ⚡ 78  @julian              4m ago  │
│ "Hot take: most startups..."        │
│ 3 replies • 8 likes                 │
│ [→ Jump]                            │
├──────────────────────────────────────┤
│ ✓ 61  @marie_eng           8m ago   │
│ "Finally shipped the..."            │
│ 1 reply • 4 likes                   │
│ [→ Jump]                            │
└──────────────────────────────────────┘
```

**Tasks:**
- [ ] Query top 10 tweets by opportunity score from TweetCache
- [ ] Filter to tweets from targets only
- [ ] Filter to tweets < 1 hour old
- [ ] Display: score badge, handle, age, preview, engagement
- [ ] Add "Jump to Tweet" button (scroll + highlight)
- [ ] Live update as new tweets come in
- [ ] Empty state: "No high-value tweets right now"

---

### 3.3 Conversation Tracking (Day 2-3)

**File:** `src/services/conversationTracker.ts` (NEW)

Detect when someone replies to us (conversation obligation).

**Data sources:**
1. Intercept notification API calls
2. Intercept mentions timeline
3. Watch for reply threads where we're a participant

```typescript
// Called when we detect a reply to one of our tweets/replies
async function recordIncomingReply(
  fromHandle: string,
  toTweetId: string,
  replyContent: string,
  threadUrl: string
): Promise<void>

// Called when we reply to someone
async function recordOutgoingReply(
  toHandle: string,
  toTweetId: string,
  ourReplyId: string,
  content: string
): Promise<void>

// Get pending obligations (they replied, we haven't)
async function getPendingObligations(): Promise<Conversation[]>

// Dismiss an obligation
async function dismissObligation(conversationId: string): Promise<void>
```

**Tasks:**
- [ ] Identify API endpoints for notifications/mentions
- [ ] Add interception for reply detection
- [ ] Implement conversation state machine (who replied last)
- [ ] Calculate obligation urgency based on time + author tier
- [ ] Create hook: `useObligations()`

---

### 3.4 Conversations Tab (Day 3-4)

**File:** `src/components/ConversationObligations.tsx` (NEW)

```
┌──────────────────────────────────────┐
│ 🔴 URGENT (< 30 min)                 │
├──────────────────────────────────────┤
│ ⚠️ @techfounder replied 12m ago     │
│ "Great point! Have you tried..."    │
│ [→ Continue]           [Dismiss]    │
├──────────────────────────────────────┤
│ 🟡 SOON (30 min - 2 hrs)            │
├──────────────────────────────────────┤
│ ⏰ @indiemaker replied 47m ago      │
│ "Totally agree! I wrote about..."   │
│ [→ Continue]           [Dismiss]    │
├──────────────────────────────────────┤
│ ⚪ LATER (2+ hrs)                    │
├──────────────────────────────────────┤
│ • @builderpro (3 hrs ago)           │
│ • @devfounder (5 hrs ago)           │
└──────────────────────────────────────┘
```

**Tasks:**
- [ ] Group obligations by urgency tier
- [ ] Display: handle, time ago, message preview
- [ ] Add "Continue Thread" button (opens Twitter)
- [ ] Add "Dismiss" button
- [ ] Show count badge on tab when obligations pending
- [ ] Sort by urgency score

---

### 3.5 Daily Stats Footer (Day 4)

**File:** `src/components/DailyStats.tsx` (NEW)

```
┌──────────────────────────────────────┐
│ 📊 TODAY                             │
│ Replies: 12 • Responses: 4 (33%)    │
└──────────────────────────────────────┘
```

**Tasks:**
- [ ] Query DailyStats for current date
- [ ] Display: replies sent, responses received, response rate
- [ ] Update in real-time as user interacts
- [ ] Create hook: `useDailyStats()`

---

## Week 4: Notifications & Polish

### 4.1 Notification System (Day 1-2)

**File:** `src/services/notifications.ts` (NEW)

Phase 1: Only conversation obligation notifications.

```typescript
// Request notification permission
async function requestPermission(): Promise<boolean>

// Send obligation notification
function notifyObligation(conversation: Conversation): void

// Check if should notify (respect quiet hours, already notified, etc.)
function shouldNotify(conversation: Conversation): boolean
```

**Notification format:**
```
💬 @techfounder replied to you (5 min ago)
"Great insight! What tools do you use for..."
Continuing = 75x algorithmic boost
[Continue Thread] [Later]
```

**Tasks:**
- [ ] Implement permission request flow
- [ ] Create notification for new obligations
- [ ] Add 15-minute threshold before notifying
- [ ] Track which obligations we've notified about
- [ ] Add click handler to open thread
- [ ] Respect system notification settings

---

### 4.2 Settings Panel (Day 2)

**File:** `src/components/Settings.tsx` (NEW)

Minimal settings for Phase 1:

```
┌──────────────────────────────────────┐
│ ⚙️ SETTINGS                          │
├──────────────────────────────────────┤
│                                      │
│ NOTIFICATIONS                        │
│ ┌──────────────────────────────────┐ │
│ │ Conversation obligations: [ON]  │ │
│ │ Alert after: [15] minutes       │ │
│ └──────────────────────────────────┘ │
│                                      │
│ DISPLAY                              │
│ ┌──────────────────────────────────┐ │
│ │ Show opportunity badges: [ON]   │ │
│ │ Minimum score to show:  [40]    │ │
│ └──────────────────────────────────┘ │
│                                      │
│ DATA                                 │
│ ┌──────────────────────────────────┐ │
│ │ [Export Targets]                │ │
│ │ [Clear All Data]                │ │
│ └──────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘
```

**Tasks:**
- [ ] Create settings modal/panel
- [ ] Add notification toggle + threshold
- [ ] Add badge visibility toggle + minimum score
- [ ] Add export targets as JSON
- [ ] Add clear data button with confirmation
- [ ] Persist settings to chrome.storage.local

---

### 4.3 Onboarding Update (Day 3)

**File:** `src/components/Onboarding.tsx` (REWRITE)

New 3-step onboarding:

```
Step 1: Welcome
"Amendoa shows you exactly which tweets to reply to, and when."

Step 2: Add Your First Targets
"Add 5-10 accounts you want to engage with."
[Input field for handles]
[Suggested: @levelsio, @julian, ...]

Step 3: Enable Notifications
"Get alerted when someone replies to you (the 75x boost)."
[Enable Notifications] [Skip for Now]
```

**Tasks:**
- [ ] Rewrite onboarding flow for v2 value prop
- [ ] Add target input step
- [ ] Add notification permission step
- [ ] Remove references to Forge/AI features
- [ ] Update copy and visuals

---

### 4.4 Style System Update (Day 3-4)

**File:** `tailwind.config.js` + `src/index.css`

Shift from glassmorphism to "fighter jet HUD":

**Design tokens:**
```css
/* Colors */
--amendoa-bg: rgba(15, 15, 15, 0.95);
--amendoa-surface: rgba(25, 25, 25, 0.9);
--amendoa-border: rgba(255, 255, 255, 0.1);
--amendoa-text: rgba(255, 255, 255, 0.9);
--amendoa-text-muted: rgba(255, 255, 255, 0.5);

/* Score colors */
--score-hot: #ef4444;
--score-high: #f59e0b;
--score-good: #22c55e;
--score-meh: #6b7280;
--score-skip: #374151;

/* Urgency colors */
--urgency-urgent: #ef4444;
--urgency-soon: #f59e0b;
--urgency-later: #6b7280;

/* Typography */
--font-mono: 'SF Mono', 'Consolas', 'Monaco', monospace;
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Tasks:**
- [ ] Update Tailwind config with new color palette
- [ ] Create CSS custom properties for theming
- [ ] Update sidebar styles (less blur, more contrast)
- [ ] Ensure readability in both Twitter light/dark modes
- [ ] Add monospace styling for numbers/scores

---

### 4.5 Testing & Bug Fixes (Day 4-5)

**Tasks:**
- [ ] Test XHR interception still works with Twitter's current API
- [ ] Test badge injection across different tweet types (retweets, quotes, threads)
- [ ] Test conversation detection accuracy
- [ ] Test notification delivery
- [ ] Test data persistence across browser restarts
- [ ] Test sidebar collapse/expand
- [ ] Fix any styling issues in Twitter dark mode
- [ ] Performance check: ensure no lag when scrolling timeline

---

## Files Summary

### NEW Files (15)
```
src/db/index.ts              (REWRITE - new schema)
src/services/scoreEngine.ts  (NEW - opportunity scoring)
src/services/targetManager.ts (NEW - target CRUD)
src/services/badgeInjector.ts (NEW - DOM badge injection)
src/services/conversationTracker.ts (NEW - obligation tracking)
src/services/notifications.ts (NEW - browser notifications)
src/components/Sidebar.tsx   (REWRITE - new structure)
src/components/ReplyQueue.tsx (NEW)
src/components/ConversationObligations.tsx (NEW)
src/components/TargetList.tsx (NEW)
src/components/DailyStats.tsx (NEW)
src/components/Settings.tsx  (NEW)
src/components/Onboarding.tsx (REWRITE)
src/styles/badges.css        (NEW)
src/hooks/useTargets.ts      (NEW)
src/hooks/useObligations.ts  (NEW)
src/hooks/useDailyStats.ts   (NEW)
```

### KEEP Files (4)
```
src/content/injector.ts      (KEEP - XHR/Fetch interception)
src/content/index.tsx        (KEEP - Shadow DOM mount, minor updates)
src/services/velocity.ts     (KEEP - only extractTimestampFromSnowflake)
src/main.tsx                 (KEEP)
```

### DELETE Files (13)
```
src/services/ghostScore.ts
src/services/reciprocity.ts
src/services/classifier.ts
src/services/styleScraper.ts
src/services/openai.ts
src/services/tweetHighlighter.ts (replaced by badgeInjector)
src/components/TheForge.tsx
src/components/Pulse.tsx
src/components/Flow.tsx
src/components/GlobalSync.tsx
src/components/Orbit.tsx
src/components/OrbitRings.tsx
src/components/TimelineRadar.tsx (replaced by ReplyQueue)
src/components/ReplyOpportunities.tsx
src/components/DebugPanel.tsx
src/hooks/usePulse.ts
src/hooks/useFlow.ts
src/hooks/useOrbit.ts
```

---

## Definition of Done (Phase 1 MVP)

User can:
- [ ] Add/remove target accounts with tier assignment
- [ ] See opportunity score badges on tweets from targets
- [ ] View top reply opportunities in sidebar queue
- [ ] See conversation obligations (unanswered replies)
- [ ] Get browser notifications for obligations
- [ ] View basic daily stats (replies sent, response rate)
- [ ] Configure basic settings (badge visibility, notification threshold)

Technical:
- [ ] All data persists in IndexedDB
- [ ] No errors in console during normal usage
- [ ] Works on twitter.com and x.com
- [ ] Sidebar doesn't break Twitter's layout
- [ ] Badges don't break tweet layout

---

## Post-MVP Backlog (Phase 2+)

- Profile overlay cards with relationship intel
- Reply-back rate calculation (track over time)
- Smart target suggestions
- Fresh tweet notifications (targets just posted)
- Full analytics dashboard
- Engagement history tracking per tweet
- Author tier badge on tweets
- Context bar below tweets (age, replies, position hint)
- Reply composer enhancement panel
