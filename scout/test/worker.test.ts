import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { type WorkerBindings } from '../src/worker';
import type { KvLike } from '../src/store/KvAlertStore';
import type { D1Like, D1Stmt } from '../src/measure/D1MeasurementStore';

function fakeKv(): KvLike {
    const map = new Map<string, string>();
    return {
        async get(k) { return map.get(k) ?? null; },
        async put(k, v) { map.set(k, v); }
    };
}

function fakeD1() {
    const runs: Array<{ sql: string; binds: unknown[] }> = [];
    const db: D1Like = {
        prepare(sql: string): D1Stmt {
            let binds: unknown[] = [];
            const stmt: D1Stmt = {
                bind(...v) { binds = v; return stmt; },
                async run() { runs.push({ sql, binds }); return {}; },
                async all<T>() { return { results: [] as T[] }; },
                async first<T>() { return null as T | null; }
            };
            return stmt;
        }
    };
    return { db, runs };
}

function env(over: Partial<WorkerBindings> = {}): WorkerBindings {
    return {
        TELEGRAM_BOT_TOKEN: 'B',
        TELEGRAM_CHAT_ID: 'C',
        TELEGRAM_WEBHOOK_SECRET: 'shh',
        ANTHROPIC_API_KEY: 'sk-test',
        WATCH_LIST_ID: 'L1',
        X_BEARER_TOKEN: 'tok',
        DEDUP_KV: fakeKv(),
        DB: fakeD1().db,
        ...over
    };
}

function tgPost(body: unknown, secret = 'shh') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['X-Telegram-Bot-Api-Secret-Token'] = secret;
    return new Request('https://scout.example/telegram', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('worker.fetch routing', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, async text() { return ''; }, async json() { return {}; } })));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('serves /health', async () => {
        const res = await worker.fetch(new Request('https://scout.example/health'), env());
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
    });

    it('rejects /telegram without the secret token', async () => {
        const res = await worker.fetch(tgPost({ callback_query: { id: 'q', data: 'used:t1' } }, ''), env());
        expect(res.status).toBe(401);
    });

    it('400s on invalid JSON', async () => {
        const bad = new Request('https://scout.example/telegram', {
            method: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'shh' },
            body: 'not json{'
        });
        expect((await worker.fetch(bad, env())).status).toBe(400);
    });

    it('dispatches a "used" callback → records a reply action', async () => {
        const db = fakeD1();
        const res = await worker.fetch(
            tgPost({ callback_query: { id: 'q', data: 'used:t1', message: { chat: { id: 1 } } } }),
            env({ DB: db.db })
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ ok: true, action: 'used', tweetId: 't1' });
        expect(db.runs.some(r => /reply_action/.test(r.sql))).toBe(true);   // recorded to D1
    });

    it('404s unknown routes', async () => {
        const res = await worker.fetch(new Request('https://scout.example/nope'), env());
        expect(res.status).toBe(404);
    });
});
