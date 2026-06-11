/**
 * Scout-specific types.
 *
 * `TweetData` (the scoring input) is reused verbatim from the shared scoring
 * core, so the same brain that powers the desktop extension scores tweets here.
 */

import type { TweetData, ScoreBadge, ScoreComponents } from '../../src/shared/scoring';

export type { TweetData, ScoreBadge, ScoreComponents };

/**
 * What Scout watches: an X List you already curate — never a hand-built
 * watchlist. A List is a single timeline endpoint (O(1) per poll), which is the
 * only way to read a merged feed cheaply. There is no aggregated "following
 * timeline" endpoint on the scraper (or an affordable one on the official API),
 * so a true Following feed would require per-account fan-out whose cost scales
 * with how many accounts you follow — deliberately not supported. Mirror your
 * follows into a List instead.
 */
export type WatchSource =
    | { kind: 'list'; listId: string; userId?: string };
//                                    ^ optional: which user this watch belongs to,
//   so the credential provider can attribute/scope reads per user in Phase 1+.

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
