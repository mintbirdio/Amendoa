/**
 * The Scout pipeline — the core loop:
 *   (fetch) → keep fresh originals → score → threshold → dedup → notify → remember
 *
 * `processBatch` is the single authority on "original + fresh + scored + deduped":
 * it takes an already-collected batch of tweets and is shared by BOTH entry points —
 * `runScout` (pull: cron polls a List) and the webhook handler (push: tweets arrive
 * in real time). Every dependency is injected (notifier, store, clock) so the whole
 * thing is deterministic and unit-tested without any network or real time.
 */

import type { ScoutConfig, RunSummary, WatchSource, ScoredTweet } from './types';
import type { TweetSource, SourceTweet } from './sources/TweetSource';
import type { Notifier } from './notify/Notifier';
import type { AlertStore } from './store/AlertStore';
import { scoreTweet } from './scoring';
import { buildAlert } from './notify/Notifier';

/** Deps for processing a batch — no source needed (the batch is already in hand). */
export interface BatchDeps {
    notifier: Notifier;
    store: AlertStore;
    config: ScoutConfig;
    /** Optional logger. */
    log?: (msg: string) => void;
}

export interface PipelineDeps extends BatchDeps {
    source: TweetSource;
    /** Injectable clock for deterministic tests. */
    now?: () => number;
}

/**
 * Process an already-collected batch of candidate tweets through the full
 * score → threshold → dedup → notify → remember loop. `at` is the run clock.
 */
export async function processBatch(fetched: SourceTweet[], deps: BatchDeps, at: number): Promise<RunSummary> {
    const { notifier, store, config } = deps;
    const log = deps.log ?? (() => {});

    // Housekeeping: forget stale dedup entries.
    store.prune(at - config.dedupRetentionMs);

    log(`processing ${fetched.length} candidates`);

    const freshCutoff = at - config.freshnessMinutes * 60 * 1000;

    // The pipeline is the single authority on "original" + "fresh", using the
    // injected clock — so the result is deterministic regardless of what (or when)
    // a source returns. Sources may pre-filter as an over-fetch guard, but we never
    // rely on their clock here.
    const eligible: ScoredTweet[] = [];
    for (const st of fetched) {
        if (st.data.isReply) continue;
        if (st.data.postedAt < freshCutoff) continue;

        const scored = scoreTweet(st.data, {
            now: at,
            authorName: st.authorName,
            text: st.text
        });
        if (scored.score >= config.minScore) eligible.push(scored);
    }

    // Highest score first, then newest.
    eligible.sort((a, b) => b.score - a.score || b.tweet.postedAt - a.tweet.postedAt);

    let deduped = 0;
    const toAlert: ScoredTweet[] = [];
    for (const scored of eligible) {
        if (store.has(scored.tweet.tweetId)) {
            deduped++;
            continue;
        }
        toAlert.push(scored);
        if (toAlert.length >= config.maxAlertsPerRun) break;
    }

    const alerted: ScoredTweet[] = [];
    try {
        for (const scored of toAlert) {
            await notifier.send(buildAlert(scored));
            store.add(scored.tweet.tweetId, at);
            alerted.push(scored);
        }
    } finally {
        // Always persist what we've already sent — even if a later send() throws —
        // so a mid-run failure can never cause duplicate alerts on the next run.
        await store.flush();
    }
    log(`alerted ${alerted.length} (${deduped} deduped, ${eligible.length} eligible)`);

    return {
        fetched: fetched.length,
        eligible: eligible.length,
        deduped,
        alerted: alerted.length,
        alerts: alerted
    };
}

/** Pull entry point: poll a watched List/source, then process the batch. */
export async function runScout(watch: WatchSource, deps: PipelineDeps): Promise<RunSummary> {
    const at = (deps.now ?? (() => Date.now()))();
    const fetched = await deps.source.fetchRecentOriginals(watch, deps.config.freshnessMinutes);
    return processBatch(fetched, deps, at);
}
