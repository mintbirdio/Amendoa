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
            (data.data && data.data.tweetResult)
        );
        return hasData;
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
        }).catch(() => { });

        return response;
    };

    console.log('Amendoa: Network interceptors active');
})();
