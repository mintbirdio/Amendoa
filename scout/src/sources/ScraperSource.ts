/**
 * ScraperSource — data source via twitterapi.io (~33× cheaper than the official
 * API, but unauthorized scraping → personal/throwaway use only). Retained as a
 * cheap fallback; the legit default is `OfficialXSource`.
 *
 * The JSON→TweetData mapping now lives in `./mapTweet` (shared with the official
 * source and the webhook parser); this file is just the HTTP call. The mapper is
 * re-exported below so existing importers (webhook payload parser, tests) are
 * unaffected by the move.
 */

import type { WatchSource } from '../types';
import type { TweetSource, SourceTweet, FetchFn } from './TweetSource';
import { extractTweets, isRetweet, mapRawTweet } from './mapTweet';

export { extractTweets, isRetweet, mapRawTweet } from './mapTweet';
export type { RawTweet, RawAuthor } from './mapTweet';

export interface ScraperSourceOptions {
    apiKey: string;
    /** Base URL of the scraper API. Defaults to twitterapi.io. */
    baseUrl?: string;
    /** Injected fetch (defaults to global fetch). */
    fetchFn?: FetchFn;
}

const DEFAULT_BASE = 'https://api.twitterapi.io';

export class ScraperSource implements TweetSource {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly fetchFn: FetchFn;

    constructor(opts: ScraperSourceOptions) {
        if (!opts.apiKey) throw new Error('ScraperSource: apiKey is required');
        this.apiKey = opts.apiKey;
        this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
        this.fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
    }

    buildUrl(source: WatchSource): string {
        return `${this.baseUrl}/twitter/list/tweets?listId=${encodeURIComponent(source.listId)}`;
    }

    async fetchRecentOriginals(source: WatchSource, sinceMinutes: number): Promise<SourceTweet[]> {
        const url = this.buildUrl(source);
        const res = await this.fetchFn(url, {
            method: 'GET',
            headers: { 'X-API-Key': this.apiKey, 'Accept': 'application/json' }
        });

        if (!res.ok) {
            const body = await safeText(res);
            throw new Error(`ScraperSource: HTTP ${res.status} from ${url} — ${body.slice(0, 200)}`);
        }

        const json = await res.json();
        const cutoff = Date.now() - sinceMinutes * 60 * 1000;

        const out: SourceTweet[] = [];
        for (const rt of extractTweets(json)) {
            const mapped = mapRawTweet(rt);
            if (!mapped) continue;
            if (mapped.data.isReply) continue;            // originals only
            if (isRetweet(rt)) continue;                  // no retweets
            if (mapped.data.postedAt < cutoff) continue;  // freshness
            out.push(mapped);
        }
        // newest first
        out.sort((a, b) => b.data.postedAt - a.data.postedAt);
        return out;
    }
}

async function safeText(res: { text(): Promise<string> }): Promise<string> {
    try {
        return await res.text();
    } catch {
        return '';
    }
}
