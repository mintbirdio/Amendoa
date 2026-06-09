import { describe, it, expect, vi } from 'vitest';
import { KvAlertStore, type KvLike } from '../src/store/KvAlertStore';

/** A Map-backed fake of Cloudflare KV. */
function fakeKv(seed: Record<string, string> = {}) {
    const map = new Map<string, string>(Object.entries(seed));
    const kv: KvLike & { map: Map<string, string>; puts: Array<{ key: string; ttl?: number }> } = {
        map,
        puts: [],
        async get(key) { return map.get(key) ?? null; },
        async put(key, value, opts) { map.set(key, value); kv.puts.push({ key, ttl: opts?.expirationTtl }); }
    };
    return kv;
}

const RETENTION = 7 * 86_400_000;

describe('KvAlertStore', () => {
    it('pre-loads dedup state for candidate ids only', async () => {
        const kv = fakeKv({ 'seen:already': '123' });
        const getSpy = vi.spyOn(kv, 'get');

        const store = await KvAlertStore.load(kv, ['already', 'fresh'], RETENTION);

        expect(store.has('already')).toBe(true);
        expect(store.has('fresh')).toBe(false);
        // only the candidate ids are fetched (deduped) — not a full scan
        expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it('flushes only newly-added ids, with a TTL', async () => {
        const kv = fakeKv();
        const store = await KvAlertStore.load(kv, ['x'], RETENTION);

        store.add('x', 1000);
        await store.flush();

        expect(kv.puts).toEqual([{ key: 'seen:x', ttl: RETENTION / 1000 }]);
        expect(kv.map.get('seen:x')).toBe('1000');
    });

    it('clamps TTL to KVs 60s minimum', async () => {
        const kv = fakeKv();
        const store = await KvAlertStore.load(kv, ['x'], 1000); // 1s retention
        store.add('x', 1);
        await store.flush();
        expect(kv.puts[0].ttl).toBe(60);
    });

    it('prune is a no-op (TTL handles expiry)', async () => {
        const kv = fakeKv({ 'seen:a': '1' });
        const store = await KvAlertStore.load(kv, ['a'], RETENTION);
        expect(store.prune(Date.now())).toBe(0);
        expect(store.has('a')).toBe(true);
    });
});
