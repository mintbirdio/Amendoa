/**
 * Scout-specific types.
 *
 * `TweetData` (the scoring input) is reused verbatim from the shared scoring
 * core, so the same brain that powers the desktop extension scores tweets here.
 */

import type { TweetData, ScoreBadge, ScoreComponents } from '../../src/shared/scoring';

export type { TweetData, ScoreBadge, ScoreComponents };

/**
 * What Scout watches. Reuse an X List you already curate, or your Following
 * feed — never a hand-built watchlist.
 */
export type WatchSource =
    | { kind: 'list'; listId: string }
    | { kind: 'following'; userId: string };

/** A tweet plus its computed opportunity score, ready to (maybe) alert on. */
export interface ScoredTweet {
    tweet: TweetData;
    score: number;            // 0-100
    badge: ScoreBadge;
    components: ScoreComponents;
    ageMinutes: number;
    /** Author display name, if the source provided one (for nicer alerts). */
    authorName?: string;
    /** Tweet text, if available (for the alert body). */
    text?: string;
}

/** Runtime configuration for a Scout run. */
export interface ScoutConfig {
    /** Only consider tweets posted within this many minutes. */
    freshnessMinutes: number;
    /** Minimum opportunity score (0-100) required to send an alert. */
    minScore: number;
    /** Hard cap on alerts emitted in a single run (anti-spam guard). */
    maxAlertsPerRun: number;
    /** How long (ms) to remember an alerted tweet so we never alert twice. */
    dedupRetentionMs: number;
}

export const DEFAULT_CONFIG: ScoutConfig = {
    freshnessMinutes: 60,
    minScore: 70,
    maxAlertsPerRun: 10,
    dedupRetentionMs: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/** Summary returned from a run — useful for logging and tests. */
export interface RunSummary {
    fetched: number;
    eligible: number;   // passed freshness + originals + score threshold
    deduped: number;    // skipped because already alerted
    alerted: number;
    alerts: ScoredTweet[];
}
