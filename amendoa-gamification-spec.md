# Amendoa Gamification Layer
## Complete Specification Document

**Version:** 1.0  
**Last Updated:** November 2025  
**Purpose:** A habit-forming gamification system that drives consistent daily engagement through XP, streaks, levels, and shareable achievements.

---

## Executive Summary

The gamification layer transforms Amendoa from a passive tool into an active habit engine. Users compete against themselves through:

1. **Daily XP** earned from replies and posts
2. **Streaks** that reward consistency and punish gaps
3. **Tiered ranks** that provide long-term progression
4. **Outcome bonuses** that add variable rewards
5. **Shareable stats images** that spread Amendoa virally

The system leverages two psychological principles:
- **Loss aversion:** Breaking a streak feels worse than missing XP feels bad
- **Variable rewards:** Unpredictable bonuses (reply-backs, new followers) trigger dopamine

---

## Part 1: Core Philosophy

### Why Replies > Posts

The X algorithm rewards conversations above all else. A reply-to-reply exchange delivers 75x more algorithmic value than a like. For accounts under 5k followers, replying to larger accounts is the primary growth lever — you're borrowing their audience.

Posts matter for profile optimization (visitors need content to see), but they're secondary to engagement.

**Therefore:**
- Replies earn fewer XP per unit but have a higher daily target
- Posts earn more XP per unit but have a lower daily target
- Both are required to maintain a streak

### Daily Requirements

To maintain a streak, users must complete BOTH:

| Action | Minimum Required | XP Per Action | Max XP from Required |
|--------|------------------|---------------|----------------------|
| Replies | 25 | 4 XP | 100 XP |
| Posts | 3 | 15 XP | 45 XP |

**Rationale for these numbers:**

- **25 replies:** Aggressive but achievable in ~45 minutes with strategic targeting. Aligns with growth expert recommendations (50+ replies/day for fastest growth, 25 is sustainable).
- **3 posts:** Most growth experts recommend 2-3 posts for accounts under 5k followers. More than that dilutes attention across too many posts.

### Bonus Posts

Posts beyond the minimum 3 earn bonus XP, but with diminishing returns:

| Posts | XP Earned |
|-------|-----------|
| 1-3 | 15 XP each (required) |
| 4-5 | 15 XP each (bonus) |
| 6+ | 0 XP (no reward — discourages spam) |

**Maximum daily XP from posts: 75 XP (5 posts)**

---

## Part 2: XP System

### Input Actions (User Controls These)

These are actions the user directly takes. They form the foundation of daily XP.

| Action | XP | Daily Cap | Notes |
|--------|-----|-----------|-------|
| Reply sent | 4 | 25 required (100 XP) | Core activity |
| Post published | 15 | 3 required, 5 max rewarded (75 XP) | Higher value per unit |
| Conversation continued | 20 | No cap | User replied to someone who replied to them |

**"Conversation continued" definition:** When someone replies to the user's tweet or reply, and the user replies back, that's a continued conversation. This triggers the 75x algorithmic signal and deserves high XP.

### Output Bonuses (User Can't Control These)

These are outcomes that depend on other users' actions. They add variable reward psychology.

| Outcome | XP | Notes |
|---------|-----|-------|
| Reply-back received | 25 | Someone replied to user's reply |
| Author liked user's reply | 8 | Lighter engagement signal |
| User's reply got 5+ likes | 15 | Content resonated with audience |
| New follower | 50 | The ultimate goal |
| New mutual follow | 100 | Relationship formed |

### Typical Daily XP Calculation

**Minimum viable day (just hitting requirements):**
```
25 replies × 4 XP     = 100 XP
3 posts × 15 XP       = 45 XP
─────────────────────────────
Base total            = 145 XP
```

**Good day (with some outcomes):**
```
25 replies × 4 XP     = 100 XP
4 posts × 15 XP       = 60 XP
3 reply-backs × 25 XP = 75 XP
5 author likes × 8 XP = 40 XP
1 new follower × 50   = 50 XP
─────────────────────────────
Base total            = 325 XP
```

