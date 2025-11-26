# Amendoa v2: X Growth HUD
## Complete Product Specification

**Version:** 2.0 Draft  
**Last Updated:** November 2025  
**Purpose:** A Chrome extension that overlays algorithmic intelligence onto X (Twitter), transforming the reply guy strategy from guesswork into precision targeting.

---

## Executive Summary

Amendoa v2 is a "Head-Up Display" for X that answers one question in real-time: **"What should I reply to right now?"**

The X algorithm rewards conversations above all else — a reply that generates a reply-back delivers 75x more algorithmic value than a like. But most users spray replies randomly, hoping something sticks. Amendoa gives users surgical precision by:

1. **Surfacing fresh tweets from high-value accounts** before the reply window closes
2. **Scoring every tweet's "Reply Opportunity"** based on timing, competition, and potential reach
3. **Tracking relationship depth** to prioritize accounts likely to engage back
4. **Monitoring conversation obligations** — unanswered replies that represent missed 75x boosts

The result: users see exactly which tweets to reply to, in what order, with data on why each matters.

---

## Part 1: Algorithmic Foundation

### Why This Matters

Every design decision in Amendoa v2 stems from X's actual ranking signals. Here's the hierarchy we're optimizing for:

| Signal | Weight | Amendoa Response |
|--------|--------|------------------|
| Reply-to-reply conversation | 75x | Track "Conversation Obligations" — unreplied replies to you |
| Reply to tweet | 13.5x | Score and surface optimal reply opportunities |
| Profile click + engagement | 12x | Design tweets that drive curiosity |
| Click + dwell >2 min | 10-11x | (Content quality — outside HUD scope) |
| Retweet | 1-2x | Secondary metric |
| Like | 0.5x | Lowest priority signal |
| Block/mute/report | -74x | Warn before engaging with risky accounts |
| Tweet reported | -369x | Account health monitoring |

### The Reply Window Problem

Tweets have a **6-hour half-life** — relevancy decreases 50% every six hours. But the real window is much tighter:

- **Minutes 0-5:** First replies get pinned to top positions
- **Minutes 5-30:** Thread structure forms; new replies fight for visibility  
- **Minutes 30-60:** Engagement velocity determines viral trajectory
- **Hours 1-6:** Diminishing returns; only worth replying if thread is exploding
- **Hours 6+:** Ghost town unless tweet went mega-viral

**Amendoa's job:** Catch high-value tweets in the 0-5 minute window when reply position is still up for grabs.

### The Premium Reality

Buffer's analysis of 18.8 million posts (March 2025):
- Premium accounts: ~1,500 median impressions per post
- Free accounts: 50% get **zero** engagement
- Premium+ users see 2x the reach of standard Premium

**Implications for Amendoa:**
1. Replying to Premium users' tweets = higher traffic threads
2. If the user has Premium, their replies rank higher
3. Engagement from Premium users carries more weight

---

## Part 2: Core Architecture

### Data Layer

```
┌─────────────────────────────────────────────────────────────┐
│                      CHROME EXTENSION                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  DOM Scanner │───▶│ Tweet Parser │───▶│ Score Engine │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    IndexedDB                          │  │
│  │  • Tweet Cache    • Relationship Graph                │  │
│  │  • Target Lists   • Interaction History               │  │
│  │  • User Prefs     • Performance Metrics               │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    HUD Renderer                       │  │
│  │  • Tweet Overlays  • Sidebar Panel                    │  │
│  │  • Notifications   • Profile Badges                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### What We Can Extract from the DOM

When a user scrolls X, every visible tweet exposes:

**Tweet Data:**
- Content text
- Timestamp (calculate age in minutes)
- Engagement counts: likes, retweets, replies, views (when shown)
- Media presence: images, video, links, polls
- Thread context: is this a reply? Part of a thread?
- Quote tweet status

**Author Data:**
- Handle (@username)
- Display name
- Follower count (from profile hover or cached)
- Following count
- Verified/Premium badge (blue checkmark)
- Profile bio (from hover card)

**Relationship Data (requires tracking over time):**
- Do they follow the user?
- Does the user follow them?
- Past interaction history (likes, replies, mentions)

### Storage Schema (IndexedDB)

```javascript
// Accounts we're tracking
TargetAccounts: {
  handle: string,           // @username
  displayName: string,
  followerCount: number,
  followingCount: number,
  isPremium: boolean,
  tier: 'titan' | 'peer' | 'rising' | 'emerging' | 'peer',
  relationshipStatus: 'mutual' | 'following' | 'follower' | 'none',
  lastInteraction: timestamp,
  interactionCount: number,  // times they've engaged with us
  ourEngagementCount: number, // times we've engaged with them
  avgTweetVelocity: number,  // their typical early engagement
  replyBackRate: number,     // % of our replies they respond to
  addedAt: timestamp,
  notes: string              // user can add context
}

