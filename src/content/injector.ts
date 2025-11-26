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

        // Check for actions based on URL (these are usually reliable)
        if (typeof url === 'string') {
            if (url.includes('CreateTweet')) {
                window.postMessage({ type: 'AMENDOA_ACTION_INTERCEPT', payload: { actionType: 'CreateTweet' } }, '*');
            }
            if (url.includes('FavoriteTweet')) {
                window.postMessage({ type: 'AMENDOA_ACTION_INTERCEPT', payload: { actionType: 'FavoriteTweet' } }, '*');
            }
        }

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

                        // Content-based detection
                        if (isTimelineData(data)) {
                            // @ts-ignore
                            console.error('Amendoa: 🟢 Captured Timeline Data via XHR', self._url);
                            window.postMessage({
                                type: 'AMENDOA_DATA_INTERCEPT',
                                // @ts-ignore
                                payload: { url: self._url, data }
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
    window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        // @ts-ignore
        const _init = init;

        if (url) {
            if (url.includes('CreateTweet')) {
                window.postMessage({ type: 'AMENDOA_ACTION_INTERCEPT', payload: { actionType: 'CreateTweet' } }, '*');
            }
            if (url.includes('FavoriteTweet')) {
                window.postMessage({ type: 'AMENDOA_ACTION_INTERCEPT', payload: { actionType: 'FavoriteTweet' } }, '*');
            }
        }

        const response = await originalFetch.apply(this, arguments as any);

        const clone = response.clone();

        clone.json().then(data => {
            // Content-based detection
            if (isTimelineData(data)) {
                console.error('Amendoa: 🟢 Captured Timeline Data via Fetch', url);
                window.postMessage({
                    type: 'AMENDOA_DATA_INTERCEPT',
                    payload: { url, data }
                }, '*');
            }
        }).catch(() => { });

        return response;
    };

    console.log('Amendoa: Network interceptors active');
})();
