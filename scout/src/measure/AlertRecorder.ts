/**
 * AlertRecorder — the pipeline's hook into measurement. `processBatch` calls
 * `record(alerted, at)` after it flushes, so every pushed alert lands in the
 * proof schema. Injected + optional, so the core pipeline stays measurement-
 * agnostic and tests can pass a no-op.
 */

import type { ScoredTweet } from '../types';
import type { MeasurementStore } from './MeasurementStore';
import type { AlertRow } from './types';

export interface AlertRecorder {
    record(alerts: ScoredTweet[], at: number): Promise<void>;
}

export class NoopAlertRecorder implements AlertRecorder {
    async record(): Promise<void> { /* measurement disabled */ }
}

/** Map a scored+alerted tweet to a measurement row. */
export function toAlertRow(s: ScoredTweet, at: number, source: string): AlertRow {
    return {
        tweetId: s.tweet.tweetId,
        authorHandle: s.tweet.authorHandle,
        alertedAt: at,
        postedAt: s.tweet.postedAt,
        score: s.score,
        badge: s.badge,
        authorValue: s.components.authorValue,
        timingMultiplier: s.components.timingMultiplier,
        competitionFactor: s.components.competitionFactor,
        replyCountAtAlert: s.tweet.replies,
        source
    };
}

/** Records alerts into a MeasurementStore, tagging them with the ingest source. */
export class MeasurementRecorder implements AlertRecorder {
    constructor(private readonly store: MeasurementStore, private readonly source: string = 'poll') {}
    async record(alerts: ScoredTweet[], at: number): Promise<void> {
        if (alerts.length === 0) return;
        await this.store.recordAlerts(alerts.map(a => toAlertRow(a, at, this.source)));
    }
}
