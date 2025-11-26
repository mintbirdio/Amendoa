/**
 * Data Processor for Amendoa v2
 *
 * Processes intercepted Twitter API data:
 * - Extracts tweets and author info
 * - Calculates opportunity scores for tweets from targets
 * - Stores in TweetCache
 * - Emits events for UI updates
 */

import { db, type TweetCache, normalizeHandle } from '../db';
import { extractTimestampFromSnowflake } from './velocity';
import {
    calculateOpportunityScore,
    type TweetData
} from './scoreEngine';
import { getTargetHandleSet, updateTargetProfile } from './targetManager';
import { recordGamificationAction } from './gamification';

// =============================================================================
// TYPES
// =============================================================================

interface ExtractedTweet {
    tweetId: string;
    authorHandle: string;
    authorDisplayName: string;
    authorFollowers: number;
    authorFollowing: number;
    authorIsPremium: boolean;
    content: string;
    postedAt: number;
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    hasMedia: boolean;
    isThread: boolean;
    isReply: boolean;
}

// =============================================================================
// MAIN PROCESSOR
// =============================================================================

// Global map of user IDs to screen names (populated from API responses)
const userIdToScreenName = new Map<string, string>();

/**
 * Process intercepted Twitter API data
 */
export async function processInterceptedData(url: string, data: any) {
    console.log('[Amendoa v2] Processing data from:', url);

    // First pass: Build user ID -> screen_name mapping from all users in response
    const mappingBefore = userIdToScreenName.size;
    buildUserMapping(data);
    const newMappings = userIdToScreenName.size - mappingBefore;
    if (newMappings > 0) {
        console.log(`[Amendoa v2] Built user mapping: ${newMappings} new users (total: ${userIdToScreenName.size})`);
    }

    const tweets: any[] = [];

    // Helper to extract tweets from instructions
    const extractTweetsFromInstructions = (instructions: any[]) => {
        const extractedTweets: any[] = [];
        for (const instruction of instructions) {
            // Handle AddEntries
            if (instruction.type === 'TimelineAddEntries' || instruction.entries) {
                const entries = instruction.entries || [];
                for (const entry of entries) {
                    // Single Tweet
                    if (entry.content?.itemContent?.tweet_results?.result) {
                        extractedTweets.push(entry.content.itemContent.tweet_results.result);
                    }
                    // Thread/Module (conversations)
                    else if (entry.content?.items) {
                        for (const item of entry.content.items) {
                            if (item.item?.itemContent?.tweet_results?.result) {
                                extractedTweets.push(item.item.itemContent.tweet_results.result);
                            }
                        }
                    }
                }
            }
            // Handle PinEntry (Pinned Tweet)
            if (instruction.type === 'TimelinePinEntry' && instruction.entry?.content?.itemContent?.tweet_results?.result) {
                extractedTweets.push(instruction.entry.content.itemContent.tweet_results.result);
            }
        }
        return extractedTweets;
    };

    // Extract tweets from known API response structures
    if (data.data) {
        // Home Timeline ("For You" tab)
        if (data.data.home?.home_timeline_urt?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.home.home_timeline_urt.instructions));
        }
        // Following Timeline ("Following" tab) - HomeLatestTimeline endpoint
        // Structure: data.data.viewer.timeline.timeline.instructions (yes, two 'timeline' levels)
        if (data.data.viewer?.timeline?.timeline?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.viewer.timeline.timeline.instructions));
        }
        // Alternative Following Timeline structure (single timeline level)
        if (data.data.viewer?.timeline?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.viewer.timeline.instructions));
        }
        // User Profile Timeline
        if (data.data.user?.result?.timeline_v2?.timeline?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.user.result.timeline_v2.timeline.instructions));
        }
        // User Tweets (profile page)
        if (data.data.user?.result?.timeline?.timeline?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.user.result.timeline.timeline.instructions));
        }
        // Tweet Detail / Conversation
        if (data.data.threaded_conversation_with_injections_v2?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.threaded_conversation_with_injections_v2.instructions));
        }
        // Search Results
        if (data.data.search_by_raw_query?.search_timeline?.timeline?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.search_by_raw_query.search_timeline.timeline.instructions));
        }
        // Lists
        if (data.data.list?.tweets_timeline?.timeline?.instructions) {
            tweets.push(...extractTweetsFromInstructions(data.data.list.tweets_timeline.timeline.instructions));
        }
    }

    // Fallback for globalObjects structure
    if (data.globalObjects?.tweets) {
        for (const key in data.globalObjects.tweets) {
            tweets.push(data.globalObjects.tweets[key]);
        }
    }

    console.log(`[Amendoa v2] Found ${tweets.length} tweets`);

    // Get target handles for filtering
    const targetHandles = await getTargetHandleSet();
    console.log(`[Amendoa v2] Target handles:`, Array.from(targetHandles));
    const now = Date.now();

    // Discovery pre-filter thresholds
    // 24-hour window: X serves old content, but engagement still valuable
    const DISCOVERY_MIN_FOLLOWERS = 1000;
    const DISCOVERY_MAX_AGE_MINUTES = 24 * 60; // 24 hours - quality engagement > timing
    const DISCOVERY_MAX_REPLIES = 500; // High threshold - viral tweets still worth engaging

    let processedCount = 0;
    let targetTweetCount = 0;
    let discoveryTweetCount = 0;

    for (const tweet of tweets) {
        // Skip invalid tweets
        if (!tweet.rest_id && !tweet.id_str) continue;

        // Handle "TweetWithVisibilityResults" wrapper
        const actualTweet = tweet.tweet || tweet;

        const extracted = extractTweetData(actualTweet);
        if (!extracted) continue;

        processedCount++;

        const normalizedHandle = normalizeHandle(extracted.authorHandle);
        const isTarget = targetHandles.has(normalizedHandle);

        // Log every tweet author for debugging
        if (processedCount <= 10) {
            console.log(`[Amendoa v2] Tweet from @${normalizedHandle} - isTarget: ${isTarget}, followers: ${extracted.authorFollowers}`);
        }

        // For targets: always process
        // For non-targets: apply Discovery pre-filter
        const tweetAgeMinutes = (now - extracted.postedAt) / 1000 / 60;

        // Debug: Log why tweets fail discovery filter
        if (!isTarget && processedCount <= 20) {
            const reasons: string[] = [];
            if (extracted.authorFollowers < DISCOVERY_MIN_FOLLOWERS) reasons.push(`followers=${extracted.authorFollowers}<${DISCOVERY_MIN_FOLLOWERS}`);
            if (tweetAgeMinutes > DISCOVERY_MAX_AGE_MINUTES) reasons.push(`age=${tweetAgeMinutes.toFixed(1)}min>${DISCOVERY_MAX_AGE_MINUTES}`);
            if (extracted.replies > DISCOVERY_MAX_REPLIES) reasons.push(`replies=${extracted.replies}>${DISCOVERY_MAX_REPLIES}`);
            if (extracted.isReply) reasons.push('is_reply');

            if (reasons.length > 0) {
                console.log(`[Amendoa v2] Discovery skip @${normalizedHandle}: ${reasons.join(', ')}`);
            } else {
                console.log(`[Amendoa v2] Discovery PASS @${normalizedHandle}: ${extracted.authorFollowers} followers, ${tweetAgeMinutes.toFixed(1)}min old, ${extracted.replies} replies`);
            }
        }

        const passesDiscoveryFilter = !isTarget && (
            extracted.authorFollowers >= DISCOVERY_MIN_FOLLOWERS &&
            tweetAgeMinutes <= DISCOVERY_MAX_AGE_MINUTES &&
            extracted.replies <= DISCOVERY_MAX_REPLIES &&
            !extracted.isReply // Skip replies, we want original tweets
        );

        // Skip if not a target and doesn't pass discovery filter
        if (!isTarget && !passesDiscoveryFilter) {
            continue;
        }

        if (isTarget) {
            targetTweetCount++;

            // Update target's profile data
            await updateTargetProfile(normalizedHandle, {
                displayName: extracted.authorDisplayName,
                followerCount: extracted.authorFollowers,
                followingCount: extracted.authorFollowing,
                isPremium: extracted.authorIsPremium
            });
        } else {
            discoveryTweetCount++;
        }

        // Calculate opportunity score for both targets and discovery
        const tweetData: TweetData = {
            tweetId: extracted.tweetId,
            authorHandle: normalizedHandle,
            postedAt: extracted.postedAt,
            likes: extracted.likes,
            retweets: extracted.retweets,
            replies: extracted.replies,
            views: extracted.views,
            isReply: extracted.isReply,
            isThread: extracted.isThread,
            // Pass follower data for Discovery scoring
            authorFollowerCount: extracted.authorFollowers,
            authorIsPremium: extracted.authorIsPremium
        };

        const scoreResult = await calculateOpportunityScore(tweetData, now);

        // Check if tweet already exists in cache
        const existingTweet = await db.tweetCache.get(extracted.tweetId);

        if (existingTweet) {
            // UPDATE existing tweet - preserve user interaction state, update metrics
            await db.tweetCache.update(extracted.tweetId, {
                // Update engagement metrics (these change over time)
                likes: extracted.likes,
                retweets: extracted.retweets,
                replies: extracted.replies,
                views: extracted.views,
                // Re-calculate score with fresh data
                opportunityScore: scoreResult.score,
                scoreBadge: scoreResult.badge,
                // Update content if it changed (edits)
                content: extracted.content,
                // Keep: firstSeenAt, didReply, replyTimestamp, gotReplyBack
            });
        } else {
            // INSERT new tweet
            const cacheEntry: TweetCache = {
                tweetId: extracted.tweetId,
                authorHandle: normalizedHandle,
                content: extracted.content,
                postedAt: extracted.postedAt,
                firstSeenAt: now,
                hasMedia: extracted.hasMedia,
                isThread: extracted.isThread,
                isReply: extracted.isReply,
                likes: extracted.likes,
                retweets: extracted.retweets,
                replies: extracted.replies,
                views: extracted.views,
                opportunityScore: scoreResult.score,
                scoreBadge: scoreResult.badge,
                didReply: false,
                replyTimestamp: null,
                gotReplyBack: false,
                // Discovery fields
                isFromTarget: isTarget,
                authorFollowerCount: extracted.authorFollowers,
                authorIsPremium: extracted.authorIsPremium
            };

            await db.tweetCache.add(cacheEntry);
        }

        // Emit event for badge injection (targets only for now)
        if (isTarget) {
            window.dispatchEvent(new CustomEvent('AMENDOA_TWEET_SCORED', {
                detail: {
                    tweetId: extracted.tweetId,
                    score: scoreResult.score,
                    badge: scoreResult.badge
                }
            }));
        }

        // Log high-value opportunities
        if (scoreResult.score >= 60) {
            const source = isTarget ? '🎯 Target' : '🔍 Discovery';
            console.log(
                `[Amendoa v2] ${source}: @${normalizedHandle} (${extracted.authorFollowers} followers) - Score: ${scoreResult.score} (${scoreResult.badge})`
            );
        }
    }

    console.log(`[Amendoa v2] Processed ${processedCount} tweets: ${targetTweetCount} from targets, ${discoveryTweetCount} discovery`);

    // Emit batch completion event
    window.dispatchEvent(new CustomEvent('AMENDOA_TWEETS_PROCESSED', {
        detail: { total: processedCount, fromTargets: targetTweetCount, discovery: discoveryTweetCount }
    }));
}

