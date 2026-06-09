/**
 * Parse a twitterapi.io push payload into Scout's `SourceTweet[]`.
 *
 * Verified payload shape (2026): the service POSTs
 *   { event_type: "tweet", rule_id, rule_tag, tweets: [ <tweet>, ... ], timestamp }
 * where each tweet uses the same field names ScraperSource already maps. We
 * reuse that mapper verbatim, so the scoring brain sees identical `TweetData`
 * whether tweets arrive by pull (List poll) or push (webhook). Retweets are
 * dropped here (the rule excludes them too, but stay defensive); replies and
 * freshness are the pipeline's job (`processBatch`).
 */

import { extractTweets, mapRawTweet, isRetweet, type RawTweet } from '../sources/ScraperSource';
import type { SourceTweet } from '../sources/TweetSource';

export function parseWebhookTweets(body: unknown): SourceTweet[] {
    // Non-tweet control frames (e.g. "connected", "ping") carry no tweets — ignore.
    if (body && typeof body === 'object') {
        const eventType = (body as { event_type?: unknown }).event_type;
        if (typeof eventType === 'string' && eventType !== 'tweet') return [];
    }

    const out: SourceTweet[] = [];
    for (const rt of extractTweets(body) as RawTweet[]) {
        const mapped = mapRawTweet(rt);
        if (!mapped) continue;
        if (isRetweet(rt)) continue;
        out.push(mapped);
    }
    return out;
}
