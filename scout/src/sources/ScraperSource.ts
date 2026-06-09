/**
 * ScraperSource — v0 data source via twitterapi.io. ~33× cheaper than the
 * official X API ($0.00015 vs $0.005 per tweet read); personal use only.
 *
 * The HTTP call and the JSON→TweetData mapping are split so the mapping is pure
 * and fully unit-tested, and the HTTP is injectable (a fake `fetch` in tests).
 *
 * Verified against twitterapi.io docs (2026): the List Tweets endpoint is
 * `GET /twitter/list/tweets?listId=…` with an `X-API-Key` header, returning
 * `{ tweets: [...], has_next_page, next_cursor }`. Tweet/author field names
 * (id, text, createdAt, likeCount, …, author.userName/followers/isBlueVerified)
 * are matched by `mapRawTweet`, which stays defensive about field-name variants.
 *
 * Note: the endpoint is cursor-paginated (~20 tweets/page; there is no `limit`
 * param). Scout fetches the newest page only — ample for a curated list polled
 * every few minutes. (Cursor paging is a future knob if a list is very busy.)
 */

import type { TweetData, WatchSource } from '../types';
import type { TweetSource, SourceTweet, FetchFn } from './TweetSource';
import { snowflakeToTimestamp } from '../snowflake';
import { normalizeHandle } from '../../../src/shared/scoring';

export interface ScraperSourceOptions {
    apiKey: string;
    /** Base URL of the scraper API. Defaults to twitterapi.io. */
    baseUrl?: string;
    /** Injected fetch (defaults to global fetch). */
    fetchFn?: FetchFn;
}

/** Loose shape of a raw tweet object returned by the scraper. */
export interface RawTweet {
    id?: string;
    id_str?: string;
    text?: string;
    full_text?: string;
    created_at?: string;          // e.g. "Wed Jun 03 18:20:00 +0000 2026"
    createdAt?: string;
    like_count?: number;
    likeCount?: number;
    retweet_count?: number;
    retweetCount?: number;
    reply_count?: number;
    replyCount?: number;
    view_count?: number;
    viewCount?: number;
    is_reply?: boolean;
    isReply?: boolean;
    in_reply_to_status_id?: string | null;
    is_quote?: boolean;
    retweeted_tweet?: unknown;
    is_retweet?: boolean;
    conversation_id?: string;
    author?: RawAuthor;
    user?: RawAuthor;
}

export interface RawAuthor {
    userName?: string;
    screen_name?: string;
    name?: string;
    followers?: number;
    followers_count?: number;
    followersCount?: number;
    isBlueVerified?: boolean;
    is_blue_verified?: boolean;
    verified?: boolean;
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
        const raw = extractTweets(json);
        const cutoff = Date.now() - sinceMinutes * 60 * 1000;

        const out: SourceTweet[] = [];
        for (const rt of raw) {
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

// =============================================================================
// PURE MAPPING (unit-tested)
// =============================================================================

/** Pull the tweet array out of whatever envelope the provider wraps it in. */
export function extractTweets(json: unknown): RawTweet[] {
    if (Array.isArray(json)) return json as RawTweet[];
    if (json && typeof json === 'object') {
        const obj = json as Record<string, unknown>;
        for (const key of ['tweets', 'data', 'results', 'statuses']) {
            const v = obj[key];
            if (Array.isArray(v)) return v as RawTweet[];
        }
    }
    return [];
}

export function isRetweet(rt: RawTweet): boolean {
    return Boolean(rt.is_retweet) || rt.retweeted_tweet != null;
}

function num(...vals: Array<number | undefined>): number {
    for (const v of vals) if (typeof v === 'number' && Number.isFinite(v)) return v;
    return 0;
}

function firstStr(...vals: Array<string | undefined>): string | undefined {
    for (const v of vals) if (typeof v === 'string' && v.length > 0) return v;
    return undefined;
}

/**
 * Map a raw scraper tweet to the shared `TweetData`. Returns null if the tweet
 * lacks the minimum required fields (id + a usable timestamp + author handle).
 */
export function mapRawTweet(rt: RawTweet): SourceTweet | null {
    const tweetId = firstStr(rt.id_str, rt.id);
    if (!tweetId) return null;

    const author = rt.author ?? rt.user ?? {};
    const handle = firstStr(author.userName, author.screen_name);
    if (!handle) return null;

    const postedAt = resolvePostedAt(rt, tweetId);
    if (postedAt == null) return null;

    const isReply = Boolean(rt.is_reply ?? rt.isReply) ||
        (rt.in_reply_to_status_id != null && rt.in_reply_to_status_id !== '');

    const followers = num(author.followers, author.followers_count, author.followersCount);
    const premium = Boolean(author.isBlueVerified ?? author.is_blue_verified ?? author.verified);

    const data: TweetData = {
        tweetId,
        authorHandle: normalizeHandle(handle),
        postedAt,
        likes: num(rt.like_count, rt.likeCount),
        retweets: num(rt.retweet_count, rt.retweetCount),
        replies: num(rt.reply_count, rt.replyCount),
        views: num(rt.view_count, rt.viewCount),
        isReply,
        // Thread membership isn't reliably derivable from the scraper payload
        // (conversation_id == id is true for every root tweet), and scoring
        // doesn't use it — so don't guess.
        isThread: false,
        authorFollowerCount: followers,
        authorIsPremium: premium
    };

    return {
        data,
        authorName: firstStr(author.name),
        text: firstStr(rt.full_text, rt.text)
    };
}

/** Resolve a posted-at timestamp from created_at, else the snowflake id. */
function resolvePostedAt(rt: RawTweet, tweetId: string): number | null {
    const created = firstStr(rt.created_at, rt.createdAt);
    if (created) {
        const t = Date.parse(created);
        if (Number.isFinite(t)) return t;
    }
    const fromId = snowflakeToTimestamp(tweetId);
    return fromId ?? null;
}

async function safeText(res: { text(): Promise<string> }): Promise<string> {
    try {
        return await res.text();
    } catch {
        return '';
    }
}