**With streak multiplier (14+ days = 1.5x):**
```
325 × 1.5 = 487 XP
```

---

## Part 3: Streak System

### Core Mechanic

A streak counts consecutive days where the user completed BOTH:
- 25+ replies
- 3+ posts

Missing either requirement resets the streak to 0.

### Streak Multiplier

Longer streaks multiply ALL XP earned (inputs and outputs).

| Streak Length | Multiplier | Effective Reply XP |
|---------------|------------|-------------------|
| 0-2 days | 1.0x | 4 XP |
| 3-6 days | 1.1x | 4.4 XP |
| 7-13 days | 1.25x | 5 XP |
| 14-29 days | 1.5x | 6 XP |
| 30+ days | 2.0x | 8 XP |

**Psychological impact:** At a 30-day streak, every action is worth double. Breaking the streak means losing that 2x multiplier — a massive loss that drives daily consistency.

### Day Reset Logic

Days reset at **local midnight** based on the user's browser timezone.

```javascript
function getLocalDateString() {
  // Returns "2025-11-26" in user's local timezone
  return new Date().toLocaleDateString('en-CA')
}
```

**Why local timezone:**
- Feels natural to users ("my day" = their actual day)
- No confusion about when streaks reset
- Users in different timezones each get their own midnight

### Streak Persistence

Check streak validity on each session start:

```javascript
async function checkStreakOnLoad() {
  const today = getLocalDateString()
  const stats = await db.userStats.get()
  const lastActiveDate = stats.lastActiveDate
  
  if (!lastActiveDate) {
    // First time user
    return
  }
  
  const daysSinceActive = daysBetween(lastActiveDate, today)
  
  if (daysSinceActive === 0) {
    // Same day, continue
    return
  }
  
  if (daysSinceActive === 1) {
    // Yesterday — check if requirements were met
    const yesterday = await db.dailyProgress.get(lastActiveDate)
    if (yesterday.repliesSent >= 25 && yesterday.postsPublished >= 3) {
      // Streak continues
      return
    } else {
      // Requirements not met — break streak
      await db.userStats.update({ currentStreak: 0 })
    }
  }
  
  if (daysSinceActive > 1) {
    // Missed a day entirely — break streak
    await db.userStats.update({ currentStreak: 0 })
  }
}
```

### Streak Recovery (Optional Future Feature)

Consider adding "streak freezes" as a premium/earned feature:
- Earn 1 freeze per 14-day streak
- Can bank up to 3 freezes
- Using a freeze preserves streak for 1 missed day

**Not in v1 — just noting for future consideration.**

---

## Part 4: Ranking System

### Tier Structure

Seven tiers with three ranks each (I, II, III), except the final tier which scales infinitely.

| Tier | Emoji | Name | XP Range | Ranks |
|------|-------|------|----------|-------|
| 1 | 👀 | Lurker | 0 – 1,499 | I, II, III |
| 2 | 💬 | Reply Guy | 1,500 – 4,999 | I, II, III |
| 3 | 🎯 | Engager | 5,000 – 14,999 | I, II, III |
| 4 | 🤝 | Networker | 15,000 – 39,999 | I, II, III |
| 5 | 📢 | Voice | 40,000 – 99,999 | I, II, III |
| 6 | ⭐ | Authority | 100,000 – 299,999 | I, II, III |
| 7 | 👑 | Thought Leader | 300,000+ | I, II, III, IV, V... ∞ |

**Total named levels:** 21 (before Thought Leader goes infinite)

### Rank Calculation Within Tiers

For tiers 1-6, divide the XP range into thirds:

```
Tier XP Range: 5,000 – 14,999 (Engager)
Total span: 10,000 XP

Rank I:   5,000 – 8,332    (first third)
Rank II:  8,333 – 11,665   (second third)
Rank III: 11,666 – 14,999  (final third)
```

