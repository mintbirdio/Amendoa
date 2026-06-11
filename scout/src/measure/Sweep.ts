/**
 * runSweep — the daily learning + outcome pass (a second, infrequent cron).
 *
 *  1. Read your own recent replies (cheap owned reads).
 *  2. Match each to a recent alert → record the reply action (without clobbering
 *     a cockpit "Used it" tap) and the engagement outcome.
 *  3. Snapshot today's follower count (the headline trend).
 *  4. Learn: feed your strongest replies back into the voice profile as few-shot
 *     examples, so future drafts converge on what actually works for you.
 *
 * All deps injected (X reads, stores, clock) → fully unit-tested, no network.
 */

import type { MeasurementStore } from './MeasurementStore';
import type { VoiceStore } from '../voice/VoiceStore';
import type { OwnerInfo, OwnReply } from '../xapi/OwnedReads';

export interface OwnedReadsLike {
    me(): Promise<OwnerInfo>;
    recentReplies(userId: string, maxResults?: number): Promise<OwnReply[]>;
}

export interface SweepDeps {
    reads: OwnedReadsLike;
    store: MeasurementStore;
    voice: VoiceStore;
    now?: () => number;
    /** How far back to match replies against alerts (default 3 days). */
    lookbackMs?: number;
    /** Cap on stored voice examples (default 20). */
    maxExamples?: number;
}

export interface SweepResult {
    matched: number;       // replies newly tied to an alert
    outcomes: number;      // outcomes recorded
    examplesAdded: number; // new voice examples learned
    followerCount: number;
}

const DAY_MS = 86_400_000;

export async function runSweep(deps: SweepDeps): Promise<SweepResult> {
    const now = deps.now?.() ?? Date.now();
    const maxExamples = deps.maxExamples ?? 20;

    const me = await deps.reads.me();
    const replies = me.id ? await deps.reads.recentReplies(me.id, 100) : [];

    const since = now - (deps.lookbackMs ?? 3 * DAY_MS);
    const alerts = await deps.store.recentAlerts(since);
    const alertById = new Map(alerts.map(a => [a.tweetId, a]));

    let matched = 0;
    let outcomes = 0;
    const learned: Array<{ tweet: string; reply: string; weight: number }> = [];

    for (const r of replies) {
        const alert = alertById.get(r.inReplyToTweetId);
        if (!alert) continue;

        const existing = await deps.store.getReplyAction(alert.tweetId);
        if (!existing) {
            await deps.store.recordReplyAction({
                tweetId: alert.tweetId,
                replied: true,
                repliedAt: r.createdAt,
                replyTweetId: r.replyTweetId,
                latencyMs: Math.max(0, r.createdAt - alert.alertedAt)
            });
            matched++;
        } else if (existing.replied && !existing.replyTweetId) {
            // cockpit logged "used it" but had no reply id yet — backfill it.
            await deps.store.recordReplyAction({ ...existing, replyTweetId: r.replyTweetId, repliedAt: existing.repliedAt ?? r.createdAt });
        }

        await deps.store.recordReplyOutcome({
            replyTweetId: r.replyTweetId,
            measuredAt: now,
            likes: r.likes,
            replies: r.replies,
            retweets: r.retweets,
            impressions: r.impressions
        });
        outcomes++;

        if (alert.text && r.text.trim()) {
            learned.push({ tweet: alert.text, reply: r.text.trim(), weight: r.likes + r.retweets * 2 });
        }
    }

    // Learning: merge the strongest replies into the voice profile's few-shot set.
    let examplesAdded = 0;
    if (learned.length) {
        const profile = await deps.voice.load();
        const have = new Set(profile.examples.map(e => e.reply));
        const top = learned.sort((a, b) => b.weight - a.weight);
        const examples = [...profile.examples];
        for (const s of top) {
            if (!have.has(s.reply)) {
                examples.push({ tweet: s.tweet, reply: s.reply });
                have.add(s.reply);
                examplesAdded++;
            }
        }
        if (examplesAdded) {
            // keep the most recent `maxExamples`
            const trimmed = examples.slice(Math.max(0, examples.length - maxExamples));
            await deps.voice.save({ ...profile, examples: trimmed });
        }
    }

    const day = new Date(now).toISOString().slice(0, 10);
    await deps.store.recordFollowerSnapshot({ day, followerCount: me.followerCount, followingCount: me.followingCount });

    return { matched, outcomes, examplesAdded, followerCount: me.followerCount };
}
