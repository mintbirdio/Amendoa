# 🥜 Amendoa User Manual

**Amendoa** is a "Head-Up Display" (HUD) for X (formerly Twitter). It overlays advanced analytics and creation tools directly onto your feed, designed to help you grow faster and write better.

---

## 1. The Dashboard (DASH)
*Your Mission Control Center.*

### 🌍 Global Sync
A dual-clock system showing your **Local Time** and **San Francisco (HQ) Time**.
- **Why?** To help you sync your posting schedule with the "Main Character Energy" of Tech Twitter.

### 💓 The Pulse
A gamified tracker of your daily activity.
- **LPM (Likes Per Minute)**: Your current engagement speed.
- **Streak**: Days in a row you've been active.
- **Goal**: Keep the pulse "Green" to maintain momentum.

### 📡 Timeline Radar
A visual scanner for your feed.
- **Hot Tweets**: Automatically highlights tweets with high **Velocity** (fast-growing engagement) with a 🔥 badge.
- **Dead Tweets**: (Optional) Dims tweets with zero engagement to reduce noise.

---

## 2. The Forge (Ghostwriter) 👻
*Your AI Writing Partner.*

The Forge is not a generic text generator. It is a **Style Transfer Engine** designed to mimic specific creators.

### How to Use It
1.  **Capture Style**:
    -   Go to any profile (e.g., `@JustinWelsh`).
    -   Open **The Forge** tab.
    -   Select an Archetype (e.g., "Systematizer").
    -   Click **Capture Style**. The engine "reads" their tweets to learn their sentence structure and rhythm.
2.  **Generate Drafts**:
    -   Enter a raw, boring idea (e.g., "I like coffee").
    -   Click **Generate**.
    -   The engine uses **"Raw Mode"** (no adjectives, sentence fragments, Grade 4 reading level) to write 3 variations in the captured style.
3.  **The Critic**:
    -   Click on any draft.
    -   The **"Ruthless Critic"** agent will roast the draft and rewrite it to be punchier, removing any "AI smell".

---

## 3. Metrics Explained 📊

### 🚀 Velocity ($V_t$)
**Definition**: Engagements Per Minute (EPM).
- **How it works**: We calculate `(Likes + Replies) / Minutes_Since_Posted`.
- **Usage**: Use this to spot "rising stars" before they go viral.

### 👻 Ghost Score ($G$)
**Definition**: A measure of audience authenticity.
- **How it works**: Analyzes follower-to-following ratios and engagement quality.
- **Usage**: Helps you avoid engaging with bot farms or "engagement pods".

### 🤝 Reciprocity Index ($R$)
**Definition**: Your relationship status with another user.
- **Titan**: They have >100k followers (Hard to reach).
- **Peer**: Similar size to you (Good for networking).
- **Fan**: They follow you, but you don't follow back.
- **Friend**: Mutual follow.

---

## 4. Privacy & Security
- **Local First**: All data (styles, metrics) is stored in your browser (`IndexedDB`).
- **API Keys**: Your OpenAI API Key is stored locally and never sent to our servers.
- **No Shadowbans**: Amendoa uses passive DOM reading and does not automate actions (like auto-liking) that would flag your account.
