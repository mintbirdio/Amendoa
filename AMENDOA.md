# Amendoa

**The Reply Opportunity HUD for X (Twitter)**

Amendoa is a Chrome extension that surfaces high-value reply opportunities from your X feed in real-time. It's built for founders, creators, and professionals who understand that strategic replies are one of the most effective growth levers on X—but only when you reply to the right tweets, at the right time.

---

## The Problem

**Being a "reply guy" without strategy is a waste of time.**

Most people scroll endlessly hoping to stumble upon good threads. They reply to tweets that are already buried under hundreds of comments, or engage with accounts that have no reach. The result? Hours spent with minimal growth.

The accounts that grow fast on X understand three principles:
1. **Reach matters** — Reply to accounts with audiences
2. **Timing is everything** — The algorithm favors early replies
3. **Competition kills visibility** — 200 replies = your comment is invisible

But manually evaluating every tweet for these factors is exhausting. You'd need to check follower counts, calculate tweet age, count existing replies, and somehow keep track of it all while scrolling.

---

## The Solution

Amendoa does this evaluation automatically and surfaces a ranked queue of opportunities worth your attention.

Instead of scrolling and guessing, you open Amendoa's sidebar and see:

- **Ranked opportunities** scored 0-100 based on reach, timing, and competition
- **Position hints** telling you if you'd be FIRST, EARLY, or lost in a MOB
- **Author context** showing follower tier and your relationship history
- **One-click reply** to jump directly to the tweet

The scoring algorithm multiplies three factors:

```
Opportunity = Author Reach × Tweet Freshness × Competition Factor
```

A tweet from a 50K-follower account, posted 3 minutes ago, with zero replies? That's a 90+ score. The same account's tweet from 2 hours ago with 47 replies? That's a 25. Amendoa makes this obvious at a glance.

---

## How the Scoring Works

### Author Value (Who are you replying to?)

| Tier | Followers | Points |
|------|-----------|--------|
| Titan | 100K+ | 25 |
| Star | 50K-100K | 22 |
| Rising | 10K-50K | 20 |
| Emerging | 1K-10K | 15 |
| Peer | <1K | 10 |

Verified/premium accounts get +8 bonus points. Accounts that have engaged with you before get additional relationship bonuses.

### Timing Multiplier (How fresh is the tweet?)

| Age | Multiplier | Why |
|-----|------------|-----|
| 0-5 min | 2.0x | First responder bonus—guaranteed visibility |
| 5-15 min | 1.6x | Excellent positioning |
| 15-30 min | 1.3x | Still great |
| 30-60 min | 1.0x | Baseline |
| 1-2 hours | 0.8x | Declining |
| 2-4 hours | 0.5x | Late to the party |
| 4+ hours | 0.3x | Mostly dead |

The algorithm dramatically favors fresh tweets because X's algorithm does too. 80% of engagement boost happens in the first 5 minutes.

### Competition Factor (How crowded is the thread?)

| Replies | Multiplier | Position Hint |
|---------|------------|---------------|
| 0 | 1.5x | FIRST |
| 1-3 | 1.3x | EARLY |
| 4-10 | 1.0x | GOOD |
| 11-25 | 0.7x | CROWDED |
| 26-50 | 0.5x | VERY CROWDED |
| 51+ | 0.3x | MOB |

If replies are flooding in at 5+ per minute, an additional 30% reduction is applied—these viral moments rarely benefit late arrivals.

### Score Badges

| Badge | Score | Meaning |
|-------|-------|---------|
| HOT | 80+ | Reply NOW |
| HIGH | 60-79 | Great opportunity |
| GOOD | 40-59 | Worth replying |
| MEH | 20-39 | Low priority |
| SKIP | <20 | Don't bother |

---

## The Gamification System

Amendoa includes a gamification layer designed to build consistent engagement habits without being punitive.

### XP System

| Action | XP Earned |
|--------|-----------|
| Send a reply | 4 XP |
| Post a tweet | 15 XP |
| Start a conversation (someone replies back to you) | 25 XP |
| Author likes your reply | 8 XP |
| Your reply gets 5+ likes | 15 XP |
| Gain a new follower | 50 XP |
| Gain a new mutual | 100 XP |
| Daily bonus: 25 replies | +50 XP |
| Daily bonus: 3 posts | +30 XP |

### Tier Progression

