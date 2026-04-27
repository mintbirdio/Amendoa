#!/usr/bin/env node
/**
 * Amendoa — Dexie v9 -> v10 migration smoke test.
 *
 * Creates an in-memory Dexie DB at v9 with the OLD OurReply shape, inserts
 * a few sample rows, then reopens the DB at v10 (triggering the upgrade
 * hook defined in src/db/index.ts's spirit — re-created here against a
 * fresh Dexie instance so this script does not depend on bundler/TS
 * tooling). Asserts that each row has been backfilled with the v10 fields.
 *
 * Run:  node scripts/verify-migration.mjs
 * Exit: 0 on success, 1 on failure.
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';

const DB_NAME = 'AmendoaDB_MigrationSmokeTest';

// -----------------------------------------------------------------------------
// Phase 1: open DB at v9 with OLD OurReply shape and seed 3 sample rows.
// -----------------------------------------------------------------------------

async function seedV9() {
    const db = new Dexie(DB_NAME);

    // Mirror the historical v7 -> v9 schema sequence from src/db/index.ts.
    db.version(7).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key'
    });
    db.version(8).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key'
    });
    db.version(9).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key',
        gamificationProgress: 'date',
        userGamificationStats: 'id'
    });

    await db.open();

    // Row A — "normal" pre-v10 reply with all required fields filled.
    await db.table('ourReplies').add({
        replyId: 'reply-normal-1',
        inReplyToTweetId: 'tweet-1',
        inReplyToHandle: 'alice',
        repliedAt: 1_700_000_000_000,
        content: 'Hello world.',
        likesReceived: 2,
        repliesReceived: 0,
        gotAuthorReply: false,
        authorReplyTimestamp: null
    });

    // Row B — missing optional-ish fields (likesReceived/gotAuthorReply absent).
    await db.table('ourReplies').add({
        replyId: 'reply-missing-2',
        inReplyToTweetId: 'tweet-2',
        inReplyToHandle: 'bob',
        repliedAt: 1_700_000_500_000,
        content: 'Short.'
    });

    // Row C — unusual content (emoji, long text, zero-ish fields).
    await db.table('ourReplies').add({
        replyId: 'reply-unusual-3',
        inReplyToTweetId: 'tweet-3',
        inReplyToHandle: 'carol',
        repliedAt: 1_700_001_000_000,
        content: '🚀🚀🚀 ' + 'x'.repeat(500) + ' — edge case',
        likesReceived: 0,
        repliesReceived: 0,
        gotAuthorReply: false,
        authorReplyTimestamp: null
    });

    db.close();
}

// -----------------------------------------------------------------------------
// Phase 2: reopen at v10 (with upgrade hook mirroring src/db/index.ts).
// -----------------------------------------------------------------------------

async function openV10() {
    const db = new Dexie(DB_NAME);

    db.version(7).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key'
    });
    db.version(8).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key'
    });
    db.version(9).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key',
        gamificationProgress: 'date',
        userGamificationStats: 'id'
    });
    db.version(10).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt, source',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key',
        gamificationProgress: 'date',
        userGamificationStats: 'id'
    }).upgrade(async tx => {
        try {
            return await tx.table('ourReplies').toCollection().modify(reply => {
                try {
                    reply.source = reply.source ?? 'native';
                    reply.originalTweetContent = reply.originalTweetContent ?? '';
                    reply.originalPostedAt = reply.originalPostedAt ?? 0;
                    reply.authorFollowerCountAtReply = reply.authorFollowerCountAtReply ?? 0;
                    reply.draftText = reply.draftText ?? '';
                    reply.authorLiked = reply.authorLiked ?? false;
                    reply.lastPolledAt = reply.lastPolledAt ?? null;
                } catch (rowError) {
                    console.error('[Amendoa] v10 upgrade: row failed', reply?.replyId, rowError);
                }
            });
        } catch (error) {
            console.error('[Amendoa] Dexie v10 upgrade failed', error);
            throw error;
        }
    });

    await db.open();
    return db;
}

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

function assertRow(row, label) {
    const expected = {
        source: 'native',
        originalTweetContent: '',
        originalPostedAt: 0,
        authorFollowerCountAtReply: 0,
        draftText: '',
        authorLiked: false,
        lastPolledAt: null
    };

    const failures = [];
    for (const [key, want] of Object.entries(expected)) {
        const got = row[key];
        if (got !== want) {
            failures.push(`  ${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
        }
    }

    if (failures.length > 0) {
        throw new Error(
            `Row assertion failed for ${label} (replyId=${row.replyId}):\n${failures.join('\n')}`
        );
    }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Phase 3: reopen at v11 (followerSnapshots added).
// -----------------------------------------------------------------------------

async function openV11() {
    const db = new Dexie(DB_NAME);

    db.version(7).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key'
    });
    db.version(8).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key'
    });
    db.version(9).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key',
        gamificationProgress: 'date',
        userGamificationStats: 'id'
    });
    db.version(10).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt, source',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key',
        gamificationProgress: 'date',
        userGamificationStats: 'id'
    }).upgrade(async tx => {
        return await tx.table('ourReplies').toCollection().modify(reply => {
            reply.source = reply.source ?? 'native';
            reply.originalTweetContent = reply.originalTweetContent ?? '';
            reply.originalPostedAt = reply.originalPostedAt ?? 0;
            reply.authorFollowerCountAtReply = reply.authorFollowerCountAtReply ?? 0;
            reply.draftText = reply.draftText ?? '';
            reply.authorLiked = reply.authorLiked ?? false;
            reply.lastPolledAt = reply.lastPolledAt ?? null;
        });
    });
    db.version(11).stores({
        targetAccounts: 'handle, tier, lastInteraction, addedAt',
        tweetCache: 'tweetId, authorHandle, postedAt, firstSeenAt, opportunityScore, isFromTarget',
        ourReplies: 'replyId, inReplyToHandle, repliedAt, source',
        conversations: 'id, otherPartyHandle, lastMessageAt, isObligation, isDismissed',
        dailyStats: 'date',
        settings: 'key',
        gamificationProgress: 'date',
        userGamificationStats: 'id',
        followerSnapshots: '++id, &date'
    }).upgrade(async _tx => {
        // no-op
    });

    await db.open();
    return db;
}

async function main() {
    // Ensure a clean slate across re-runs (fake-indexeddb is in-memory per
    // process, but be defensive in case the env persists anything).
    try {
        await Dexie.delete(DB_NAME);
    } catch {
        // ignore
    }

    console.log('[smoke] seeding v9 ...');
    await seedV9();

    console.log('[smoke] reopening at v10 (triggering upgrade) ...');
    let db = await openV10();

    const rows = await db.table('ourReplies').toArray();
    if (rows.length !== 3) {
        throw new Error(`Expected 3 rows after migration, got ${rows.length}`);
    }

    const byId = Object.fromEntries(rows.map(r => [r.replyId, r]));
    assertRow(byId['reply-normal-1'], 'normal');
    assertRow(byId['reply-missing-2'], 'missing-optional');
    assertRow(byId['reply-unusual-3'], 'unusual-content');

    // Preserved fields should still be intact.
    if (byId['reply-normal-1'].content !== 'Hello world.') {
        throw new Error('Row "normal": content was unexpectedly mutated');
    }
    if (byId['reply-unusual-3'].inReplyToHandle !== 'carol') {
        throw new Error('Row "unusual": inReplyToHandle was unexpectedly mutated');
    }

    db.close();

    // -------------------------------------------------------------------------
    // Phase 3: reopen at v11 and verify followerSnapshots round-trips.
    // -------------------------------------------------------------------------
    console.log('[smoke] reopening at v11 (followerSnapshots) ...');
    db = await openV11();

    await db.table('followerSnapshots').put({ date: '2026-04-27', count: 142 });
    db.close();

    db = await openV11();
    const snapshots = await db.table('followerSnapshots').toArray();
    if (snapshots.length !== 1) {
        throw new Error(`Expected 1 followerSnapshot row after first put, got ${snapshots.length}`);
    }
    if (snapshots[0].date !== '2026-04-27' || snapshots[0].count !== 142) {
        throw new Error(`Unexpected snapshot row: ${JSON.stringify(snapshots[0])}`);
    }

    // v10 rows still present after v11 upgrade.
    const v10rows = await db.table('ourReplies').toArray();
    if (v10rows.length !== 3) {
        throw new Error(`Expected v10 rows preserved at v11; got ${v10rows.length}`);
    }

    // Upsert with same date should not produce a second row.
    const existing = await db.table('followerSnapshots').where('date').equals('2026-04-27').first();
    if (!existing || existing.id === undefined) {
        throw new Error('Upsert prep: could not locate row by date');
    }
    await db.table('followerSnapshots').put({ id: existing.id, date: '2026-04-27', count: 150 });
    const after = await db.table('followerSnapshots').toArray();
    if (after.length !== 1) {
        throw new Error(`Expected 1 row after upsert, got ${after.length}`);
    }
    if (after[0].count !== 150) {
        throw new Error(`Expected upsert to set count=150, got ${after[0].count}`);
    }

    db.close();
    await Dexie.delete(DB_NAME);

    console.log('[smoke] OK — v10 + v11 (followerSnapshots) round-trip.');
}

main().then(
    () => process.exit(0),
    err => {
        console.error('[smoke] FAIL');
        console.error(err?.stack || err?.message || err);
        process.exit(1);
    }
);