// Every tweet we've analyzed
TweetCache: {
  tweetId: string,
  authorHandle: string,
  content: string,
  postedAt: timestamp,
  firstSeenAt: timestamp,    // when Amendoa first saw it
  hasMedia: boolean,
  hasLink: boolean,
  hashtagCount: number,
  isThread: boolean,
  isReply: boolean,
  
  // Engagement snapshots over time
  engagementHistory: [
    { timestamp, likes, retweets, replies, views }
  ],
  
  // Calculated scores
  velocityScore: number,
  opportunityScore: number,
  
  // Our interaction
  didReply: boolean,
  replyTimestamp: timestamp,
  replyPosition: number,     // where our reply ranked
  gotReplyBack: boolean      // did author respond?
}

// Track our own replies
OurReplies: {
  replyId: string,
  inReplyToTweetId: string,
  inReplyToHandle: string,
  repliedAt: timestamp,
  content: string,
  
  // Performance tracking
  likesReceived: number,
  repliesReceived: number,
  gotAuthorReply: boolean,
  authorReplyTimestamp: timestamp
}

// Conversations we need to continue
ConversationQueue: {
  conversationId: string,
  otherPartyHandle: string,
  lastMessageFrom: 'us' | 'them',
  lastMessageAt: timestamp,
  isObligation: boolean,     // true if they replied and we haven't
  urgency: 'high' | 'medium' | 'low',
  threadUrl: string
}

// Daily/weekly performance metrics
PerformanceLog: {
  date: string,
  repliesSent: number,
  repliesGotResponses: number,
  conversationsStarted: number,
  conversationsContinued: number,
  profileVisitsEstimate: number,
  newFollowers: number,
  impressionsTotal: number
}
```

---

## Part 3: The Opportunity Score Algorithm

### Core Formula

Every tweet gets an **Opportunity Score (0-100)** that answers: "How valuable is replying to this tweet right now?"

```
OpportunityScore = (AuthorValue × TimingMultiplier × CompetitionFactor × RelationshipBonus) 
                   − RiskPenalty
```

### Component Breakdown

#### 1. Author Value (0-40 points)

Based on potential reach and engagement quality.

```
AuthorValue = FollowerTierScore + PremiumBonus + EngagementQualityScore

FollowerTierScore:
  - Titan (100k+):     25 pts  // Max exposure but low reply-back chance
  - Star (50k-100k):   22 pts  // Sweet spot of reach + accessibility
  - Rising (10k-50k):  20 pts  // Good reach, reasonable engagement
  - Emerging (1k-10k): 15 pts  // Building relationship potential
  - Peer (<1k):        10 pts  // Community building, high reciprocity

PremiumBonus:
  - Premium verified:  +8 pts  // Their threads get more views
  - Not premium:       +0 pts

EngagementQualityScore (calculated from history):
  - High avg velocity: +7 pts  // Their tweets typically pop
  - Medium velocity:   +4 pts
  - Low velocity:      +0 pts
```

#### 2. Timing Multiplier (0.1x - 2.0x)

The freshness window is everything.

```
TweetAge = now() - postedAt

TimingMultiplier:
  - 0-2 minutes:   2.0x  // GOLD — likely first responder
  - 2-5 minutes:   1.7x  // Excellent — top 5 reply position possible
  - 5-10 minutes:  1.3x  // Good — if low competition
  - 10-30 minutes: 1.0x  // Neutral — thread forming
  - 30-60 minutes: 0.6x  // Declining — need high velocity to justify
  - 1-3 hours:     0.3x  // Poor — only if viral trajectory
  - 3+ hours:      0.1x  // Dead — skip unless exceptional
