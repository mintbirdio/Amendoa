# Amendoa: Technical Blueprint & Engineering Spec

**Amendoa** implies something organic, essential, and premium. A "kernel" of value. The design language should not be "gamers," but **"High-Finance / Sci-Fi / Luxury."** Think of the UI in movies like *Ex Machina* or *Blade Runner 2049*—dark, glass, amber accents, and incredibly slick data visualization.

Here is the **Revised Technical & Design Blueprint** for **Amendoa**.

---

# 🌑 Project Amendoa: The Glass HUD

Core Philosophy: "Kinetic Intelligence." We do not "play a game." We operate a system.

Visual Language: Dark-Mode Glassmorphism ("Liquid Glass").

Color Palette: Deep Space Grey, Almond Gold, Bioluminescent Amber.

---

## 1. The Design: 2025 "Liquid Glass" Aesthetics

The UI is a **Head-Up Display (HUD)** that floats over X. It must feel like it is *part* of the screen, not an external tool.

### A. The "Amendoa" Color System

Forget the "Matrix Green" or "Twitter Blue." We are building a luxury tool.

- **The Void (Backgrounds):** `rgba(18, 18, 18, 0.85)` — A deep, near-black grey with heavy blur.
- **The Kernel (Primary Accent):** `#E4D0A4` (Pale Almond) — For primary data and text.
- **The Burn (Action/Velocity):** `#D97706` (Amber/Gold) — Used *only* for high-velocity alerts.
- **The Glass:** `backdrop-filter: blur(20px) saturate(180%)` — This creates that "Apple Vision Pro" frosted look.

### B. The "Liquid" Sidebar

Instead of a solid box, the sidebar is a floating pane of glass on the right.

- **Shadow DOM:** We inject the app inside a `Shadow Root` to ensure Twitter’s CSS never bleeds into our glass.
- **Border:** A 1px border of `rgba(255, 255, 255, 0.1)` to simulate the edge of a cut diamond.

---

## 2. The Universal Strategy: "Kinetic Growth"

Since we are removing the specific "2x2" content strategy, we replace it with **Universal Mechanics** that work for *any* niche (Crypto, Art, Tech, Politics).

### Module 1: The Pulse (Velocity Radar)

*The problem: You are replying to dead tweets.*

- **The Tech:** The "Listener" script intercepts the tweet stream.
- **The Logic:** It ignores "Total Likes." It calculates **Likes Per Minute (LPM)**.
- **The UI:**
    - Amendoa highlights specific tweets in the feed with a **faint Amber Glow**.
    - **Hover Effect:** When you mouse over a glowing tweet, a small glass tooltip appears: *"Velocity: 4.2 LPM. Trending in Tech."*

### Module 2: The Orbit (Relationship CRM)

*The problem: You forget who your friends are.*

- **The Tech:** IndexedDB stores a local "CRM" of everyone you interact with.
- **The UI:** Next to every username on your timeline, Amendoa renders a tiny **"Orbit Ring"**.
    - **Empty Ring:** Stranger.
    - **Partial Gold Ring:** You’ve replied once.
    - **Full Gold Ring:** Peer (Mutals).
    - **Glowing Ring:** "Titan" (High Priority Target).
- **Why it works:** You instantly know—without thinking—who deserves a reply.

### Module 3: The Flow (Consistency Engine)

*The problem: You break the chain.*

- **The Tech:** A simple daily counter that resets at 00:00.
- **The UI:** At the top of your Sidebar is the **"Amendoa Core"**—a minimalist, breathing abstract shape.
    - **Morning:** It is dim.
    - **As you engage:** It fills up with "liquid" light.
    - **Goal Met:** It glows bright Amber.
    - *No confetti. No cartoons. Just satisfying, silent progress.*

---

## 3. Technical Blueprint (For the Engineers)

**Copy and paste this section to your development team.**

> Project Name: Amendoa (Chrome Extension)
> 
> 
> Stack: React, TypeScript, Vite, Tailwind CSS (configured for Glassmorphism).
> 
> Manifest: V3.
> 
> **Core Architecture:**
> 
> 1. **The Injector:** A Content Script that creates a `div` host element (`#amendoa-root`) and attaches a Shadow DOM. All React components render *inside* this shadow root to prevent style conflicts.
> 2. **The Interceptor:** Use `xhook` or Monkey-patch `XMLHttpRequest` to listen for requests to `TwitterAPI/HomeTimeline`.
>     - *Crucial:* Do not fetch data. **Listen** to data. Parse the JSON response bodies to extract Tweet Metrics and User IDs.
> 3. **The Data Layer:**
>     - Use `Dexie.js` (wrapper for IndexedDB) to store:
>         - `UserInteractions`: { userId, replyCount, lastInteractedAt }
>         - `VelocityCache`: { tweetId, likesAtLoad, timestamp }
> 
> **UI Requirements:**
> 
> - **Library:** Use `framer-motion` for the "breathing" core animations.
> - **Glass Effect:** All panels must use:CSS
>     
>     # 
>     
>     `background: rgba(20, 20, 20, 0.6);
>     backdrop-filter: blur(16px);
>     border-left: 1px solid rgba(255, 255, 255, 0.08);
>     box-shadow: -10px 0 30px rgba(0,0,0,0.5);`
>     
> 
> **The "No-API" Constraint:**
> 
> - There is NO backend server for data scraping.
> - The extension is "Local First." All metrics are calculated client-side based on the user's viewed content.

---

## 4. The "Personalization" Onboarding

To resell this, the tool needs to adapt to the user. When they first install Amendoa, show a slick, dark-modal wizard:

**Question 1: "Define Your Signal."**

- *Input:* "What topics do you track?" (e.g., AI, Design).
- *Result:* Amendoa scans tweet text for these keywords and boosts their "Velocity Score" by 20%.

**Question 2: "Calibrate Your Orbit."**

- *Input:* "Who are the Titans?" (User lists 3 accounts).
- *Result:* These users get a permanent **Gold Ring** in the UI.

**Question 3: "Set Your Frequency."**

- *Slider:* "Low Orbit (Casual)" vs "High Velocity (Growth)."
- *Result:* Sets the "Daily Replies" goal (10 vs 50).

### What is the next step?

This plan is now fully completely divorced from the previous specific "MintBird" strategy and stands on its own as a premium SaaS product.

Do you have a developer ready, or do you need a **"Job Description"** written in this specific "Amendoa" tone to attract high-end engineers?