### Thought Leader Infinite Scaling

Once a user reaches 300,000 XP (Thought Leader), ranks continue indefinitely:

| XP | Rank |
|----|------|
| 300,000 – 399,999 | Thought Leader I |
| 400,000 – 499,999 | Thought Leader II |
| 500,000 – 599,999 | Thought Leader III |
| 600,000 – 699,999 | Thought Leader IV |
| ... | ... |

**Formula:** Each Thought Leader rank = 100,000 XP

```javascript
function getThoughtLeaderRank(xp) {
  const thoughtLeaderXP = xp - 300000
  return Math.floor(thoughtLeaderXP / 100000) + 1
}
```

### Time to Reach Each Tier

Assuming ~400 XP/day average (good engagement + 14-day streak multiplier):

| Tier | XP Required | Days to Reach |
|------|-------------|---------------|
| Lurker I | 0 | 0 |
| Reply Guy I | 1,500 | ~4 |
| Engager I | 5,000 | ~13 |
| Networker I | 15,000 | ~38 |
| Voice I | 40,000 | ~100 |
| Authority I | 100,000 | ~250 |
| Thought Leader I | 300,000 | ~750 |

**Thought Leader is aspirational** — it takes ~2 years of consistent daily use. This is intentional.

### Rank Display Format

```
👀 Lurker I
💬 Reply Guy III
🎯 Engager II
🤝 Networker I
📢 Voice III
⭐ Authority II
👑 Thought Leader VII
```

---

## Part 5: Implementation

### Storage Schema (IndexedDB via Dexie)

```javascript
// Daily progress — one record per day
DailyProgress: {
  date: string,              // "2025-11-26" (local date)
  repliesSent: number,       // count of replies
  postsPublished: number,    // count of posts
  conversationsContinued: number,
  
  // Outcome tracking
  replyBacksReceived: number,
  authorLikesReceived: number,
  repliesWithFivePlusLikes: number,
  newFollowers: number,      // manual input or notification parsing
  newMutuals: number,
  
  // Calculated
  baseXPEarned: number,      // before multiplier
  multiplier: number,        // streak multiplier that day
  totalXPEarned: number,     // base × multiplier
  
  // Requirements
  streakMaintained: boolean  // did user hit 25 replies + 3 posts?
}

// Persistent user stats
UserStats: {
  odavie
  totalXP: number,
  currentStreak: number,
  longestStreak: number,
  lastActiveDate: string,    // "2025-11-26"
  
  // Derived (can be recalculated)
  currentTier: string,       // "Engager"
  currentRank: string,       // "II"
  currentTierEmoji: string,  // "🎯"
  
  // Lifetime stats
  totalReplies: number,
  totalPosts: number,
  totalConversations: number,
  totalReplyBacks: number,
  totalFollowersGained: number
}
```

### Core Functions

#### Calculate XP for an Action

```javascript
const XP_VALUES = {
  reply: 4,
  post: 15,
  conversationContinued: 20,
  replyBack: 25,
  authorLike: 8,
  replyFivePlusLikes: 15,
  newFollower: 50,
  newMutual: 100
}

const MAX_REWARDED_POSTS = 5

function calculateActionXP(action, dailyProgress) {
  if (action === 'post' && dailyProgress.postsPublished >= MAX_REWARDED_POSTS) {
    return 0  // No XP for posts beyond 5
  }
  return XP_VALUES[action] || 0
}
```

#### Get Streak Multiplier

```javascript
function getStreakMultiplier(streakDays) {
  if (streakDays >= 30) return 2.0
  if (streakDays >= 14) return 1.5
  if (streakDays >= 7) return 1.25
  if (streakDays >= 3) return 1.1
  return 1.0
}
```

#### Calculate Tier and Rank