```

#### 3. Competition Factor (0.5x - 1.5x)

How crowded is the reply section?

```
ReplyCount = current number of replies

CompetitionFactor:
  - 0 replies:     1.5x  // First! Maximum visibility
  - 1-3 replies:   1.3x  // Early — good positioning
  - 4-10 replies:  1.0x  // Moderate — need quality to stand out
  - 11-25 replies: 0.7x  // Crowded — diminishing returns
  - 26-50 replies: 0.5x  // Very crowded — only for titans
  - 50+ replies:   0.3x  // Mob scene — probably skip
  
// Adjust for velocity
IF replyVelocity > 5 replies/minute:
  CompetitionFactor *= 0.7  // Thread is blowing up, hard to compete
```

#### 4. Relationship Bonus (0-20 points)

Prior interaction dramatically increases reply-back likelihood.

```
RelationshipBonus:
  - Mutual follow + recent interaction: +20 pts
  - Mutual follow, no recent:           +12 pts
  - They follow us (we don't follow):   +15 pts  // Fan — high engagement chance
  - We follow them (they don't follow): +5 pts
  - No relationship:                    +0 pts

// Historical reply-back rate adjustment
IF theyHaveRepliedToUsBefore:
  RelationshipBonus += 8 pts
  
IF replyBackRate > 30%:
  RelationshipBonus += 5 pts
```

#### 5. Risk Penalty (0-30 points deducted)

Avoid situations that could backfire.

```
RiskPenalty:
  - Account has "engagement pod" signals: -15 pts
  - Low follower/following ratio (<0.3):  -10 pts  // Possible bot
  - Controversial topic detected:         -10 pts
  - Already replied to them today:        -5 pts   // Don't spam
  - Author rarely engages with replies:   -10 pts
```

### Final Score Interpretation

| Score | Badge | Action |
|-------|-------|--------|
| 80-100 | 🔥 HOT | Drop everything — reply NOW |
| 60-79 | ⚡ HIGH | Strong opportunity — prioritize |
| 40-59 | ✓ GOOD | Worth replying if you have time |
| 20-39 | ~ MEH | Low priority — skip unless inspired |
| 0-19 | ✗ SKIP | Don't bother |

---

## Part 4: User Interface Design

### 4.1 The Sidebar Panel

A collapsible panel on the right side of X (like a chat sidebar).

```
┌────────────────────────────────────────┐
│  AMENDOA                    [−] [⚙️]   │
├────────────────────────────────────────┤
│                                        │
│  ⚡ REPLY QUEUE                    3   │
│  ┌──────────────────────────────────┐  │
│  │ 🔥 92  @levelsio         2m ago  │  │
│  │ "Just crossed $50k MRR..."       │  │
│  │ 0 replies • 12 likes             │  │
│  │ [→ Jump to Tweet]                │  │
│  ├──────────────────────────────────┤  │
│  │ ⚡ 78  @julian           4m ago  │  │
│  │ "Hot take: most startups..."     │  │
│  │ 3 replies • 8 likes              │  │
│  │ [→ Jump to Tweet]                │  │
│  ├──────────────────────────────────┤  │
│  │ ✓ 61  @marie_eng        8m ago   │  │
│  │ "Finally shipped the..."         │  │
│  │ 1 reply • 4 likes                │  │
│  │ [→ Jump to Tweet]                │  │
│  └──────────────────────────────────┘  │
│                                        │
│  💬 CONVERSATION OBLIGATIONS       2   │
│  ┌──────────────────────────────────┐  │
│  │ ⚠️ @techfounder replied 23m ago  │  │
│  │ "Great point! Have you tried..." │  │
│  │ [→ Continue Thread]   [Dismiss]  │  │
│  ├──────────────────────────────────┤  │
│  │ ⏰ @builderpro replied 1h ago    │  │
│  │ "This is exactly what I..."      │  │
│  │ [→ Continue Thread]   [Dismiss]  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  📊 TODAY'S STATS                      │
│  ┌──────────────────────────────────┐  │
│  │ Replies Sent:        12          │  │
│  │ Got Response:        4 (33%)     │  │
│  │ Conversations:       3           │  │
│  │ Est. Reach:          ~8.2k       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [🎯 Manage Targets]  [📈 Analytics]  │
│                                        │
└────────────────────────────────────────┘
```

### 4.2 Tweet Overlays

Badges and indicators injected directly onto tweets in the feed.

#### Opportunity Badge (top-right corner of tweet)

```
┌─────────────────────────────────────────────────────────┐
│  @levelsio · 3m                              [🔥 92]    │
│                                                         │
│  Just crossed $50k MRR with PhotoAI.                   │
│  Here's what actually moved the needle...              │
│                                                         │
│  💬 2   🔁 4   ❤️ 18   📊 1.2k                          │
│                                                         │
│  ┌─────────────────────────────────────┐               │
│  │ ⏱️ 3m old • 👥 0 replies • 🎯 FIRST │  ← Amendoa    │
│  └─────────────────────────────────────┘   context bar │
└─────────────────────────────────────────────────────────┘
```

#### Context Bar Elements

- **⏱️ Age:** Tweet age in minutes/hours
- **👥 Replies:** Current reply count
- **🎯 Position hint:** "FIRST" / "EARLY" / "CROWDED"
- **⚡ Velocity:** If tweet is accelerating (optional)

#### Author Badge (next to handle)

```
@levelsio 🔷 [T] [87%]
           │   │   │
           │   │   └── Reply-back rate (they respond 87% of time)
           │   └────── Tier badge: T=Titan, S=Star, R=Rising, E=Emerging, P=Peer
           └────────── Premium indicator (blue diamond)
```

### 4.3 Reply Composer Enhancement

When user clicks reply, show context panel:

```
┌─────────────────────────────────────────────────────────┐
│  Replying to @levelsio                                  │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  │ Your draft reply here...                        │   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ AMENDOA REPLY INTEL                             │   │
│  │                                                 │   │
│  │ 📊 This thread: ~15k potential views            │   │
│  │ ⏱️ Posted 4 min ago — still in prime window    │   │
│  │ 👥 5 replies so far — moderate competition      │   │
│  │                                                 │   │
│  │ 💡 What works with @levelsio:                   │   │
│  │    • Specific tactical questions               │   │
│  │    • Sharing your own metrics                  │   │
│  │    • Contrarian takes (respectfully)           │   │
│  │                                                 │   │
│  │ ⚠️ Avoid: generic praise, asking for follows   │   │
│  │                                                 │   │
│  │ 🔗 Your last interaction: 3 days ago           │   │
│  │    (You replied, they liked)                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                                        [Post Reply]     │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Profile Overlay

When hovering or viewing someone's profile:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Profile Picture]  Pieter Levels                       │
│                     @levelsio · 🔷 TITAN               │
│                                                         │
│  ┌─── AMENDOA INTEL ───────────────────────────────┐   │
│  │                                                 │   │
│  │  📈 ENGAGEMENT PROFILE                          │   │
│  │  Avg tweet velocity: 847/hr (HIGH)              │   │
│  │  Reply-back rate: 12% (Low — expected for size) │   │
│  │  Best content: Build updates, revenue shares    │   │
│  │                                                 │   │
│  │  🤝 YOUR RELATIONSHIP                           │   │
│  │  Status: You follow them (not mutual)           │   │
│  │  Your replies to them: 7 total                  │   │
│  │  Their engagement with you: 2 likes, 0 replies  │   │
│  │  Last interaction: Oct 15 (they liked)          │   │
│  │                                                 │   │
│  │  💡 STRATEGY SUGGESTION                         │   │
│  │  Focus on their build-in-public tweets.         │   │
│  │  Share specific questions about their stack.    │   │
│  │  They respond more to peers with traction.      │   │
│  │                                                 │   │
│  │  [Add to Targets] [View History] [Set Alert]   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.5 Notification System

Browser notifications for time-sensitive opportunities.

**Notification Types:**

1. **🔥 Fresh Tweet Alert**
   ```
   @levelsio just posted (15 sec ago)
   "Big announcement coming tomorrow..."
   0 replies — you could be first
   [Reply Now] [Dismiss]
   ```

2. **💬 Conversation Obligation**
   ```
   @techfounder replied to you (5 min ago)
   "Great insight! What tools do you use for..."
   Continuing = 75x algorithmic boost
   [Continue Thread] [Later]
   ```

3. **📈 Your Reply Performing**
   ```
   Your reply to @julian is getting traction
   12 likes • 3 replies • Author responded!
   [View Thread]
   ```

4. **⚠️ Missed Opportunity**
   ```
   @levelsio's tweet from 20 min ago now has 50 replies
   Early window closed — skipping next time costs reach
   [Got it]
   ```

---

## Part 5: Target List Management

### The Five-Tier System

Users curate accounts into tiers, enabling differentiated strategies.

```
┌─────────────────────────────────────────────────────────┐
│  🎯 TARGET LISTS                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  👑 TITANS (100k+)                              8/10   │
│  ├── @levelsio (380k) 🔷 — Last: 2 days ago            │
│  ├── @naval (2.1M) 🔷 — Last: Never                    │
│  ├── @Julian (520k) 🔷 — Last: 1 week ago              │
│  └── [+ Add Titan]                                     │
│                                                         │
│  ⭐ STARS (50k-100k)                            6/10   │
│  ├── @dickiebush (98k) 🔷 — Last: Yesterday            │
│  ├── @sahaboruah (67k) 🔷 — Last: 3 days ago           │
│  └── [+ Add Star]                                      │
│                                                         │
│  🚀 RISING (10k-50k)                           10/15   │
│  ├── @jdnoc (24k) 🔷 — Last: Today                     │
│  ├── @jmcgawley (18k) 🔷 — Last: Today                 │
│  └── [+ Add Rising]                                    │
│                                                         │
│  🌱 EMERGING (1k-10k)                          12/20   │
│  └── [+ Add Emerging]                                  │
│                                                         │
│  🤝 PEERS (<1k)                                15/25   │
│  └── [+ Add Peer]                                      │
│                                                         │
│  ────────────────────────────────────────────────────  │
│                                                         │
│  📊 LIST HEALTH                                        │
│  Total targets: 51                                     │
│  With notifications ON: 23                             │
│  Active this week: 47                                  │
│  You've engaged this week: 31 (61%)                    │
│                                                         │
│  💡 Suggestion: Add 2 more Titans to diversify reach   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Smart Suggestions

Amendoa can suggest accounts to add based on:

1. **Network Analysis:** Accounts your targets frequently engage with
2. **Your Engagement:** Accounts you've interacted with but haven't added
3. **Niche Discovery:** Accounts posting in your topic clusters
4. **Rising Stars:** Accounts growing quickly in your space

```
┌─────────────────────────────────────────────────────────┐
│  💡 SUGGESTED TARGETS                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Based on your network:                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │ @kevon_c (12k) 🔷                                │  │
│  │ "Building in public" niche • Posts 2x daily     │  │
│  │ 8 of your targets engage with them              │  │
│  │ [Add to Rising] [Dismiss]                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  You've engaged with but not tracked:                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ @startupgirl (45k) 🔷                            │  │
│  │ You replied 3x this month, 1 reply-back          │  │
│  │ [Add to Stars] [Dismiss]                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Part 6: Conversation Obligation Tracking

### The 75x Opportunity

When someone replies to your tweet or reply, responding back triggers the algorithm's highest positive signal. Amendoa tracks these "obligations" and surfaces them prominently.

### Obligation Queue

```
┌─────────────────────────────────────────────────────────┐
│  💬 CONVERSATION OBLIGATIONS                    5      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔴 URGENT (< 30 min old)                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ @techfounder replied 12 min ago                  │  │
│  │ "That's a great point about pricing. Have you   │  │
│  │  experimented with annual plans?"                │  │
│  │                                                  │  │
│  │ Context: Your reply to their SaaS pricing tweet │  │
│  │ Potential: HIGH — they have 8k followers        │  │
│  │ [Continue Thread] [View Original] [Snooze 1hr]  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  🟡 SOON (30 min - 2 hrs)                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ @indiemaker replied 47 min ago                   │  │
│  │ "Totally agree! I wrote about this last week"   │  │
│  │ [Continue Thread] [View Original] [Dismiss]     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ⚪ LATER (2+ hrs — still valuable)                    │
│  • @builderpro (3 hrs ago) — general agreement         │
│  • @devfounder (5 hrs ago) — asked follow-up question  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Obligation Scoring

Not all obligations are equal. Score by:

```
ObligationUrgency = TimeDecay × AuthorValue × ConversationDepth

TimeDecay:
  - < 15 min:    1.0  (respond NOW)
  - 15-30 min:   0.9
  - 30-60 min:   0.7
  - 1-2 hrs:     0.5
  - 2-6 hrs:     0.3
  - 6+ hrs:      0.1

AuthorValue:
  - Titan:       1.5
  - Star:        1.3
  - Rising:      1.1
  - Emerging:    1.0
  - Peer:        0.9

ConversationDepth:
  - First reply-back:     1.0
  - Second exchange:      1.2  (momentum building)
  - Third+ exchange:      1.3  (real conversation)
  - They asked a question: 1.5 (high engagement signal)
```

---

## Part 7: Analytics Dashboard

### Weekly Performance View

```
┌─────────────────────────────────────────────────────────────────────┐
│  📈 WEEKLY PERFORMANCE                        Nov 18 - Nov 24      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  REPLY GAME                                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  Replies Sent          47    ████████████████ (+12% WoW)  │    │
│  │  Got Response          18    ███████ (38% rate)           │    │
│  │  Reply-to-Reply        12    █████ (25% → 75x boosts)     │    │
│  │  First Responder       8     ███ (17% of replies)         │    │
│  │                                                            │    │
│  │  Avg Opportunity Score: 62 (Good)                         │    │
│  │  Time spent: ~45 min/day                                  │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  REACH & GROWTH                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  Est. Reply Impressions   ~52k   (via target threads)     │    │
│  │  Profile Visits           234    ████████ (+28% WoW)      │    │
│  │  New Followers            31     (+18 vs last week)       │    │
│  │  Conversion Rate          13.2%  (visits → follows)       │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  TOP PERFORMING REPLIES THIS WEEK                                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 1. Reply to @levelsio — 23 likes, author replied          │    │
│  │    "The real unlock was removing the..." [View]           │    │
│  │                                                            │    │
│  │ 2. Reply to @julian — 18 likes, 4 replies                 │    │
│  │    "I tested this with 50 users and..." [View]            │    │
│  │                                                            │    │
│  │ 3. Reply to @buildinpublic — 12 likes, author replied     │    │
│  │    "This is why I track weekly not..." [View]             │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  RELATIONSHIP PROGRESS                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  New mutual follows: 3                                    │    │
│  │  • @indiemaker (4k) — after 5 reply exchanges             │    │
│  │  • @devfounder (2k) — after they replied to your tweet    │    │
│  │  • @techstartup (800) — after collab thread               │    │
│  │                                                            │    │
│  │  Strengthened relationships: 7                            │    │
│  │  (Multiple exchanges this week with existing targets)     │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  💡 INSIGHTS                                                        │
│  • Your replies to "Rising" tier accounts convert 2x better        │
│  • Questions get 40% more reply-backs than statements              │
│  • Best engagement window for you: 9-11 AM (your timezone)         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Metrics Tracked

| Metric | What It Measures | Why It Matters |
|--------|------------------|----------------|
| Reply Response Rate | % of your replies that get a response | Direct measure of reply quality |
| Reply-to-Reply Rate | % leading to back-and-forth | 75x boost opportunities |
| First Responder Rate | % where you were in first 5 replies | Position = visibility |
| Avg Opportunity Score | Quality of tweets you're targeting | Are you being strategic? |
| Profile Visits | Traffic driven to your profile | Leading indicator of follows |
| Visit→Follow Conversion | % of visitors who follow | Profile optimization signal |
| Relationship Depth | Interactions per target over time | Long-term value building |

---

## Part 8: Settings & Preferences

### Notification Controls

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚙️ NOTIFICATION SETTINGS                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔔 FRESH TWEET ALERTS                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Alert when targets post:              [ON] ●○ [OFF]       │    │
│  │                                                            │    │
│  │ Which tiers?                                               │    │
│  │   [✓] Titans     [✓] Stars    [ ] Rising                  │    │
│  │   [ ] Emerging   [ ] Peers                                 │    │
│  │                                                            │    │
│  │ Minimum opportunity score: [60] ▼                         │    │
│  │ (Only alert for scores above this)                        │    │
│  │                                                            │    │
│  │ Quiet hours: [10 PM] to [7 AM] ▼                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  💬 CONVERSATION OBLIGATIONS                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Alert for unanswered replies:         [ON] ●○ [OFF]       │    │
│  │ Alert threshold: [15] minutes after reply                 │    │
│  │ Repeat reminder after: [1 hour] if not addressed          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  📈 PERFORMANCE ALERTS                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Alert when your reply gets:                               │    │
│  │   [✓] Author response                                     │    │
│  │   [✓] 10+ likes                                           │    │
│  │   [ ] 5+ replies                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Display Preferences

```
┌─────────────────────────────────────────────────────────────────────┐
│  🎨 DISPLAY SETTINGS                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TWEET OVERLAYS                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Show opportunity badges:              [ON] ●○ [OFF]       │    │
│  │ Show author tier badges:              [ON] ●○ [OFF]       │    │
│  │ Show context bar:                     [ON] ●○ [OFF]       │    │
│  │ Show reply-back rates:                [ON] ●○ [OFF]       │    │
│  │                                                            │    │
│  │ Badge style: [Minimal] [Standard] [Detailed] ▼            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  SIDEBAR                                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Default state: [Collapsed] [Expanded] ▼                   │    │
│  │ Position: [Right] [Left] ▼                                │    │
│  │ Width: [Narrow] [Standard] [Wide] ▼                       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  FEED FILTERING                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Highlight tweets from targets:        [ON] ●○ [OFF]       │    │
│  │ Dim low-opportunity tweets:           [OFF] ○● [ON]       │    │
│  │   (Score below: [30])                                     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 9: Technical Implementation Notes

### DOM Observation Strategy

```javascript
// MutationObserver to catch new tweets as they load
const feedObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (isTweetElement(node)) {
        const tweetData = parseTweetFromDOM(node);
        const score = calculateOpportunityScore(tweetData);
        injectOverlay(node, score, tweetData);
        cacheTweet(tweetData);
      }
    });
  });
});

