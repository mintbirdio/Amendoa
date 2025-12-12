/**
 * Amendoa Injector
 * Monkey-patches XHR and Fetch to capture auth tokens and user actions
 */

(function () {
    // Store original methods
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;
    const setRequestHeader = XHR.setRequestHeader;

    // Patch XHR for Auth Tokens
    XHR.setRequestHeader = function (header, value) {
        if (header.toLowerCase() === 'authorization') {
            window.postMessage({
                type: 'AMENDOA_AUTH_INTERCEPT',
                payload: { bearer: value }
            }, '*');
        }
        if (header.toLowerCase() === 'x-csrf-token') {
            window.postMessage({
                type: 'AMENDOA_AUTH_INTERCEPT',
                payload: { csrf: value }
            }, '*');
        }
        return setRequestHeader.apply(this, arguments as any);
    };

    // Helper to check if response looks like timeline data
    const isTimelineData = (data: any): boolean => {
        if (!data || typeof data !== 'object') return false;
        // Check for common Twitter response structures
        const hasData = !!(
            data.globalObjects ||
            // Home Timeline ("For You" tab)
            (data.data && data.data.home && data.data.home.home_timeline_urt) ||
            // Following Timeline ("Following" tab) - viewer.timeline structure
            (data.data && data.data.viewer && data.data.viewer.timeline) ||
            // User Profile Timeline
            (data.data && data.data.user && data.data.user.result && data.data.user.result.timeline_v2) ||
            // Legacy Timeline
            (data.timeline && data.timeline.instructions) ||
            // Tweet Detail / Conversation
            (data.data && data.data.threaded_conversation_with_injections_v2) ||
            // Search Results
            (data.data && data.data.search_by_raw_query) ||
            // Lists
            (data.data && data.data.list && data.data.list.tweets_timeline) ||
            // UserTweets endpoint (profile page)
            (data.data && data.data.user && data.data.user.result && data.data.user.result.timeline) ||
            // TweetDetail
            (data.data && data.data.tweetResult) ||
            // Community Timeline
            (data.data && data.data.communityResults && data.data.communityResults.result) ||
            // Community Tweets Timeline (alternative structure)
            (data.data && data.data.community && data.data.community.community_timeline)
        );
        return hasData;
    };

    // Helper to check if response is notifications data (currently using URL matching instead)
    const _isNotificationsData = (data: any): boolean => {
        if (!data || typeof data !== 'object') return false;
        return !!(
            // Notifications endpoint
            (data.data && data.data.viewer && data.data.viewer.user_results &&
             data.data.viewer.user_results.result && data.data.viewer.user_results.result.timeline) ||
            // Alternative notifications structure
            (data.data && data.data.notifications) ||
            // globalObjects with notifications
            (data.globalObjects && data.globalObjects.notifications)
        );
    };
    void _isNotificationsData; // Suppress unused warning - kept for potential future use

    // Extract reply notifications from notifications data
    const extractReplyNotifications = (data: any): Array<{
        fromHandle: string;
        content: string;
        threadUrl: string;
        inReplyTo?: string;
    }> => {
        const results: Array<{
            fromHandle: string;
            content: string;
            threadUrl: string;
            inReplyTo?: string;
        }> = [];

        // Helper to extract tweet data from various structures
        const extractTweetInfo = (tweetResult: any): { fromHandle: string; content: string; tweetId: string; inReplyTo?: string } | null => {
            try {
                // Handle TweetWithVisibilityResults wrapper
                const tweet = tweetResult?.tweet || tweetResult;
                if (!tweet) return null;

                const legacy = tweet.legacy;
                if (!legacy) return null;

                // Get user info from various paths
                const user = tweet.core?.user_results?.result ||
                            tweet.user_results?.result ||
                            tweet.author;

                const userLegacy = user?.legacy || user;
                const fromHandle = userLegacy?.screen_name || '';
                const content = legacy.full_text || '';
                const tweetId = tweet.rest_id || legacy.id_str || '';
                const inReplyTo = legacy.in_reply_to_status_id_str;

                if (fromHandle && tweetId) {
                    return { fromHandle, content, tweetId, inReplyTo };
                }
            } catch (e) {
                // Ignore extraction errors
            }
            return null;
        };

        try {
            // Try multiple paths to find instructions
            let instructions: any[] = [];

            // Path 1: Standard notifications timeline
            if (data.data?.viewer?.user_results?.result?.timeline?.timeline?.instructions) {
                instructions = data.data.viewer.user_results.result.timeline.timeline.instructions;
            }
            // Path 2: Alternative structure
            else if (data.data?.viewer?.timeline?.timeline?.instructions) {
                instructions = data.data.viewer.timeline.timeline.instructions;
            }
            // Path 3: Direct notifications
            else if (data.data?.notifications?.timeline?.instructions) {
                instructions = data.data.notifications.timeline.instructions;
            }
            // Path 4: Notifications tab endpoint (newer structure)
            else if (data.data?.viewer?.notifications_timeline?.timeline?.instructions) {
                instructions = data.data.viewer.notifications_timeline.timeline.instructions;
            }
            // Path 5: notification_all endpoint
            else if (data.data?.notification_all?.timeline?.instructions) {
                instructions = data.data.notification_all.timeline.instructions;
            }

            // Debug: Log what we found and the data structure keys
            if (instructions.length === 0 && data.data) {
                console.error('Amendoa: No notification instructions found. Data keys:', Object.keys(data.data));
            } else {
                console.error('Amendoa: Notification instructions found:', instructions.length);
            }

            for (const instruction of instructions) {
                // Handle both 'entries' and 'addEntries' structures
                const entries = instruction.entries || instruction.addEntries?.entries || [];

                for (const entry of entries) {
                    const content = entry.content;
                    if (!content) continue;

                    // Handle TimelineTimelineItem entries (individual notifications)
                    if (content.itemContent) {
                        const itemContent = content.itemContent;

                        // Check notification context for type
                        const notification = itemContent.notification_context?.notification ||
                                           itemContent.notification;

                        // Extract notification type from various paths
                        const notifType = notification?.notificationType ||
                                         notification?.type ||
                                         itemContent.notificationType ||
                                         entry.entryId?.split('-')[0]; // e.g., "notification-reply-xxx"

                        // Check for reply-related notification types
                        const isReply = notifType === 'notification_reply' ||
                                       notifType === 'reply' ||
                                       notifType === 'Reply' ||
                                       (typeof notifType === 'string' && notifType.toLowerCase().includes('reply'));

                        if (isReply) {
                            // Try to get tweet from various locations
                            const tweetResult = itemContent.tweet_results?.result ||
                                               notification?.tweet?.result ||
                                               itemContent.tweet?.result;

                            const tweetInfo = extractTweetInfo(tweetResult);
                            if (tweetInfo) {
                                console.error('Amendoa: 📩 Found reply notification from @' + tweetInfo.fromHandle);
                                results.push({
                                    fromHandle: tweetInfo.fromHandle,
                                    content: tweetInfo.content,
                                    threadUrl: `https://twitter.com/${tweetInfo.fromHandle}/status/${tweetInfo.tweetId}`,
                                    inReplyTo: tweetInfo.inReplyTo
                                });
                            }
                        }
                    }

                    // Handle TimelineTimelineModule entries (grouped notifications)
                    if (content.items) {
                        for (const item of content.items) {
                            const itemContent = item.item?.itemContent;
                            if (!itemContent) continue;

                            const notification = itemContent.notification_context?.notification;
                            const notifType = notification?.notificationType || notification?.type;

                            const isReply = notifType === 'notification_reply' ||
                                           notifType === 'reply' ||
                                           (typeof notifType === 'string' && notifType.toLowerCase().includes('reply'));

                            if (isReply) {
                                const tweetResult = itemContent.tweet_results?.result;
                                const tweetInfo = extractTweetInfo(tweetResult);
                                if (tweetInfo) {
                                    results.push({
                                        fromHandle: tweetInfo.fromHandle,
                                        content: tweetInfo.content,
                                        threadUrl: `https://twitter.com/${tweetInfo.fromHandle}/status/${tweetInfo.tweetId}`,
                                        inReplyTo: tweetInfo.inReplyTo
                                    });
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Amendoa: Error extracting notifications', e);
        }

        console.error('Amendoa: Extracted', results.length, 'reply notifications');
        return results;
    };

    // Patch XHR Open to capture URL
    XHR.open = function (method, url) {
        // @ts-ignore
        this._url = url;
        // @ts-ignore
        this._method = method;

        // Note: We don't fire action intercept here anymore - we do it in response handler
        // to get the actual response data

        return open.apply(this, arguments as any);
    };

    // Patch XHR Send to capture response data
    XHR.send = function (body) {
        const self = this;
        // @ts-ignore
        self._body = body;

        const originalOnReadyStateChange = self.onreadystatechange;

        self.onreadystatechange = function () {
            if (self.readyState === 4 && self.status === 200) {
                try {
                    // Only try to parse if it looks like JSON (simple check)
                    const text = self.responseText;
                    if (text && (text.startsWith('{') || text.startsWith('['))) {
                        const data = JSON.parse(text);
                        // @ts-ignore
                        const url = self._url as string;

                        // Content-based detection for timeline data
                        if (isTimelineData(data)) {
                            console.error('Amendoa: 🟢 Captured Timeline Data via XHR', url);
                            window.postMessage({
                                type: 'AMENDOA_DATA_INTERCEPT',
                                payload: { url, data }
                            }, '*');
                        }

                        // Capture CreateTweet response (for gamification)
                        if (url && url.includes('CreateTweet') && data?.data?.create_tweet) {
                            console.error('Amendoa: 🟢 Captured CreateTweet response via XHR');
                            window.postMessage({
                                type: 'AMENDOA_ACTION_INTERCEPT',
                                payload: { actionType: 'CreateTweet', data }
                            }, '*');
                        }

                        // Capture FavoriteTweet response
                        if (url && url.includes('FavoriteTweet')) {
                            console.error('Amendoa: 🟢 Captured FavoriteTweet response via XHR');
                            window.postMessage({
                                type: 'AMENDOA_ACTION_INTERCEPT',
                                payload: { actionType: 'FavoriteTweet', data }
                            }, '*');
                        }

                        // Capture Notifications response
                        if (url && (url.includes('Notifications') || url.includes('notifications'))) {
                            console.error('Amendoa: 🟢 Captured Notifications via XHR', url);
                            const replyNotifs = extractReplyNotifications(data);
                            for (const notif of replyNotifs) {
                                console.error('Amendoa: 📩 Reply notification from @' + notif.fromHandle);
                                window.postMessage({
                                    type: 'AMENDOA_NOTIFICATION_INTERCEPT',
                                    payload: notif
                                }, '*');
                            }
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
            if (originalOnReadyStateChange) {
                originalOnReadyStateChange.apply(this, arguments as any);
            }
        };

        return send.apply(this, arguments as any);
    };

    // Patch Fetch
    const originalFetch = window.fetch;
    window.fetch = async function (input, _init) {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';

        const response = await originalFetch.apply(this, arguments as any);

        const clone = response.clone();

        clone.json().then(data => {
            // Content-based detection for timeline data
            if (isTimelineData(data)) {
                console.error('Amendoa: 🟢 Captured Timeline Data via Fetch', url);
                window.postMessage({
                    type: 'AMENDOA_DATA_INTERCEPT',
                    payload: { url, data }
                }, '*');
            }

            // Capture CreateTweet response (for gamification)
            if (url && url.includes('CreateTweet') && data?.data?.create_tweet) {
                console.error('Amendoa: 🟢 Captured CreateTweet response via Fetch');
                window.postMessage({
                    type: 'AMENDOA_ACTION_INTERCEPT',
                    payload: { actionType: 'CreateTweet', data }
                }, '*');
            }

            // Capture FavoriteTweet response
            if (url && url.includes('FavoriteTweet')) {
                console.error('Amendoa: 🟢 Captured FavoriteTweet response via Fetch');
                window.postMessage({
                    type: 'AMENDOA_ACTION_INTERCEPT',
                    payload: { actionType: 'FavoriteTweet', data }
                }, '*');
            }

            // Capture Notifications response
            if (url && (url.includes('Notifications') || url.includes('notifications'))) {
                console.error('Amendoa: 🟢 Captured Notifications via Fetch', url);
                const replyNotifs = extractReplyNotifications(data);
                for (const notif of replyNotifs) {
                    console.error('Amendoa: 📩 Reply notification from @' + notif.fromHandle);
                    window.postMessage({
                        type: 'AMENDOA_NOTIFICATION_INTERCEPT',
                        payload: notif
                    }, '*');
                }
            }
        }).catch(() => { });

        return response;
    };

    console.log('[Amendoa] Network interceptors active');
})();