```javascript
const TIERS = [
  { name: 'Lurker', emoji: '👀', minXP: 0 },
  { name: 'Reply Guy', emoji: '💬', minXP: 1500 },
  { name: 'Engager', emoji: '🎯', minXP: 5000 },
  { name: 'Networker', emoji: '🤝', minXP: 15000 },
  { name: 'Voice', emoji: '📢', minXP: 40000 },
  { name: 'Authority', emoji: '⭐', minXP: 100000 },
  { name: 'Thought Leader', emoji: '👑', minXP: 300000 }
]

function getTierAndRank(totalXP) {
  // Find current tier
  let tierIndex = 0
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (totalXP >= TIERS[i].minXP) {
      tierIndex = i
      break
    }
  }
  
  const tier = TIERS[tierIndex]
  
  // Handle Thought Leader (infinite scaling)
  if (tierIndex === 6) {
    const thoughtLeaderXP = totalXP - 300000
    const rank = Math.floor(thoughtLeaderXP / 100000) + 1
    return {
      tier: tier.name,
      emoji: tier.emoji,
      rank: toRomanNumeral(rank),
      display: `${tier.emoji} ${tier.name} ${toRomanNumeral(rank)}`,
      xpIntoRank: thoughtLeaderXP % 100000,
      xpForNextRank: 100000
    }
  }
  
  // Normal tiers — calculate rank I, II, or III
  const nextTierXP = TIERS[tierIndex + 1].minXP
  const tierSpan = nextTierXP - tier.minXP
  const xpIntoTier = totalXP - tier.minXP
  const progress = xpIntoTier / tierSpan
  
  let rank, xpIntoRank, xpForNextRank
  const rankSpan = tierSpan / 3
  
  if (progress < 0.333) {
    rank = 'I'
    xpIntoRank = xpIntoTier
    xpForNextRank = rankSpan
  } else if (progress < 0.666) {
    rank = 'II'
    xpIntoRank = xpIntoTier - rankSpan
    xpForNextRank = rankSpan
  } else {
    rank = 'III'
    xpIntoRank = xpIntoTier - (rankSpan * 2)
    xpForNextRank = rankSpan
  }
  
  return {
    tier: tier.name,
    emoji: tier.emoji,
    rank: rank,
    display: `${tier.emoji} ${tier.name} ${rank}`,
    xpIntoRank: Math.floor(xpIntoRank),
    xpForNextRank: Math.floor(xpForNextRank)
  }
}

function toRomanNumeral(num) {
  if (num <= 0) return ''
  if (num <= 10) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][num]
  }
  // For larger numbers, just use the number
  return num.toString()
}
```

#### Record an Action

```javascript
async function recordAction(action) {
  const today = getLocalDateString()
  const userStats = await db.userStats.get('main')
  const multiplier = getStreakMultiplier(userStats.currentStreak)
  
  // Get or create today's progress
  let dailyProgress = await db.dailyProgress.get(today)
  if (!dailyProgress) {
    dailyProgress = createEmptyDailyProgress(today)
  }
  
  // Calculate XP
  const baseXP = calculateActionXP(action, dailyProgress)
  const earnedXP = Math.floor(baseXP * multiplier)
  
  // Update daily progress
  switch (action) {
    case 'reply':
      dailyProgress.repliesSent++
      break
    case 'post':
      dailyProgress.postsPublished++
      break
    case 'conversationContinued':
      dailyProgress.conversationsContinued++
      break
    case 'replyBack':
      dailyProgress.replyBacksReceived++
      break
    case 'authorLike':
      dailyProgress.authorLikesReceived++
      break
    case 'newFollower':
      dailyProgress.newFollowers++
      break
    case 'newMutual':
      dailyProgress.newMutuals++
      break
  }
  
  dailyProgress.baseXPEarned += baseXP
  dailyProgress.multiplier = multiplier
  dailyProgress.totalXPEarned += earnedXP
  dailyProgress.streakMaintained = (
    dailyProgress.repliesSent >= 25 && 
    dailyProgress.postsPublished >= 3
  )
  
  await db.dailyProgress.put(dailyProgress)
  
  // Update lifetime stats
  userStats.totalXP += earnedXP
  userStats.lastActiveDate = today
  
  // Update tier/rank
  const rankInfo = getTierAndRank(userStats.totalXP)
  userStats.currentTier = rankInfo.tier
  userStats.currentRank = rankInfo.rank
  userStats.currentTierEmoji = rankInfo.emoji
  
  await db.userStats.put(userStats)
  
  return {
    xpEarned: earnedXP,
    newTotal: userStats.totalXP,
    rankInfo: rankInfo
  }
}
```