// Observe the timeline container
feedObserver.observe(
  document.querySelector('[data-testid="primaryColumn"]'),
  { childList: true, subtree: true }
);
```

### Data Extraction Points

| Data Point | DOM Location | Extraction Method |
|------------|--------------|-------------------|
| Tweet text | `[data-testid="tweetText"]` | innerText |
| Author handle | `[data-testid="User-Name"] a` | href parsing |
| Timestamp | `time` element | datetime attribute |
| Like count | `[data-testid="like"]` | aria-label parsing |
| Reply count | `[data-testid="reply"]` | aria-label parsing |
| Retweet count | `[data-testid="retweet"]` | aria-label parsing |
| View count | Analytics element | innerText parsing |
| Premium badge | Verified SVG | presence check |
| Media | `[data-testid="tweetPhoto"]` / video | presence check |

### Background Processes

1. **Tweet Polling for Targets**
   - Every 30 seconds: Check if any target accounts have new tweets
   - Method: Monitor timeline for target handles, or periodic profile checks
   
2. **Engagement Velocity Tracking**
   - For cached tweets: Re-check engagement counts every 2 minutes for first 30 min
   - Calculate velocity trends to identify acceleration
   
3. **Notification Queue**
   - Process high-opportunity tweets
   - Check for unanswered replies (conversation obligations)
   - Respect quiet hours settings

### Storage Limits

IndexedDB is generous, but implement cleanup:

```javascript
// Retention policies
const RETENTION = {
  tweets: 7 * 24 * 60 * 60 * 1000,      // 7 days
  interactions: 90 * 24 * 60 * 60 * 1000, // 90 days
  performanceLog: 365 * 24 * 60 * 60 * 1000 // 1 year
};

