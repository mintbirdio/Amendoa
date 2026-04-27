import { db, normalizeHandle, incrementDailyStat, type ReplySource } from '../db';

export async function logSentReply(
    replyId: string,
    inReplyToTweetId: string,
    inReplyToHandle: string,
    content: string
): Promise<void> {
    const normalizedHandle = normalizeHandle(inReplyToHandle);
    const now = Date.now();
    const cachedTweet = await db.tweetCache.get(inReplyToTweetId);

    const source: ReplySource = 'native';

    await db.ourReplies.put({
        replyId,
        inReplyToTweetId,
        inReplyToHandle: normalizedHandle,
        repliedAt: now,
        content,
        source,
        originalTweetContent: cachedTweet?.content || '',
        originalPostedAt: cachedTweet?.postedAt || 0,
        authorFollowerCountAtReply: cachedTweet?.authorFollowerCount || 0,
        draftText: '',
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

    console.log('[Amendoa] Logged native reply', replyId);
}