#### End of Day Processing

```javascript
async function processEndOfDay(date) {
  const dailyProgress = await db.dailyProgress.get(date)
  const userStats = await db.userStats.get('main')
  
  if (dailyProgress.streakMaintained) {
    userStats.currentStreak++
    if (userStats.currentStreak > userStats.longestStreak) {
      userStats.longestStreak = userStats.currentStreak
    }
  } else {
    userStats.currentStreak = 0
  }
  
  // Update lifetime totals
  userStats.totalReplies += dailyProgress.repliesSent
  userStats.totalPosts += dailyProgress.postsPublished
  userStats.totalConversations += dailyProgress.conversationsContinued
  userStats.totalReplyBacks += dailyProgress.replyBacksReceived
  userStats.totalFollowersGained += dailyProgress.newFollowers
  
  await db.userStats.put(userStats)
}
```

---

## Part 6: User Interface

### Daily Stats Panel (Sidebar Integration)

Add a collapsible section to the existing Amendoa sidebar:

```
┌────────────────────────────────────────┐
│  📊 TODAY'S GRIND                      │
├────────────────────────────────────────┤
│                                        │
│  🎯 Engager II                         │
│  ████████████░░░░░░  8,432 XP          │
│  1,568 to Engager III                  │
│                                        │
│  🔥 STREAK: 14 days (1.5x multiplier)  │
│                                        │
│  ── DAILY REQUIREMENTS ──────────────  │
│                                        │
│  💬 Replies        23/25  ░░           │
│  ████████████████████░░░░              │
│                                        │
│  📝 Posts          3/3   ✓             │
│  ████████████████████████              │
│                                        │
│  ✓ Streak safe for today!              │
│                                        │
│  ── TODAY'S XP ──────────────────────  │
│                                        │
│  Actions:          187 XP              │
│  Bonuses:          +75 XP              │
│  Multiplier:       ×1.5                │
│  ─────────────────────────             │
│  Total:            393 XP              │
│                                        │
│  [📤 Share Today's Stats]              │
│                                        │
└────────────────────────────────────────┘
```

### Progress States

**Requirements not met (streak at risk):**
```
│  ⚠️ STREAK AT RISK                     │
│                                        │
│  💬 Replies        18/25               │
│  ████████████████░░░░░░░░              │
│  Need 7 more to save streak!           │
```

**Requirements met (streak safe):**
```
│  ✓ STREAK SAFE                         │
│                                        │
│  💬 Replies        28/25  ✓            │
│  ████████████████████████ +3 bonus     │
```

### Rank Up Notification

When user reaches a new tier or rank, show a celebratory modal:

```
┌─────────────────────────────────────────────┐
│                                             │
│              🎉 RANK UP! 🎉                 │
│                                             │
│         You are now                         │
│                                             │
│         🎯 Engager II                       │
│                                             │
│    Total XP: 8,432                          │
│    Current Streak: 14 days 🔥               │
│                                             │
│    Next rank: 1,568 XP to Engager III       │
│                                             │
│    [📤 Share Achievement]  [Continue]       │
│                                             │
└─────────────────────────────────────────────┘
```

### Weekly Summary View

Accessible from settings or a dedicated tab:

