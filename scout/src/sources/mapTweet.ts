/**
 * Pure JSON→TweetData mapping, shared by every data source (ScraperSource,
 * OfficialXSource) and the webhook payload parser. No network and no provider
 * specifics beyond defensive field-name handling — fully unit-tested. Each
 * source flattens its own wire shape into `RawTweet`, then this maps it.
 */

import type { TweetData } from '../types';
import type { SourceTweet } from './TweetSource';
import { snowflakeToTimestamp } from '../snowflake';
import { normalizeHandle } from '../../../src/shared/scoring';

/** Loose, union-of-providers shape of a raw tweet. Sources flatten into this. */
export interface RawTweet {
    id?: string;
    id_str?: string;
    text?: string;
    full_text?: string;
    created_at?: string;          // e.g. "Wed Jun 03 18:20:00 +0000 2026" or ISO 8601
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
    username?: string;       // webhook push payload + X v2 use lowercase
    screen_name?: string;
    name?: string;
    followers?: number;
    followers_count?: number;
    followersCount?: number;
    isBlueVerified?: boolean;
    is_blue_verified?: boolean;
    verified?: boolean;
}

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
 * Map a raw tweet to the shared `TweetData`. Returns null if the tweet lacks the
 * minimum required fields (id + a usable timestamp + author handle).
 */
export function mapRawTweet(rt: RawTweet): SourceTweet | null {
    const tweetId = firstStr(rt.id_str, rt.id);
    if (!tweetId) return null;

    const author = rt.author ?? rt.user ?? {};
    const handle = firstStr(author.userName, author.username, author.screen_name);
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
        // Thread membership isn't reliably derivable, and scoring doesn't use it.
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
