/**
 * XOwnedReads — reads the OWNER's own data via the official X API at the cheap
 * "owned read" rate ($0.001): who am I, my recent replies, my follower count.
 * Powers the daily sweep (match replies → alerts, capture outcomes + follower
 * trend, feed the learning loop). Bearer comes from the injected provider.
 */

import type { CredentialProvider } from '../sources/Credentials';

type FetchLike = (
    url: string,
    init?: { method?: string; headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

const DEFAULT_BASE = 'https://api.x.com/2';

export interface OwnerInfo {
    id: string;
    username: string;
    followerCount: number;
    followingCount: number;
}

export interface OwnReply {
    replyTweetId: string;
    inReplyToTweetId: string;
    text: string;
    createdAt: number;        // ms epoch
    likes: number;
    replies: number;
    retweets: number;
    impressions: number;
}

interface XPM { like_count?: number; retweet_count?: number; reply_count?: number; impression_count?: number; followers_count?: number; following_count?: number }
interface XTweet { id: string; text?: string; created_at?: string; public_metrics?: XPM; referenced_tweets?: Array<{ type: string; id: string }> }

export class XOwnedReads {
    private readonly credentials: CredentialProvider;
    private readonly baseUrl: string;
    private readonly fetchFn: FetchLike;

    constructor(opts: { credentials: CredentialProvider; baseUrl?: string; fetchFn?: FetchLike }) {
        if (!opts.credentials) throw new Error('XOwnedReads: credentials provider is required');
        this.credentials = opts.credentials;
        this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
        this.fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchLike);
    }

    private async get(path: string): Promise<unknown> {
        const cred = await this.credentials.resolve();
        const res = await this.fetchFn(`${this.baseUrl}${path}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${cred.bearerToken}`, Accept: 'application/json' }
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`XOwnedReads: HTTP ${res.status} from ${path} — ${body.slice(0, 200)}`);
        }
        return res.json();
    }

    async me(): Promise<OwnerInfo> {
        const json = await this.get('/users/me?user.fields=public_metrics') as { data?: { id?: string; username?: string; public_metrics?: XPM } };
        const d = json.data ?? {};
        return {
            id: d.id ?? '',
            username: d.username ?? '',
            followerCount: d.public_metrics?.followers_count ?? 0,
            followingCount: d.public_metrics?.following_count ?? 0
        };
    }

    /** The owner's recent replies (tweets that reply to someone), newest-first-ish. */
    async recentReplies(userId: string, maxResults = 100): Promise<OwnReply[]> {
        const n = Math.min(Math.max(maxResults, 5), 100);
        const json = await this.get(
            `/users/${encodeURIComponent(userId)}/tweets?max_results=${n}` +
            `&tweet.fields=created_at,public_metrics,referenced_tweets`
        ) as { data?: XTweet[] };

        const out: OwnReply[] = [];
        for (const t of json.data ?? []) {
            const parent = (t.referenced_tweets ?? []).find(r => r.type === 'replied_to');
            if (!parent) continue;
            const pm = t.public_metrics ?? {};
            out.push({
                replyTweetId: t.id,
                inReplyToTweetId: parent.id,
                text: t.text ?? '',
                createdAt: t.created_at ? Date.parse(t.created_at) : 0,
                likes: pm.like_count ?? 0,
                replies: pm.reply_count ?? 0,
                retweets: pm.retweet_count ?? 0,
                impressions: pm.impression_count ?? 0
            });
        }
        return out;
    }
}