```
┌─────────────────────────────────────────────────────────┐
│  📅 WEEK OF NOV 18-24                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  OVERVIEW                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Total XP earned:     2,847                      │   │
│  │ Streak status:       14 days 🔥 → 21 days 🔥   │   │
│  │ Rank progress:       Engager I → Engager II    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  DAILY BREAKDOWN                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Mon │ ████████████████████ │ 412 XP │ ✓        │   │
│  │ Tue │ ██████████████████████│ 487 XP │ ✓        │   │
│  │ Wed │ ███████████████░░░░░ │ 298 XP │ ✓        │   │
│  │ Thu │ ████████████████████ │ 401 XP │ ✓        │   │
│  │ Fri │ ██████████████████████│ 523 XP │ ✓ best! │   │
│  │ Sat │ ████████████████░░░░ │ 356 XP │ ✓        │   │
│  │ Sun │ ██████████████░░░░░░ │ 370 XP │ ✓        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ACTIVITY TOTALS                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Replies sent:        189 (avg 27/day)           │   │
│  │ Posts published:     24  (avg 3.4/day)          │   │
│  │ Conversations:       12                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  OUTCOMES                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Reply-backs:         31  (+425 bonus XP)        │   │
│  │ Author likes:        18  (+144 bonus XP)        │   │
│  │ New followers:       8   (+400 bonus XP)        │   │
│  │ New mutuals:         2   (+200 bonus XP)        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [📤 Share Weekly Stats]                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Part 7: Shareable Stats Image

### Purpose

Users can generate and download a PNG image of their daily or weekly stats to share on X. This serves two purposes:

1. **User motivation:** Public accountability, showing off streaks
2. **Amendoa growth:** Viral marketing through user-generated content

### Daily Stats Image Template

```
┌─────────────────────────────────────────────┐
│                                             │
│   🥜 AMENDOA                                │
│   The Reply Guy HUD                         │
│                                             │
│   ─────────────────────────────────────     │
│                                             │
│   @pedrogedge                               │
│                                             │
│   🎯 Engager II                             │
│   ████████████████░░░░  8,432 XP            │
│                                             │
│   🔥 14 day streak                          │
│                                             │
│   ─────────────────────────────────────     │
│                                             │
│   TODAY'S GRIND                             │
│                                             │
│   💬 28 replies     📝 4 posts              │
│   ↩️ 6 reply-backs  👤 +2 followers         │
│                                             │
│   Total: 487 XP earned                      │
│                                             │
│   ─────────────────────────────────────     │
│   amendoa.com                               │
│                                             │
└─────────────────────────────────────────────┘
```

### Weekly Stats Image Template

```
┌─────────────────────────────────────────────┐
│                                             │
│   🥜 AMENDOA                                │
│   The Reply Guy HUD                         │
│                                             │
│   ─────────────────────────────────────     │
│                                             │
│   @pedrogedge's week                        │
│   Nov 18-24, 2025                           │
│                                             │
│   🎯 Engager II        🔥 21 day streak     │
│                                             │
│   ─────────────────────────────────────     │
│                                             │
│   💬 189 replies       📝 24 posts          │
│   ↩️ 31 reply-backs    👤 +8 followers      │
│                                             │
│   📈 2,847 XP earned this week              │
│                                             │
│   ─────────────────────────────────────     │
│   amendoa.com                               │
│                                             │
└─────────────────────────────────────────────┘
```

### Rank Up Achievement Image

```
┌─────────────────────────────────────────────┐
│                                             │
│   🥜 AMENDOA                                │
│                                             │
│   ─────────────────────────────────────     │
│                                             │
│              🎉 RANK UP 🎉                  │
│                                             │
│             @pedrogedge                     │
│                                             │
│           💬 Reply Guy III                  │
│                  ↓                          │
│            🎯 Engager I                     │
│                                             │
│         Total XP: 5,127                     │
│         Streak: 18 days 🔥                  │
│                                             │
│   ─────────────────────────────────────     │
│   amendoa.com                               │
│                                             │
└─────────────────────────────────────────────┘
```

### Image Generation Implementation

Use `html2canvas` for client-side PNG generation:

```javascript
import html2canvas from 'html2canvas'