// =============================================================================
// USER MAPPING
// =============================================================================

/**
 * Recursively search for users in the response and build ID -> screen_name map
 */
function buildUserMapping(obj: any, depth = 0): void {
    if (!obj || typeof obj !== 'object' || depth > 10) return;

    // Check if this object has user info with screen_name
    if (obj.screen_name && (obj.rest_id || obj.id_str)) {
        const userId = obj.rest_id || obj.id_str;
        userIdToScreenName.set(userId, obj.screen_name);
    }

    // Check core object (NEW Twitter API format - screen_name moved here)
    if (obj.core?.screen_name && (obj.rest_id || obj.id_str)) {
        const userId = obj.rest_id || obj.id_str;
        userIdToScreenName.set(userId, obj.core.screen_name);
    }

    // Check legacy object (older format)
    if (obj.legacy?.screen_name && (obj.rest_id || obj.id_str || obj.legacy.id_str)) {
        const userId = obj.rest_id || obj.id_str || obj.legacy.id_str;
        userIdToScreenName.set(userId, obj.legacy.screen_name);
    }

    // Check globalObjects.users (older API format)
    if (obj.globalObjects?.users) {
        for (const userId in obj.globalObjects.users) {
            const user = obj.globalObjects.users[userId];
            if (user.screen_name) {
                userIdToScreenName.set(userId, user.screen_name);
            }
        }
    }

    // Recurse into arrays and objects
    if (Array.isArray(obj)) {
        for (const item of obj) {
            buildUserMapping(item, depth + 1);
        }
    } else {
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                buildUserMapping(obj[key], depth + 1);
            }
        }
    }
}

