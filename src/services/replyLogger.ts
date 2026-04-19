/**
 * Reply Logger
 *
 * Owns the write to db.ourReplies when a send is detected, including
 * the enriched reply-log fields (source, original tweet snapshot, draft).
 *
 * Attribution: a short-lived pendingReplyContext lets us tag a send as
 * 'amendoa' when it matches the tweet we just opened the composer for.
 * Otherwise we tag it 'native'.
 *
 * The pending context is persisted to chrome.storage.session so it
 * survives the hard navigation that happens when the user is not
 * already on the tweet's status page. The module-scoped variable is
 * an in-memory cache; reads fall back to session storage when the
 * cache is empty (e.g. right after a navigation tore down the script).
 */

import { db, normalizeHandle, incrementDailyStat, type ReplySource } from '../db';

interface PendingReplyContext {
    tweetId: string;
    handle: string;
    draft: string;
    startedAt: number;
}

// Minimal local type for the slice of chrome.storage.session we use.
// @types/chrome in this repo doesn't yet expose chrome.storage.session (MV3-only).
type SessionStorageArea = {
    get(keys: string | string[] | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
};

const PENDING_TTL_MS = 5 * 60 * 1000;
const SESSION_KEY = 'amendoa_pendingReplyContext';

let pendingReplyContext: PendingReplyContext | null = null;

// chrome.storage.session is MV3-only; guard for safety in dev.
const sessionStorage: SessionStorageArea | undefined =
    typeof chrome !== 'undefined' && chrome.storage
        ? (chrome.storage as unknown as { session?: SessionStorageArea }).session
        : undefined;

function writeToSession(ctx: PendingReplyContext | null): void {
    if (!sessionStorage) return;
    try {
        if (ctx === null) {
            sessionStorage.remove(SESSION_KEY);
        } else {
            sessionStorage.set({ [SESSION_KEY]: ctx });
        }
    } catch {
        // ignore storage failures
    }
}

async function readFromSession(): Promise<PendingReplyContext | null> {
    if (!sessionStorage) return null;
    try {
        const result = await sessionStorage.get(SESSION_KEY);
        const ctx = result?.[SESSION_KEY] as PendingReplyContext | undefined;
        if (!ctx) return null;
        if (Date.now() - ctx.startedAt > PENDING_TTL_MS) {
            sessionStorage.remove(SESSION_KEY);
            return null;
        }
        return ctx;
    } catch {
        return null;
    }
}

export function setPending(tweetId: string, handle: string, draft: string): void {
    pendingReplyContext = {
        tweetId,
        handle: normalizeHandle(handle),
        draft,
        startedAt: Date.now()
    };
    writeToSession(pendingReplyContext);
}

export function getPending(): PendingReplyContext | null {
    if (!pendingReplyContext) return null;
    if (Date.now() - pendingReplyContext.startedAt > PENDING_TTL_MS) {
        pendingReplyContext = null;
        writeToSession(null);
        return null;
    }
    return pendingReplyContext;
}

/**
 * Hydrate the in-memory cache from chrome.storage.session. Call once at
 * content-script startup so a post-navigation script has the context
 * that the pre-navigation script set.
 */
export async function hydratePendingFromSession(): Promise<void> {
    if (pendingReplyContext) return;
    const ctx = await readFromSession();
    if (ctx) {
        pendingReplyContext = ctx;
    }
}

export async function consumePendingFor(tweetId: string): Promise<PendingReplyContext | null> {
    // In-memory first
    let pending = getPending();

    // Fall back to session storage if cache is empty (post-navigation case)
    if (!pending) {
        pending = await readFromSession();
        if (pending) {
            pendingReplyContext = pending;
        }
    }

    if (pending && pending.tweetId === tweetId) {
        pendingReplyContext = null;
        writeToSession(null);
        return pending;
    }
    return null;
}

export function clearPending(): void {
    pendingReplyContext = null;
    writeToSession(null);
}

/**
 * Log a sent reply with enriched context. Idempotent via put().
 */
export async function logSentReply(
    replyId: string,
    inReplyToTweetId: string,
    inReplyToHandle: string,
    content: string
): Promise<void> {
    const normalizedHandle = normalizeHandle(inReplyToHandle);
    const now = Date.now();

    const matched = await consumePendingFor(inReplyToTweetId);
    const source: ReplySource = matched ? 'amendoa' : 'native';
    const draftText = matched?.draft ?? '';

    const cachedTweet = await db.tweetCache.get(inReplyToTweetId);
    const originalTweetContent = cachedTweet?.content ?? '';
    const originalPostedAt = cachedTweet?.postedAt ?? 0;
    const authorFollowerCountAtReply = cachedTweet?.authorFollowerCount ?? 0;

    await db.ourReplies.put({
        replyId,
        inReplyToTweetId,
        inReplyToHandle: normalizedHandle,
        repliedAt: now,
        content,
        source,
        originalTweetContent,
        originalPostedAt,
        authorFollowerCountAtReply,
        draftText,
        likesReceived: 0,
        repliesReceived: 0,
        gotAuthorReply: false,
        authorReplyTimestamp: null,
        authorLiked: false,
        lastPolledAt: null
    });

    if (cachedTweet) {
        await db.tweetCache.update(inReplyToTweetId, {
            didReply: true,
            replyTimestamp: now
        });
    }

    await incrementDailyStat('repliesSent');

    if (cachedTweet && cachedTweet.replies <= 5) {
        await incrementDailyStat('firstResponderCount');
    }

    console.log(`[Amendoa] Logged reply (${source}) to @${normalizedHandle}`);
}