async function generateShareImage(type = 'daily') {
  // Create a hidden container with the share card HTML
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.width = '500px'  // Fixed width for consistent output
  container.innerHTML = generateShareCardHTML(type)
  document.body.appendChild(container)
  
  // Render to canvas
  const canvas = await html2canvas(container, {
    backgroundColor: '#15202b',  // X dark mode background
    scale: 2  // Retina quality
  })
  
  // Cleanup
  document.body.removeChild(container)
  
  // Convert to blob for download/share
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png')
  })
}

async function downloadShareImage(type = 'daily') {
  const blob = await generateShareImage(type)
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `amendoa-${type}-${getLocalDateString()}.png`
  a.click()
  
  URL.revokeObjectURL(url)
}

function generateShareCardHTML(type) {
  const stats = getCurrentStats()
  const rankInfo = getTierAndRank(stats.totalXP)
  
  // Return HTML string for the share card
  // Style with inline CSS for html2canvas compatibility
  return `
    <div style="
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border-radius: 16px;
    ">
      <!-- Card content here -->
    </div>
  `
}
```

### Share Flow

1. User clicks "Share Today's Stats" button
2. Image generates (1-2 seconds)
3. Options appear:
   - **Download PNG** — saves to device
   - **Copy to Clipboard** — for easy paste (if supported)
   - **Open X with pre-filled text** — `https://twitter.com/intent/tweet?text=...`

```javascript
async function shareToX(type = 'daily') {
  const blob = await generateShareImage(type)
  
  // Download the image first (user needs to attach manually)
  downloadShareImage(type)
  
  // Open X compose with suggested text
  const text = encodeURIComponent(
    `Day ${stats.currentStreak} of the reply guy grind 🔥\n\n` +
    `${rankInfo.display}\n` +
    `${stats.todayReplies} replies • ${stats.todayPosts} posts\n\n` +
    `Tracking my growth with @amendoa_app`
  )
  
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
}
```

**Note:** Twitter's intent URL doesn't support image attachments directly. Users will need to paste the downloaded/copied image manually. This is a known limitation.

---

## Part 8: Detecting Outcome Events

### Challenge

Outcome bonuses (reply-backs, author likes, new followers) require detecting when other users interact with the user's content. This is more complex than tracking user actions.

### Approach 1: Notification Tab Parsing (Recommended for v1)

When the user views their notifications tab, parse the DOM for relevant events:

```javascript
function parseNotifications() {
  const notifications = document.querySelectorAll('[data-testid="notification"]')
  
  notifications.forEach(notification => {
    const text = notification.innerText
    const timestamp = extractTimestamp(notification)
    
    // Check if we've already processed this notification
    const notifId = generateNotificationId(notification)
    if (processedNotifications.has(notifId)) return
    
    // Detect reply-backs
    if (text.includes('replied to your')) {
      recordAction('replyBack')
    }
    
    // Detect likes on replies
    if (text.includes('liked your reply')) {
      recordAction('authorLike')
    }
    
    // Detect new followers
    if (text.includes('followed you')) {
      recordAction('newFollower')
    }
    
    processedNotifications.add(notifId)
  })
}

// Run when user is on notifications tab
const notificationsObserver = new MutationObserver(() => {
  if (window.location.pathname === '/notifications') {
    parseNotifications()
  }
})
```

### Approach 2: XHR/Fetch Interception

If you're already intercepting API calls, notifications API responses contain structured data:

```javascript
// In your existing XHR interceptor
if (url.includes('/notifications')) {
  const data = JSON.parse(responseText)
  processNotificationsData(data)
}
```

### Approach 3: Manual Input (Fallback)

For data that's hard to detect automatically (especially follower count), allow manual input:

