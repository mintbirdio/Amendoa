/**
 * Notifier seam — how an alert reaches your phone. Pushover today, Telegram or
 * web-push later, behind one interface.
 */

import type { ScoredTweet } from '../types';
import { getTimingLabel, getPositionHint, normalizeHandle } from '../../../src/shared/scoring';
import { tweetPermalink } from '../scoring';

export interface Alert {
    title: string;
    message: string;
    /** The bare X permalink — tapping it deep-links into the X app on the tweet. */
    url: string;
    urlTitle: string;
    /** 0-100 opportunity score, for priority mapping. */
    score: number;
}

export interface Notifier {
    send(alert: Alert): Promise<void>;
}

/**
 * Build a phone-friendly alert from a scored tweet. Pure → unit-tested.
 */
export function buildAlert(scored: ScoredTweet): Alert {
    const { tweet } = scored;
    const handle = normalizeHandle(tweet.authorHandle);
    const who = scored.authorName ? `${scored.authorName} (@${handle})` : `@${handle}`;
    const age = getTimingLabel(scored.ageMinutes);
    const position = getPositionHint(tweet.replies);

    const snippet = scored.text ? truncate(scored.text.replace(/\s+/g, ' ').trim(), 140) : '';

    const title = `🔥 ${scored.score} · ${who}`;
    const message = [
        snippet,
        '',
        `${age} old · ${tweet.replies} replies (${position}) · ${formatFollowers(tweet.authorFollowerCount)} followers`
    ].join('\n').trim();

    return {
        title,
        message,
        url: tweetPermalink(tweet.authorHandle, tweet.tweetId),
        urlTitle: 'Reply on X',
        score: scored.score
    };
}

function truncate(s: string, max: number): string {
    return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

function formatFollowers(count?: number): string {
    const n = count ?? 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}