| Tier | XP Required |
|------|-------------|
| Lurker | 0 |
| Reply Guy | 1,500 |
| Engager | 5,000 |
| Networker | 15,000 |
| Voice | 40,000 |
| Authority | 100,000 |
| Thought Leader | 300,000+ |

Each tier has three ranks (I, II, III) before advancing to the next tier.

### Streak System

Streaks reward consistency. The rules are simple and forgiving:

- **Maintain streak:** Any activity (1+ reply or post) in a day
- **Break streak:** Zero activity for a full day
- **Streak multiplier:** Applies to all XP earned

| Streak Length | XP Multiplier |
|---------------|---------------|
| 3+ days | 1.1x |
| 7+ days | 1.25x |
| 14+ days | 1.5x |
| 30+ days | 2.0x |

Daily goals (25 replies, 3 posts) are optional bonus targets—not requirements for maintaining your streak. This keeps the system motivating without creating anxiety.

### Shareable Stats

Generate a branded PNG image of your stats with one click. Share your tier, streak, and daily performance directly to X.

---

## Discovery Queue

Beyond manual target tracking, Amendoa's Discovery Queue automatically surfaces high-value opportunities from your feed.

**Filter criteria:**
- Minimum 1,000 followers (ensures reach)
- Posted within last hour (freshness)
- Fewer than 50 replies (manageable competition)
- Original posts only (not replies or pure retweets)

The queue updates in real-time as you browse X, continuously surfacing fresh opportunities without any manual curation.

---

## Privacy & Architecture

**Amendoa is 100% local.** There is no backend, no analytics, no data collection.

- All processing happens in your browser
- Data stored locally in IndexedDB
- Auth tokens captured locally only (never transmitted)
- No network requests to any external server

**Data retention:**
- Tweet cache: 7 days
- Conversations: 30 days
- Your replies: 90 days

**Tech stack:**
- Chrome Extension (Manifest V3)
- React + TypeScript
- Tailwind CSS
- Dexie.js (IndexedDB)
- Shadow DOM for style isolation

---

## Installation

1. Clone the repository
2. Run `npm install`
3. Run `npm run build`
4. Open Chrome → Extensions → Enable Developer Mode
5. Click "Load unpacked" → Select the `dist` folder
6. Navigate to X (twitter.com)
7. The Amendoa sidebar appears on the right

---

## Who This Is For

**Ideal users:**
- Founders building in public who want to grow their audience
- Creators who understand the value of strategic engagement
- Professionals using X for networking and visibility
- Anyone following a "reply guy" growth strategy

**Not for:**
- Automated engagement / spam tactics
- People looking for a "set and forget" growth tool
- Users uncomfortable with Chrome extensions

---

## The Philosophy

Amendoa is built on a simple belief: **strategy beats volume.**

100 thoughtful replies to high-value tweets will outperform 1,000 random comments. But identifying those high-value opportunities manually is exhausting. Amendoa handles the analysis so you can focus on writing replies that actually matter.

The gamification layer exists to build habits, not to create addiction. Streaks are maintained by any activity—we're not trying to guilt you into engagement quotas. The goal is sustainable consistency, not burnout.

---

## Roadmap

**Current (v1):**
- Opportunity scoring and queue
- Gamification with XP, tiers, and streaks
- Discovery queue from feed
- Shareable stats

**Planned:**
- Relationship CRM (track who engages back)
- Performance analytics (which reply styles work)
- Custom filters and priorities
- Cross-browser support (Firefox, Safari)

---

## FAQ

**Does this violate X's terms of service?**
No. Amendoa only reads data that's already visible in your feed and provides a UI overlay. It doesn't automate any actions, doesn't use unofficial APIs, and doesn't modify your requests to X.

**Why local-only?**
Privacy and simplicity. Your X activity is your business. A backend would mean infrastructure costs, data security obligations, and trust requirements. Local-only means you're in complete control.

**Can I use this with multiple X accounts?**
Currently, Amendoa works with whichever account is logged in. Multi-account support is on the roadmap.

**How accurate is the follower count detection?**
Amendoa reads follower counts directly from X's API responses in your feed. It's as accurate as what X shows you.

**Does this work on mobile?**
No. Amendoa is a Chrome extension for desktop browsers only.

---

## Support & Feedback

- GitHub Issues: [Report bugs and request features]
- X: [@your_handle]

---

*Amendoa: Stop scrolling. Start targeting.*
