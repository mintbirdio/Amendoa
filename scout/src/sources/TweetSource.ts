/**
 * The data-source seam — the ONE interface that changes when you swap the
 * scraper for the official X API later. Everything downstream (scoring, dedup,
 * notify) is source-agnostic.
 */

import type { TweetData, WatchSource } from '../types';

/** A tweet with the optional display extras a source may provide. */
export interface SourceTweet {
    data: TweetData;
    authorName?: string;
    text?: string;
}

export interface TweetSource {
    /**
     * Fetch recent ORIGINAL posts (no replies/retweets) from a watched source,
     * newest first. Implementations should already exclude replies/retweets and
     * tweets older than `sinceMinutes`, but the pipeline re-checks defensively.
     */
    fetchRecentOriginals(source: WatchSource, sinceMinutes: number): Promise<SourceTweet[]>;
}

/** Minimal fetch signature so adapters accept an injected fetch in tests. */
export type FetchFn = (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;
