/**
 * useSentReplies Hook
 *
 * Live query over db.ourReplies, newest first, for the Sent tab.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db, type OurReply } from '../db';

export function useSentReplies(limit: number = 50): OurReply[] {
    return useLiveQuery(
        () =>
            db.ourReplies
                .orderBy('repliedAt')
                .reverse()
                .limit(limit)
                .toArray(),
        [limit],
        []
    );
}

export interface SentRepliesCounts {
    total: number;
    amendoa: number;
    native: number;
}

export function useSentRepliesCounts(): SentRepliesCounts {
    return useLiveQuery(
        async () => {
            const [total, amendoa] = await Promise.all([
                db.ourReplies.count(),
                db.ourReplies.where('source').equals('amendoa').count()
            ]);
            return {
                total,
                amendoa,
                native: total - amendoa
            };
        },
        [],
        { total: 0, amendoa: 0, native: 0 }
    );
}
