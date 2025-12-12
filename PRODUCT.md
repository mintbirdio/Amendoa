# Amendoa

**Reply Opportunity HUD for X (Twitter)**

Amendoa surfaces high-value reply opportunities in real-time from your feed. Built for founders, creators, and professionals who want to grow through strategic engagement.

---

## The Problem

> "Being a reply guy without a strategy is pointless."

Most people either:
- Reply to everything with low-value comments → no traction
- Don't reply at all → miss visibility opportunities

The difference is **strategy + quality + timing**.

Amendoa helps with timing and targeting. You provide the quality.

---

## What Amendoa Does

**One thing well:** Shows you the best tweets to reply to, right now.

As you browse X (For You, Following, Communities, Lists), Amendoa scans your feed and surfaces tweets that are:

1. **From accounts with reach** (1k+ followers)
2. **Fresh enough to matter** (< 1 hour old)
3. **Low competition** (< 50 replies)
4. **Original posts** (not replies to other tweets)

Each opportunity is scored and ranked so you can focus on the highest-value replies.

---

## Features

### Reply Opportunity Queue

A prioritized list of tweets worth replying to, scored 0-100.

**Score factors:**
- Author reach (follower count)
- Timing (fresher = better)
- Competition (fewer replies = better positioning)
- Premium status (verified accounts get slight boost)

**Score badges:**
- 🔥 **Hot** (80+) — Reply NOW
- ⚡ **High** (60-79) — Great opportunity
- ✓ **Good** (40-59) — Worth replying
- ~ **Meh** (20-39) — Low priority

**Position hints:**
- **FIRST** — 0 replies, you'd be first
- **EARLY** — 1-3 replies, great positioning
- **GOOD** — 4-10 replies, still visible
- **CROWDED** — 11-25 replies, need quality
- **MOB** — 25+ replies, probably skip

---

### Time Decay

Opportunities decay over time. A tweet that was "Hot" at 3 minutes becomes "Good" at 20 minutes. This keeps you focused on fresh content where the algorithm boost is real.

---

### Gamification

Track your engagement consistency with XP and streaks.

**XP System:**
| Action | XP |
|--------|-----|
| Reply | 4 XP |
| Post | 15 XP |

**Streak Multipliers:**
- 3+ days: 1.1x
- 7+ days: 1.25x
- 14+ days: 1.5x
- 30+ days: 2.0x

**Daily Goals:**
- 25 replies → +50 bonus XP
- 3 posts → +30 bonus XP

The gamification builds the habit. It's not the goal.

---

## How It Works

1. **You browse X normally** — For You, Following, Communities, Lists
2. **Amendoa intercepts your feed** — Captures tweet data as you scroll
3. **Opportunities are scored** — Based on reach, timing, competition
4. **Queue updates in real-time** — See the best tweets to reply to
5. **Click "Reply" to jump** — Opens the tweet for your response

All processing happens locally in your browser. No data is sent anywhere.

---

## What Amendoa Does NOT Do

- ❌ Auto-reply or post on your behalf
- ❌ Suggest what to write (you add the value)
- ❌ Send data to external servers
- ❌ Track your analytics (use X's built-in analytics)
- ❌ Work if you're not actively browsing X

---

## The Strategy

From the X growth playbook:

> "Reply AND post. Replies get you seen early. Posts are why people follow you."

Amendoa optimizes the "reply" side:

| Playbook Advice | How Amendoa Helps |
|-----------------|-------------------|
| "Target mid-size accounts (5k-50k)" | Shows follower count, prioritizes reach |
| "Be fast — algorithm favors recency" | Time decay scoring, fresh opportunities first |
| "Add value, not just comments" | Low-competition filter = worth investing quality |
| "2 bangers + 8-10 targeted replies/day" | Daily goals track this cadence |

**What you still need to do:**
- Write replies that add value (insights, resources, questions)
- Create your own posts ("bangers")
- Be authentic and build real relationships

Amendoa finds the opportunities. You provide the value.

---

## Technical Details

- **Chrome Extension** (Manifest V3)
- **Local storage only** (IndexedDB via Dexie.js)
- **Shadow DOM** for style isolation
- **React + TypeScript + Tailwind**

Data retention:
- Tweet cache: 7 days
- Reply history: 90 days
