/**
 * D1MeasurementStore — the production MeasurementStore backed by Cloudflare D1
 * (serverless SQLite). `D1Like` is the minimal slice of D1's API we use, so the
 * SQL wiring is testable against a fake. Run `MEASUREMENT_SCHEMA` once at deploy
 * (wrangler d1 migrations / execute) to create the tables.
 */

import type { MeasurementStore } from './MeasurementStore';
import type {
    AlertRow, ReplyActionRow, ReplyOutcomeRow, FollowerSnapshotRow, FunnelStats
} from './types';

export interface D1Stmt {
    bind(...vals: unknown[]): D1Stmt;
    run(): Promise<unknown>;
    all<T = unknown>(): Promise<{ results: T[] }>;
    first<T = unknown>(): Promise<T | null>;
}
export interface D1Like {
    prepare(sql: string): D1Stmt;
}

export const MEASUREMENT_SCHEMA = `
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
`.trim();

interface AlertSqlRow {
    tweet_id: string; author_handle: string; alerted_at: number; posted_at: number;
    score: number; badge: string; author_value: number; timing_multiplier: number;
    competition_factor: number; reply_count_at_alert: number; source: string;
    text: string | null; author_name: string | null;
}

function toAlertRow(r: AlertSqlRow): AlertRow {
    return {
        tweetId: r.tweet_id,
        authorHandle: r.author_handle,
        alertedAt: r.alerted_at,
        postedAt: r.posted_at,
        score: r.score,
        badge: r.badge,
        authorValue: r.author_value,
        timingMultiplier: r.timing_multiplier,
        competitionFactor: r.competition_factor,
        replyCountAtAlert: r.reply_count_at_alert,
        source: r.source,
        text: r.text ?? undefined,
        authorName: r.author_name ?? undefined
    };
}

export class D1MeasurementStore implements MeasurementStore {
    constructor(private readonly db: D1Like) {}

    async recordAlerts(rows: AlertRow[]): Promise<void> {
        for (const r of rows) {
            await this.db.prepare(
                `INSERT OR IGNORE INTO alert
                 (tweet_id, author_handle, alerted_at, posted_at, score, badge,
                  author_value, timing_multiplier, competition_factor, reply_count_at_alert, source, text, author_name)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
            ).bind(
                r.tweetId, r.authorHandle, r.alertedAt, r.postedAt, r.score, r.badge,
                r.authorValue, r.timingMultiplier, r.competitionFactor, r.replyCountAtAlert, r.source,
                r.text ?? null, r.authorName ?? null
            ).run();
        }
    }

    async recordReplyAction(row: ReplyActionRow): Promise<void> {
        await this.db.prepare(
            `INSERT OR REPLACE INTO reply_action
             (tweet_id, replied, replied_at, reply_tweet_id, used_draft, latency_ms)
             VALUES (?,?,?,?,?,?)`
        ).bind(
            row.tweetId, row.replied ? 1 : 0, row.repliedAt ?? null,
            row.replyTweetId ?? null, row.usedDraft ? 1 : 0, row.latencyMs ?? null
        ).run();
    }

    async recordReplyOutcome(row: ReplyOutcomeRow): Promise<void> {
        await this.db.prepare(
            `INSERT OR REPLACE INTO reply_outcome
             (reply_tweet_id, measured_at, likes, replies, retweets, impressions)
             VALUES (?,?,?,?,?,?)`
        ).bind(row.replyTweetId, row.measuredAt, row.likes, row.replies, row.retweets, row.impressions).run();
    }

    async recordFollowerSnapshot(row: FollowerSnapshotRow): Promise<void> {
        await this.db.prepare(
            `INSERT OR REPLACE INTO follower_snapshot
             (day, follower_count, following_count, replies_sent_today, alerts_sent_today)
             VALUES (?,?,?,?,?)`
        ).bind(row.day, row.followerCount, row.followingCount ?? null, row.repliesSentToday ?? null, row.alertsSentToday ?? null).run();
    }

    async recentAlerts(sinceMs: number): Promise<AlertRow[]> {
        const { results } = await this.db
            .prepare(`SELECT * FROM alert WHERE alerted_at >= ? ORDER BY alerted_at DESC`)
            .bind(sinceMs)
            .all<AlertSqlRow>();
        return results.map(toAlertRow);
    }

    async getAlert(tweetId: string): Promise<AlertRow | null> {
        const row = await this.db
            .prepare(`SELECT * FROM alert WHERE tweet_id = ?`)
            .bind(tweetId)
            .first<AlertSqlRow>();
        return row ? toAlertRow(row) : null;
    }

    async getReplyAction(tweetId: string): Promise<ReplyActionRow | null> {
        const r = await this.db
            .prepare(`SELECT * FROM reply_action WHERE tweet_id = ?`)
            .bind(tweetId)
            .first<{ tweet_id: string; replied: number; replied_at: number | null; reply_tweet_id: string | null; used_draft: number | null; latency_ms: number | null }>();
        if (!r) return null;
        return {
            tweetId: r.tweet_id,
            replied: !!r.replied,
            repliedAt: r.replied_at ?? undefined,
            replyTweetId: r.reply_tweet_id ?? undefined,
            usedDraft: r.used_draft != null ? !!r.used_draft : undefined,
            latencyMs: r.latency_ms ?? undefined
        };
    }

    async funnel(): Promise<FunnelStats> {
        const row = await this.db.prepare(
            `SELECT
               (SELECT COUNT(*) FROM alert) AS alerts,
               (SELECT COUNT(*) FROM reply_action WHERE replied=1) AS replied,
               (SELECT COUNT(*) FROM reply_action WHERE replied=1 AND used_draft=1) AS used_draft,
               (SELECT AVG(score) FROM alert) AS avg_score`
        ).first<{ alerts: number; replied: number; used_draft: number; avg_score: number | null }>();

        const alerts = row?.alerts ?? 0;
        const replied = row?.replied ?? 0;
        return {
            alerts,
            replied,
            replyRate: alerts ? replied / alerts : 0,
            usedDraft: row?.used_draft ?? 0,
            avgScore: row?.avg_score ?? 0
        };
    }
}
