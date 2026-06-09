import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { type WorkerBindings } from '../src/worker';
import type { KvLike } from '../src/store/KvAlertStore';

function fakeKv() {
    const map = new Map<string, string>();
    const kv: KvLike & { map: Map<string, string> } = {
        map,
        async get(k) { return map.get(k) ?? null; },
        async put(k, v) { map.set(k, v); }
    };
    return kv;
}

function env(over: Partial<WorkerBindings> = {}): WorkerBindings {
    return {
        SCRAPER_API_KEY: 'secret',
        TELEGRAM_BOT_TOKEN: 'b',
        TELEGRAM_CHAT_ID: 'c',
        DEDUP_KV: fakeKv(),
        ...over
    };
}

function hotTweet(id = '900') {
    return {
        id,
        text: 'big launch thread',
        created_at: new Date().toISOString(),
        like_count: 3, retweet_count: 0, reply_count: 0,
        author: { username: 'titan', name: 'Titan', followers: 250_000, isBlueVerified: true }
    };
}

function post(body: unknown, headers: Record<string, string> = { 'X-API-Key': 'secret' }) {
    return new Request('https://scout.example/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
}

describe('worker fetch handler', () => {
    let sendSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Stub the Telegram HTTP call the notifier makes via global fetch.
        sendSpy = vi.fn(async () => ({ ok: true, status: 200, async text() { return ''; }, async json() { return {}; } }));
        vi.stubGlobal('fetch', sendSpy);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('rejects non-POST', async () => {
        const res = await worker.fetch(new Request('https://scout.example/', { method: 'GET' }), env());
        expect(res.status).toBe(405);
    });

    it('rejects a missing/wrong shared secret', async () => {
        const res = await worker.fetch(post({ event_type: 'tweet', tweets: [hotTweet()] }, {}), env());
        expect(res.status).toBe(401);
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it('scores, alerts, and persists a hot tweet', async () => {
        const e = env();
        const res = await worker.fetch(post({ event_type: 'tweet', tweets: [hotTweet()] }), e);
        expect(res.status).toBe(200);
        const body = await res.json() as { alerted: number; deduped: number };
        expect(body.alerted).toBe(1);
        expect(sendSpy).toHaveBeenCalledTimes(1);                 // one Telegram push
        expect((e.DEDUP_KV as ReturnType<typeof fakeKv>).map.get('seen:900')).toBeDefined();
    });

    it('dedupes the same tweet across two deliveries (shared KV)', async () => {
        const kv = fakeKv();
        const e = env({ DEDUP_KV: kv });
        const first = await worker.fetch(post({ event_type: 'tweet', tweets: [hotTweet()] }), e);
        const second = await worker.fetch(post({ event_type: 'tweet', tweets: [hotTweet()] }), e);
        expect((await first.json() as { alerted: number }).alerted).toBe(1);
        expect((await second.json() as { alerted: number; deduped: number }).deduped).toBe(1);
        expect(sendSpy).toHaveBeenCalledTimes(1);                 // only alerted once
    });

    it('ignores control frames without alerting', async () => {
        const res = await worker.fetch(post({ event_type: 'connected' }), env());
        expect(res.status).toBe(200);
        expect((await res.json() as { alerted: number }).alerted).toBe(0);
        expect(sendSpy).not.toHaveBeenCalled();
    });
});