// =============================================================================
// TWEET EXTRACTION
// =============================================================================

/**
 * Extract tweet data from Twitter API response object
 */
function extractTweetData(tweet: any): ExtractedTweet | null {
    // Handle different wrapper types
    let actualTweet = tweet;
    if (tweet.__typename === 'TweetWithVisibilityResults') {
        actualTweet = tweet.tweet || tweet;
    }

    const legacy = actualTweet.legacy || {};
    const tweetId = actualTweet.rest_id || actualTweet.id_str || legacy.id_str;

    if (!tweetId) return null;

    // Extract author info
    let authorHandle = '';
    let authorDisplayName = '';
    let authorFollowers = 0;
    let authorFollowing = 0;
    let authorIsPremium = false;

    // Path 1: core.user_results.result (most common)
    if (actualTweet.core?.user_results?.result) {
        let userResult = actualTweet.core.user_results.result;

        // Handle UserUnavailable or other wrapper types
        if (userResult.__typename === 'UserUnavailable') {
            // Skip unavailable users
        } else {
            // Sometimes there's another nested result
            if (userResult.result) {
                userResult = userResult.result;
            }

            const userLegacy = userResult.legacy || {};
            const userCore = userResult.core || {};

            // Twitter API format varies - check multiple locations for screen_name:
            // 1. core.screen_name (NEW format as of 2024 - Twitter moved it here!)
            // 2. legacy.screen_name (older format)
            // 3. userResult.screen_name (sometimes directly on user object)
            authorHandle = userCore.screen_name
                || userLegacy.screen_name
                || userResult.screen_name
                || '';

            // Get display name from core or legacy
            authorDisplayName = userCore.name || userLegacy.name || userResult.name || '';
            authorFollowers = userLegacy.followers_count || userResult.followers_count || 0;
            authorFollowing = userLegacy.friends_count || userResult.friends_count || 0;
            authorIsPremium = userResult.is_blue_verified || userLegacy.verified || false;

            // Fallback: Use user ID to lookup from mapping
            if (!authorHandle) {
                const userId = userResult.rest_id || userResult.id_str;
                if (userId && userIdToScreenName.has(userId)) {
                    authorHandle = userIdToScreenName.get(userId)!;
                    console.log(`[Amendoa v2] Found screen_name via ID mapping: ${userId} -> ${authorHandle}`);
                }
            }

            // Debug: Log full userResult structure if we still can't find screen_name
            if (!authorHandle) {
                console.warn(`[Amendoa v2] Cannot find screen_name. Full userResult:`, JSON.stringify(userResult, null, 2).slice(0, 2000));
            }
        }
    }

    // Path 2: author.result (newer format)
    if (!authorHandle && actualTweet.author?.result) {
        const userResult = actualTweet.author.result;
        const userLegacy = userResult.legacy || {};

        authorHandle = userLegacy.screen_name || userResult.screen_name || '';
        authorDisplayName = userLegacy.name || userResult.name || '';
        authorFollowers = userLegacy.followers_count || 0;
        authorFollowing = userLegacy.friends_count || 0;
        authorIsPremium = userResult.is_blue_verified || userLegacy.verified || false;
    }

    // Path 3: tweet_results.result (nested tweet wrapper)
    if (!authorHandle && actualTweet.tweet_results?.result) {
        return extractTweetData(actualTweet.tweet_results.result);
    }

    // Path 4: Direct user object on legacy
    if (!authorHandle && legacy.user) {
        authorHandle = legacy.user.screen_name || '';
        authorDisplayName = legacy.user.name || '';
        authorFollowers = legacy.user.followers_count || 0;
        authorFollowing = legacy.user.friends_count || 0;
        authorIsPremium = legacy.user.verified || false;
    }

    // Path 5: Fallback recursive search
    if (!authorHandle) {
        const userObj = findUserObject(actualTweet);
        if (userObj) {
            const userLegacy = userObj.legacy || {};
            authorHandle = userLegacy.screen_name || userObj.screen_name || '';
            authorDisplayName = userLegacy.name || userObj.name || '';
            authorFollowers = userLegacy.followers_count || userObj.followers_count || 0;
            authorFollowing = userLegacy.friends_count || userObj.friends_count || 0;
            authorIsPremium = userObj.is_blue_verified || userLegacy.verified || false;
        }
    }

    if (!authorHandle) {
        // Log the tweet structure for debugging (only first few)
        console.warn(`[Amendoa v2] Failed to extract author for tweet ${tweetId}. Keys:`, Object.keys(actualTweet || {}));
        // Log core structure if it exists
        if (actualTweet.core) {
            console.warn(`[Amendoa v2] core keys:`, Object.keys(actualTweet.core));
            if (actualTweet.core.user_results) {
                console.warn(`[Amendoa v2] user_results keys:`, Object.keys(actualTweet.core.user_results));
                if (actualTweet.core.user_results.result) {
                    console.warn(`[Amendoa v2] result keys:`, Object.keys(actualTweet.core.user_results.result));
                    console.warn(`[Amendoa v2] result.__typename:`, actualTweet.core.user_results.result.__typename);
                }
            }
        }
        return null;
    }

    // Extract tweet content
    let content = legacy.full_text || '';
    if (!content && actualTweet.note_tweet?.note_tweet_results?.result?.text) {
        content = actualTweet.note_tweet.note_tweet_results.result.text;
    }

    // Extract timestamp from snowflake ID
    const postedAt = extractTimestampFromSnowflake(tweetId).getTime();

    // Extract metrics
    const likes = legacy.favorite_count || 0;
    const retweets = legacy.retweet_count || 0;
    const replies = legacy.reply_count || 0;

    // Views might be in different locations
    let views = 0;
    if (actualTweet.views?.count) {
        views = parseInt(actualTweet.views.count) || 0;
    }

    // Detect media
    const hasMedia = !!(
        legacy.extended_entities?.media?.length ||
        legacy.entities?.media?.length ||
        actualTweet.card
    );

    // Detect if this is a reply
    const isReply = !!(legacy.in_reply_to_status_id_str || legacy.in_reply_to_user_id_str);

    // Detect if this is part of a thread (self-reply)
    const isThread = !!(
        legacy.in_reply_to_user_id_str &&
        legacy.in_reply_to_screen_name?.toLowerCase() === authorHandle.toLowerCase()
    );

    return {
        tweetId,
        authorHandle,
        authorDisplayName,
        authorFollowers,
        authorFollowing,
        authorIsPremium,
        content,
        postedAt,
        likes,
        retweets,
        replies,
        views,
        hasMedia,
        isThread,
        isReply
    };
}

