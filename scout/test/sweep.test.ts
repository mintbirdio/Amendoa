import { describe, it, expect } from 'vitest';
import { runSweep, type OwnedReadsLike } from '../src/measure/Sweep';
import { InMemoryMeasurementStore } from '../src/measure/MeasurementStore';
import { InMemoryVoiceStore } from '../src/voice/VoiceStore';
import type { AlertRow } from '../src/measure/types';
import type { OwnReply, OwnerInfo } from '../src/xapi/OwnedReads';
import { EMPTY_VOICE } from '../src/voice/types';

const NOW = Date.UTC(2026, 5, 10, 12, 0, 0);

function alert(over: Partial<AlertRow>): AlertRow {
    return {
        tweetId: 'a1', authorHandle: 'jane', alertedAt: NOW - 3600_000, postedAt: NOW - 3700_000,
        score: 88, badge: 'hot', authorValue: 30, timingMultiplier: 1.6, competitionFactor: 1.3,
        replyCountAtAlert: 1, source: 'poll', text: 'shipped my SaaS', authorName: 'Jane', ...over
    };
}

function fakeReads(replies: OwnReply[], me: Partial<OwnerInfo> = {}): OwnedReadsLike {
    return {
        async me() { return { id: 'u', username: 'owner', followerCount: 5000, followingCount: 300, ...me }; },
        async recentReplies() { return replies; }
    };
}

function reply(over: Partial<OwnReply>): OwnReply {
    return { replyTweetId: 'r1', inReplyToTweetId: 'a1', text: 'congrats! what was hardest?', createdAt: NOW - 3000_000, likes: 10, replies: 0, retweets: 2, impressions: 800, ...over };
}

describe('runSweep', () => {
    it('matches a reply to its alert and records action + outcome', async () => {
        const store = new InMemoryMeasurementStore();
        await store.recordAlerts([alert({})]);
        const res = await runSweep({ reads: fakeReads([reply({})]), store, voice: new InMemoryVoiceStore(), now: () => NOW });

        expect(res.matched).toBe(1);
        expect(res.outcomes).toBe(1);
        const snap = store.snapshot();
        expect(snap.actions[0]).toMatchObject({ tweetId: 'a1', replied: true, replyTweetId: 'r1' });
        expect(snap.actions[0].latencyMs).toBe(600_000); // repliedAt - alertedAt
        expect(snap.outcomes[0]).toMatchObject({ replyTweetId: 'r1', likes: 10, retweets: 2 });
    });

    it('does not clobber a cockpit "used it" action, but backfills the reply id', async () => {
        const store = new InMemoryMeasurementStore();
        await store.recordAlerts([alert({})]);
        await store.recordReplyAction({ tweetId: 'a1', replied: true, usedDraft: true }); // cockpit tap

        await runSweep({ reads: fakeReads([reply({})]), store, voice: new InMemoryVoiceStore(), now: () => NOW });
        const action = store.snapshot().actions[0];
        expect(action.usedDraft).toBe(true);        // preserved
        expect(action.replyTweetId).toBe('r1');     // backfilled
    });

    it('records a follower snapshot for the day', async () => {
        const store = new InMemoryMeasurementStore();
        await runSweep({ reads: fakeReads([]), store, voice: new InMemoryVoiceStore(), now: () => NOW });
        expect(store.snapshot().snapshots[0]).toMatchObject({ day: '2026-06-10', followerCount: 5000 });
    });

    it('learns strong replies into the voice profile', async () => {
        const store = new InMemoryMeasurementStore();
        await store.recordAlerts([alert({ tweetId: 'a1', text: 'shipped my SaaS' }), alert({ tweetId: 'a2', text: 'raised a seed round' })]);
        const replies = [
            reply({ replyTweetId: 'r1', inReplyToTweetId: 'a1', text: 'huge — what unlocked it?', likes: 50, retweets: 5 }),
            reply({ replyTweetId: 'r2', inReplyToTweetId: 'a2', text: 'congrats, who led?', likes: 2, retweets: 0 })
        ];
        const voice = new InMemoryVoiceStore({ ...EMPTY_VOICE, examples: [] });
        const res = await runSweep({ reads: fakeReads(replies), store, voice, now: () => NOW });

        expect(res.examplesAdded).toBe(2);
        const learned = (await voice.load()).examples;
        expect(learned.map(e => e.reply)).toContain('huge — what unlocked it?');
        // strongest first
        expect(learned[0].reply).toBe('huge — what unlocked it?');
    });

    it('ignores replies with no matching alert', async () => {
        const store = new InMemoryMeasurementStore();
        await store.recordAlerts([alert({ tweetId: 'a1' })]);
        const res = await runSweep({ reads: fakeReads([reply({ inReplyToTweetId: 'unknown' })]), store, voice: new InMemoryVoiceStore(), now: () => NOW });
        expect(res.matched).toBe(0);
        expect(res.outcomes).toBe(0);
    });
});
