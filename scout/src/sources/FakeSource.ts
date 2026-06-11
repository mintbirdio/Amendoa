/**
 * In-memory TweetSource for tests and local dry-runs (no API key needed).
 */

import type { WatchSource } from '../types';
import type { TweetSource, SourceTweet } from './TweetSource';

export class FakeSource implements TweetSource {
    constructor(private readonly tweets: SourceTweet[]) {}

    async fetchRecentOriginals(_source: WatchSource, _sinceMinutes: number): Promise<SourceTweet[]> {
        // Structural filtering only; the pipeline owns freshness (with its injected clock).
        return this.tweets
            .filter(t => !t.data.isReply)
            .sort((a, b) => b.data.postedAt - a.data.postedAt);
    }
}
