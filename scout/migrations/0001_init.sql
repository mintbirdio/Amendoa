-- Scout D1 schema — the Phase-0 proof tables + the voice profile.
-- Apply with:  npm run db:init   (wrangler d1 execute scout-db --remote --file=...)
-- Kept in sync with MEASUREMENT_SCHEMA (src/measure/D1MeasurementStore.ts) and
-- VOICE_SCHEMA (src/voice/VoiceStore.ts).

CREATE TABLE IF NOT EXISTS alert (
  tweet_id TEXT PRIMARY KEY,
  author_handle TEXT NOT NULL,
  alerted_at INTEGER NOT NULL,
  posted_at INTEGER NOT NULL,
  score REAL NOT NULL,
  badge TEXT NOT NULL,
  author_value REAL, timing_multiplier REAL, competition_factor REAL,
  reply_count_at_alert INTEGER,
  source TEXT NOT NULL,
  text TEXT,
  author_name TEXT
);

CREATE TABLE IF NOT EXISTS reply_action (
  tweet_id TEXT PRIMARY KEY,
  replied INTEGER NOT NULL,
  replied_at INTEGER,
  reply_tweet_id TEXT,
  used_draft INTEGER,
  latency_ms INTEGER
);

CREATE TABLE IF NOT EXISTS reply_outcome (
  reply_tweet_id TEXT PRIMARY KEY,
  measured_at INTEGER NOT NULL,
  likes INTEGER, replies INTEGER, retweets INTEGER, impressions INTEGER
);

CREATE TABLE IF NOT EXISTS follower_snapshot (
  day TEXT PRIMARY KEY,
  follower_count INTEGER NOT NULL,
  following_count INTEGER,
  replies_sent_today INTEGER,
  alerts_sent_today INTEGER
);

CREATE TABLE IF NOT EXISTS voice_profile (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