```
┌────────────────────────────────────────┐
│  📊 UPDATE OUTCOMES                    │
├────────────────────────────────────────┤
│                                        │
│  New followers today:  [___]           │
│                                        │
│  (Check your profile for current       │
│   follower count)                      │
│                                        │
│  [Update]                              │
│                                        │
└────────────────────────────────────────┘
```

### Recommended v1 Implementation

1. **Auto-detect:** Reply-backs and likes when user views notifications
2. **Manual input:** New followers (with optional daily reminder)
3. **Skip for now:** Complex detection like "reply got 5+ likes"

This keeps implementation simple while still providing the core variable rewards.

---

## Part 9: Performance Considerations

### Storage Size

Estimated storage per day:
- DailyProgress record: ~500 bytes
- Per year: ~180 KB

This is negligible. IndexedDB can handle megabytes easily.

### Computation

All calculations are simple arithmetic:
- XP calculation: O(1)
- Tier/rank lookup: O(1)
- Streak check: O(1)

Zero performance impact on scrolling, tweet parsing, or UI rendering.

### Image Generation

`html2canvas` is the heaviest operation:
- Bundle size: ~40 KB
- Generation time: 1-2 seconds

**Mitigation:** Lazy-load html2canvas only when user clicks share button.

```javascript
async function loadHtml2Canvas() {
  if (!window.html2canvas) {
    const module = await import('html2canvas')
    window.html2canvas = module.default
  }
  return window.html2canvas
}
```

---

## Part 10: Future Considerations (Not in v1)

### Streak Freezes
- Earn 1 freeze per 14-day streak
- Bank up to 3 freezes
- Preserves streak for 1 missed day

### Achievements/Badges
- "First Blood" — First reply-back from a Titan
- "Conversationalist" — 10 continued conversations in one day
- "Consistent" — 30 day streak
- "Century" — 100 replies in one day

### Leaderboards (if multi-user)
- Weekly XP rankings
- Longest active streaks
- Optional anonymized display

### Premium Features
- Custom share card themes
- Extended analytics history
- Streak recovery tokens

---

## Appendix A: Complete XP Reference Table

### Input Actions

| Action | Base XP | Daily Requirement | Max Daily XP |
|--------|---------|-------------------|--------------|
| Reply | 4 | 25 | 100+ (no cap) |
| Post | 15 | 3 | 75 (capped at 5 posts) |
| Conversation continued | 20 | — | No cap |

### Output Bonuses

| Outcome | XP | Detection Method |
|---------|-----|------------------|
| Reply-back received | 25 | Notification parsing |
| Author liked reply | 8 | Notification parsing |
| Reply got 5+ likes | 15 | Future: reply tracking |
| New follower | 50 | Manual input |
| New mutual | 100 | Manual input |

### Streak Multipliers

| Streak Days | Multiplier |
|-------------|------------|
| 0-2 | 1.0x |
| 3-6 | 1.1x |
| 7-13 | 1.25x |
| 14-29 | 1.5x |
| 30+ | 2.0x |

---

## Appendix B: Tier Thresholds

| Tier | Emoji | Name | Min XP | Max XP |
|------|-------|------|--------|--------|
| 1 | 👀 | Lurker | 0 | 1,499 |
| 2 | 💬 | Reply Guy | 1,500 | 4,999 |
| 3 | 🎯 | Engager | 5,000 | 14,999 |
| 4 | 🤝 | Networker | 15,000 | 39,999 |
| 5 | 📢 | Voice | 40,000 | 99,999 |
| 6 | ⭐ | Authority | 100,000 | 299,999 |
| 7 | 👑 | Thought Leader | 300,000 | ∞ |

### Thought Leader Rank Scaling

| Rank | XP Range |
|------|----------|
| I | 300,000 – 399,999 |
| II | 400,000 – 499,999 |
| III | 500,000 – 599,999 |
| IV | 600,000 – 699,999 |
| V | 700,000 – 799,999 |
| ... | +100,000 per rank |

---

*End of Specification Document*
