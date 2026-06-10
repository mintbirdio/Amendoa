/**
 * MeasurementStore — the seam over the Phase-0 proof data. Production uses
 * `D1MeasurementStore` (Cloudflare D1); tests and local dry-runs use
 * `InMemoryMeasurementStore` (no DB, real logic). Semantic methods, not raw SQL,
 * so the behavior is fully unit-tested without a database.
 */

import type {
    AlertRow, ReplyActionRow, ReplyOutcomeRow, FollowerSnapshotRow, FunnelStats
} from './types';

export interface MeasurementStore {
    /** Insert alert rows; first write per tweetId wins (idempotent on re-alert attempts). */
    recordAlerts(rows: AlertRow[]): Promise<void>;
    recordReplyAction(row: ReplyActionRow): Promise<void>;
    recordReplyOutcome(row: ReplyOutcomeRow): Promise<void>;
    recordFollowerSnapshot(row: FollowerSnapshotRow): Promise<void>;
    /** Alerts emitted at/after `sinceMs` — used to match your own replies back to alerts. */
    recentAlerts(sinceMs: number): Promise<AlertRow[]>;
    funnel(): Promise<FunnelStats>;
}

export class InMemoryMeasurementStore implements MeasurementStore {
    private readonly alerts = new Map<string, AlertRow>();
    private readonly actions = new Map<string, ReplyActionRow>();
    private readonly outcomes = new Map<string, ReplyOutcomeRow>();
    private readonly snapshots = new Map<string, FollowerSnapshotRow>();

    async recordAlerts(rows: AlertRow[]): Promise<void> {
        for (const r of rows) if (!this.alerts.has(r.tweetId)) this.alerts.set(r.tweetId, r);
    }
    async recordReplyAction(row: ReplyActionRow): Promise<void> {
        this.actions.set(row.tweetId, row);
    }
    async recordReplyOutcome(row: ReplyOutcomeRow): Promise<void> {
        this.outcomes.set(row.replyTweetId, row);
    }
    async recordFollowerSnapshot(row: FollowerSnapshotRow): Promise<void> {
        this.snapshots.set(row.day, row);
    }
    async recentAlerts(sinceMs: number): Promise<AlertRow[]> {
        return [...this.alerts.values()]
            .filter(a => a.alertedAt >= sinceMs)
            .sort((a, b) => b.alertedAt - a.alertedAt);
    }
    async funnel(): Promise<FunnelStats> {
        const all = [...this.alerts.values()];
        const acted = [...this.actions.values()].filter(a => a.replied);
        const alerts = all.length;
        return {
            alerts,
            replied: acted.length,
            replyRate: alerts ? acted.length / alerts : 0,
            usedDraft: acted.filter(a => a.usedDraft).length,
            avgScore: alerts ? all.reduce((s, a) => s + a.score, 0) / alerts : 0
        };
    }

    // --- test/debug helpers (not part of the interface) ---
    snapshot() {
        return {
            alerts: [...this.alerts.values()],
            actions: [...this.actions.values()],
            outcomes: [...this.outcomes.values()],
            snapshots: [...this.snapshots.values()]
        };
    }
}