/**
 * Recursively find user object in tweet data
 */
function findUserObject(obj: any, depth = 0): any {
    if (!obj || typeof obj !== 'object' || depth > 6) return null;

    // Check if this is a user object
    if (obj.__typename === 'User') return obj;
    if (obj.screen_name && (obj.name || obj.id_str)) return obj;
    if (obj.legacy?.screen_name) return obj;

    // Search in known paths (prioritized order)
    const paths = [
        'core',
        'user_results',
        'result',
        'user',
        'user_data',
        'author',
        'tweet',
        'legacy'
    ];

    for (const key of paths) {
        if (obj[key]) {
            const found = findUserObject(obj[key], depth + 1);
            if (found) return found;
        }
    }

    return null;
}

// =============================================================================
// USER ACTION TRACKING
// =============================================================================

/**
 * Track when user sends a reply
 */
export async function trackOutgoingReply(
    replyId: string,
    inReplyToTweetId: string,
    inReplyToHandle: string,
    content: string
): Promise<void> {
    const normalizedHandle = normalizeHandle(inReplyToHandle);
    const now = Date.now();

    // Store the reply
    await db.ourReplies.put({
        replyId,
        inReplyToTweetId,
        inReplyToHandle: normalizedHandle,
        repliedAt: now,
        content,
        likesReceived: 0,
        repliesReceived: 0,
        gotAuthorReply: false,
        authorReplyTimestamp: null
    });

    // Update tweet cache if we replied to a cached tweet
    const cachedTweet = await db.tweetCache.get(inReplyToTweetId);
    if (cachedTweet) {
        await db.tweetCache.update(inReplyToTweetId, {
            didReply: true,
            replyTimestamp: now
        });
    }

    // Increment daily stats
    const { incrementDailyStat } = await import('../db');
    await incrementDailyStat('repliesSent');

    // Check if we were a first responder (reply count was low when we replied)
    if (cachedTweet && cachedTweet.replies <= 5) {
        await incrementDailyStat('firstResponderCount');
    }

    console.log(`[Amendoa v2] Tracked reply to @${normalizedHandle}`);
}