// Nightly cleanup job
async function cleanupOldData() {
  const now = Date.now();
  // Remove tweets older than retention period
  // Compact engagement history to daily summaries
  // Archive performance data
}
```

---

## Part 10: Roadmap & Prioritization

### Phase 1: Core HUD (MVP)

**Goal:** Get the basic "what should I reply to" functionality working.

| Feature | Priority | Complexity |
|---------|----------|------------|
| Tweet opportunity scoring | P0 | Medium |
| Opportunity badge overlay | P0 | Low |
| Target list management (basic) | P0 | Medium |
| Sidebar with reply queue | P0 | Medium |
| Conversation obligation tracking | P0 | Medium |
| Basic notifications | P1 | Low |

**Timeline:** 4-6 weeks

### Phase 2: Intelligence Layer

**Goal:** Make the scoring smarter and add relationship tracking.

| Feature | Priority | Complexity |
|---------|----------|------------|
| Relationship graph building | P0 | High |
| Reply-back rate calculation | P0 | Medium |
| Historical interaction tracking | P0 | Medium |
| Profile overlay cards | P1 | Medium |
| Smart target suggestions | P2 | High |

**Timeline:** 4-6 weeks

### Phase 3: Analytics & Optimization

**Goal:** Help users understand what's working and improve.

| Feature | Priority | Complexity |
|---------|----------|------------|
| Weekly performance dashboard | P0 | Medium |
| Top performing reply analysis | P1 | Medium |
| Engagement pattern insights | P1 | High |
| A/B testing for reply strategies | P2 | High |

**Timeline:** 3-4 weeks

### Phase 4: Advanced Features

**Goal:** Power user features and optimization.

| Feature | Priority | Complexity |
|---------|----------|------------|
| Reply composer enhancement | P1 | Medium |
| Custom scoring weights | P2 | Low |
| Export/import target lists | P2 | Low |
| Team/shared target lists | P3 | High |
| API for external integrations | P3 | High |

**Timeline:** Ongoing

---

## Appendix A: Competitive Analysis

### Existing Tools

| Tool | Strength | Weakness | Amendoa Advantage |
|------|----------|----------|-------------------|
| Tweet Hunter | Content generation, scheduling | No real-time HUD, no reply focus | Live overlay, reply-first design |
| Hypefury | Engagement features, threads | Generic engagement, no targeting | Precision targeting, opportunity scoring |
| Typefully | Writing experience, analytics | Post-focused, not reply-focused | Reply guy optimization |
| Buffer | Scheduling, basic analytics | No X-specific intelligence | Deep algorithmic alignment |
| Black Magic | Analytics | Historical only, no real-time | Real-time decision support |

### Amendoa's Unique Position

**"The real-time reply targeting HUD that turns X engagement from spray-and-pray into surgical precision."**

No other tool:
1. Scores individual tweets for reply opportunity in real-time
2. Tracks conversation obligations (the 75x signal)
3. Builds and leverages a relationship graph for reply targeting
4. Overlays intelligence directly onto the X interface

---

## Appendix B: Success Metrics for Amendoa Users

### Leading Indicators (Weekly)

- Reply Response Rate: Target 30%+
- First Responder Rate: Target 20%+ of replies
- Average Opportunity Score: Target 55+
- Conversation Obligations Cleared: Target 90%+

### Lagging Indicators (Monthly)

- Profile Visit Growth: Target +20% MoM
- Follower Growth: Target +15% MoM
- Mutual Follow Conversion: Target 5% of targets
- Reply Thread Impressions: Target +25% MoM

### Health Indicators

- Time Spent: Should decrease as efficiency improves
- Reply Quality: Response rate should stay stable or improve
- Relationship Depth: Average interactions per target should increase

---

## Appendix C: Anti-Spam Safeguards

To protect users from triggering X's spam detection:

1. **Rate Limiting**
   - Max replies per hour: 15 (below X's threshold)
   - Min time between replies: 45 seconds
   - Max replies to same account per day: 3

2. **Pattern Breaking**
   - Warn if user is replying to same tier repeatedly
   - Suggest mixing target tiers
   - Flag if replies are getting unusually low engagement (possible shadowban)

3. **Content Diversity**
   - Track reply content for similarity
   - Warn if replies are becoming formulaic
   - Suggest varying reply styles

4. **Account Health Monitoring**
   - Track impressions trend
   - Alert if sudden drop (possible restriction)
   - Recommend 48-72 hour pause if suspected shadowban

---

*End of Specification Document*
