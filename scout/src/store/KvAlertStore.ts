/**
 * KvAlertStore — dedup state for the webhook Worker, backed by Cloudflare KV.
 *
 * The pipeline's AlertStore interface is synchronous, but KV is async — so we
 * follow the same load/flush pattern as FileAlertStore: a webhook payload names
 * the exact candidate tweet ids, so we pre-load just those from KV into memory,
 * run the sync pipeline, then flush newly-alerted ids back to KV.
 *
 * Expiry is handled by KV's per-key TTL (no scan needed), so `prune` is a no-op:
 * each alerted id is written with `expirationTtl = dedupRetention`, and simply
 * vanishes when the window passes.
 */

import { InMemoryAlertStore } from './AlertStore';

/** The slice of Cloudflare's KVNamespace we use (kept minimal so tests can fake it). */
export interface KvLike {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const PREFIX = 'seen:';
const MIN_TTL_SECONDS = 60; // Cloudflare KV's minimum expirationTtl.

const keyFor = (tweetId: string) => `${PREFIX}${tweetId}`;

export class KvAlertStore extends InMemoryAlertStore {
    /** Ids alerted this run, pending a write to KV on flush(). */
    private readonly pending = new Map<string, number>();

    private constructor(
        private readonly kv: KvLike,
        private readonly ttlSeconds: number,
        seed: Record<string, number>
    ) {
        super(seed);
    }

    /**
     * Pre-load dedup state for exactly the candidate ids in this payload, so the
     * synchronous `has()` checks in the pipeline reflect what's already in KV.
     */
    static async load(kv: KvLike, candidateIds: string[], retentionMs: number): Promise<KvAlertStore> {
        const seed: Record<string, number> = {};
        await Promise.all([...new Set(candidateIds)].map(async (id) => {
            const v = await kv.get(keyFor(id));
            if (v != null) seed[id] = Number(v) || 0;
        }));
        const ttl = Math.max(MIN_TTL_SECONDS, Math.floor(retentionMs / 1000));
        return new KvAlertStore(kv, ttl, seed);
    }

    override add(tweetId: string, at: number = Date.now()): void {
        super.add(tweetId, at);
        this.pending.set(tweetId, at);
    }

    /** Expiry is TTL-driven in KV; nothing to scan. */
    override prune(_before: number): number {
        return 0;
    }

    override async flush(): Promise<void> {
        await Promise.all(
            [...this.pending].map(([id, ts]) =>
                this.kv.put(keyFor(id), String(ts), { expirationTtl: this.ttlSeconds })
            )
        );
        this.pending.clear();
    }
}