/**
 * Track when someone replies to us (creates conversation obligation)
 */
export async function trackIncomingReply(
    fromHandle: string,
    replyContent: string,
    threadUrl: string,
    inReplyToOurTweetId?: string
): Promise<void> {
    const normalizedHandle = normalizeHandle(fromHandle);
    const now = Date.now();

    // Get target info if they're a target
    const target = await db.targetAccounts.get(normalizedHandle);

    // Create or update conversation
    const conversationId = `${normalizedHandle}-${Date.now()}`;

    await db.conversations.put({
        id: conversationId,
        otherPartyHandle: normalizedHandle,
        otherPartyTier: target?.tier || null,
        lastMessageFrom: 'them',
        lastMessageAt: now,
        lastMessagePreview: replyContent.slice(0, 100),
        threadUrl,
        isObligation: true,
        isDismissed: false
    });

    // If they replied to one of our replies, mark it and award XP
    if (inReplyToOurTweetId) {
        const ourReply = await db.ourReplies.get(inReplyToOurTweetId);
        if (ourReply) {
            await db.ourReplies.update(inReplyToOurTweetId, {
                gotAuthorReply: true,
                authorReplyTimestamp: now,
                repliesReceived: ourReply.repliesReceived + 1
            });

            // Increment response count
            const { incrementDailyStat } = await import('../db');
            await incrementDailyStat('repliesGotResponse');

            // Award XP for reply-back (gamification)
            const result = await recordGamificationAction('replyBack');
            console.log(`[Amendoa v2] +${result.xpEarned} XP for reply-back from @${normalizedHandle}`);

            // Emit XP earned event
            window.dispatchEvent(new CustomEvent('AMENDOA_XP_EARNED', {
                detail: { action: 'replyBack', ...result }
            }));
        }
    }

    // Emit event for UI
    window.dispatchEvent(new CustomEvent('AMENDOA_NEW_OBLIGATION', {
        detail: { handle: normalizedHandle, conversationId }
    }));

    console.log(`[Amendoa v2] New conversation obligation from @${normalizedHandle}`);
}
