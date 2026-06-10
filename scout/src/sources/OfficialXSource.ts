/**
 * OfficialXSource — the legit data source via the official X API v2 (2026).
 *
 * Phase-0 polls a List timeline (`GET /2/lists/:id/tweets`). The official API's
 * 24h read-dedup makes frequent polling nearly free (you pay $0.005 once per
 * genuinely-new post per UTC day, regardless of poll cadence), so this runs on
 * the existing Cloudflare cron with NO always-on host — cheaper, simpler, and
 * crash-proof vs the filtered stream (which is a scale-time option behind this
 * same `TweetSource` seam).
 *
 * Verified field mapping (X v2, 2026): metrics nest under `public_metrics`, the
 * author arrives in `includes.users[]` joined by `author_id`, `isReply` is
 * derived from `referenced_tweets[].type === 'replied_to'`, and premium maps
 * from `verified_type === 'blue'`. `officialToRaw` flattens v2 into the shared
 * `RawTweet` shape so the same pure `mapRawTweet` handles every provider.
 *
 * Auth: a bearer from the injected CredentialProvider. Owned reads ($0.001)
 * require a user-context (PKCE) token; the provider owns that detail.
 */

import type { WatchSource } from '../types';
import type { TweetSource, SourceTweet, FetchFn } from './TweetSource';
import { mapRawTweet, isRetweet, type RawTweet } from './mapTweet';
import type { CredentialProvider } from './Credentials';

const DEFAULT_BASE = 'https://api.x.com/2';

/** Field selection — must request these or v2 omits metrics/author/timestamps. */
const QUERY = new URLSearchParams({
    'expansions': 'author_id',
    'tweet.fields': 'created_at,public_metrics,referenced_tweets,author_id',
    'user.fields': 'username,name,public_metrics,verified,verified_type'
}).toString();

// --- X v2 wire shapes (only the fields we request) -------------------------
interface XPublicMetrics {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    impression_count?: number;
}
interface XUser {
    id: string;
    username?: string;
    name?: string;
    verified?: boolean;
    verified_type?: string;             // 'none' | 'blue' | 'business' | 'government'
    public_metrics?: { followers_count?: number };
}
interface XTweet {
    id: string;
    text?: string;
    created_at?: string;
    author_id?: string;
    public_metrics?: XPublicMetrics;
    referenced_tweets?: Array<{ type: string; id: string }>;
}
interface XListResponse {
    data?: XTweet[];
    includes?: { users?: XUser[] };
}

export interface OfficialXSourceOptions {
    credentials: CredentialProvider;
    /** Defaults to https://api.x.com/2 */
    baseUrl?: string;
    /** Injected fetch (defaults to global fetch). */
    fetchFn?: FetchFn;
}

export class OfficialXSource implements TweetSource {
    private readonly credentials: CredentialProvider;
    private readonly baseUrl: string;
    private readonly fetchFn: FetchFn;

    constructor(opts: OfficialXSourceOptions) {
        if (!opts?.credentials) throw new Error('OfficialXSource: credentials provider is required');
        this.credentials = opts.credentials;
        this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
        this.fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
    }

    buildUrl(source: WatchSource): string {
        return `${this.baseUrl}/lists/${encodeURIComponent(source.listId)}/tweets?${QUERY}`;
    }

    async fetchRecentOriginals(source: WatchSource, sinceMinutes: number): Promise<SourceTweet[]> {
        const cred = await this.credentials.resolve({ userId: source.userId });
        const url = this.buildUrl(source);
        const res = await this.fetchFn(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${cred.bearerToken}`, 'Accept': 'application/json' }
        });

        if (!res.ok) {
            const body = await safeText(res);
            throw new Error(`OfficialXSource: HTTP ${res.status} from ${url} — ${body.slice(0, 200)}`);
        }

        const json = (await res.json()) as XListResponse;
        const cutoff = Date.now() - sinceMinutes * 60 * 1000;

        const out: SourceTweet[] = [];
        for (const raw of officialToRaw(json)) {
            if (isRetweet(raw)) continue;                  // no retweets
            const mapped = mapRawTweet(raw);
            if (!mapped) continue;
            if (mapped.data.isReply) continue;             // originals only
            if (mapped.data.postedAt < cutoff) continue;   // freshness
            out.push(mapped);
        }
        out.sort((a, b) => b.data.postedAt - a.data.postedAt);
        return out;
    }
}

/**
 * Flatten an X v2 list response into the shared `RawTweet` shape: hoist
 * `public_metrics`, join the author from `includes.users[]` by `author_id`, and
 * derive reply/retweet flags from `referenced_tweets`. Pure → unit-tested.
 */
export function officialToRaw(resp: XListResponse): RawTweet[] {
    const tweets = Array.isArray(resp?.data) ? resp.data : [];
    const users = new Map<string, XUser>();
    for (const u of resp?.includes?.users ?? []) users.set(u.id, u);

    return tweets.map((t): RawTweet => {
        const author = t.author_id ? users.get(t.author_id) : undefined;
        const pm = t.public_metrics ?? {};
        const refs = Array.isArray(t.referenced_tweets) ? t.referenced_tweets : [];
        return {
            id: t.id,
            text: t.text,
            created_at: t.created_at,
            like_count: pm.like_count,
            retweet_count: pm.retweet_count,
            reply_count: pm.reply_count,
            view_count: pm.impression_count,
            is_reply: refs.some(r => r.type === 'replied_to'),
            is_retweet: refs.some(r => r.type === 'retweeted'),
            author: author
                ? {
                    username: author.username,
                    name: author.name,
                    followers_count: author.public_metrics?.followers_count,
                    is_blue_verified: author.verified_type === 'blue',
                    verified: author.verified
                }
                : undefined
        };
    });
}

async function safeText(res: { text(): Promise<string> }): Promise<string> {
    try {
        return await res.text();
    } catch {
        return '';
    }
}
