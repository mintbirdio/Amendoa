# Amendoa - Glass HUD for X/Twitter

A premium Chrome Extension providing advanced analytics and CRM features for Twitter/X power users.

## Quick Start

### Development
```bash
npm install
npm run dev
# Open http://localhost:5173/mock-twitter.html
```

### Production (Load into Chrome)
```bash
npm run build
```

Then:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Features

### Phase 1: Foundation ✅
- Auth Token Extraction (Bearer + CSRF)
- Context Detection (Feed/Profile/Composer)
- Dynamic Configuration (QueryID Mapping)

### Phase 2: Intelligence Layer ✅
- **Velocity Calculator**: Real-time EPM (Engagements Per Minute) using Snowflake ID extraction
- **Ghost Score**: Detects inflated/bot followers
- **Reciprocity Index**: Relationship tracking (Fan/Peer/Admirer)

### Phase 3: Dashboard (In Progress)
- Profile Dossier View
- Timeline Radar View
- Composer Co-Pilot

## Architecture

- **Shadow DOM**: Style isolation
- **Network Interceptor**: Hijacks Twitter's internal GraphQL API
- **Dexie.js**: Local-first data persistence
- **Framer Motion**: Smooth animations
- **Glassmorphism**: Premium UI aesthetic

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Dexie.js (IndexedDB)
- Framer Motion
- Lucide Icons

## License

MIT
