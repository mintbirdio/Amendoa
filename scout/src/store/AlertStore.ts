/**
 * AlertStore — remembers which tweets we've already alerted on, so a tweet is
 * never pushed twice across runs. Also enforces a retention window so the store
 * stays small.
 */

export interface AlertStore {
    /** Has this tweet already been alerted? */
    has(tweetId: string): boolean;
    /** Record that this tweet was alerted at `at` (ms). */
    add(tweetId: string, at?: number): void;
    /** Drop entries older than `before` (ms). Returns number removed. */
    prune(before: number): number;
    /** Persist to backing storage (no-op for in-memory). */
    flush(): Promise<void>;
    /** Number of remembered ids. */
    size(): number;
}

export class InMemoryAlertStore implements AlertStore {
    protected readonly map = new Map<string, number>();

    constructor(initial?: Record<string, number>) {
        if (initial) for (const [id, ts] of Object.entries(initial)) this.map.set(id, ts);
    }

    has(tweetId: string): boolean {
        return this.map.has(tweetId);
    }

    add(tweetId: string, at: number = Date.now()): void {
        this.map.set(tweetId, at);
    }

    prune(before: number): number {
        let removed = 0;
        for (const [id, ts] of this.map) {
            if (ts < before) {
                this.map.delete(id);
                removed++;
            }
        }
        return removed;
    }

    async flush(): Promise<void> {
        // in-memory: nothing to persist
    }

    size(): number {
        return this.map.size;
    }

    toJSON(): Record<string, number> {
        return Object.fromEntries(this.map);
    }
}
