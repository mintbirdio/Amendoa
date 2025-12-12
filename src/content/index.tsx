/**
 * Amendoa Content Script
 *
 * Entry point for the Chrome extension content script.
 * - Mounts React app in Shadow DOM
 * - Injects XHR/Fetch interceptor into main world
 * - Listens for intercepted data and processes it
 */

import { createRoot } from 'react-dom/client';
import styles from '../index.css?inline';
import App from '../App';
import { processInterceptedData, trackOutgoingReply } from '../services/processor';
import { recordGamificationAction, checkStreakOnLoad } from '../services/gamification';

console.log('[Amendoa] Initializing...');

const MOUNT_POINT_ID = 'amendoa-root';

(function inject() {
    // Prevent double injection
    if (document.getElementById(MOUNT_POINT_ID)) return;

    // Create mount point
    const host = document.createElement('div');
    host.id = MOUNT_POINT_ID;
    document.body.appendChild(host);

    // Create Shadow DOM for style isolation
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = styles;
    shadow.appendChild(style);

    // Inject XHR/Fetch interceptor into main world
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('assets/injector.js');
            script.onload = function () {
                // @ts-ignore
                this.remove();
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (e) {
            console.error('[Amendoa] Failed to inject interceptor:', e);
        }
    } else {
        console.log('[Amendoa] Dev Mode - Skipping injector injection');
    }

    // Listen for messages from interceptor
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        // Timeline/Tweet data intercepted
        if (event.data.type === 'AMENDOA_DATA_INTERCEPT') {
            processInterceptedData(event.data.payload.url, event.data.payload.data);
        }

        // User action intercepted (posting a tweet or reply)
        if (event.data.type === 'AMENDOA_ACTION_INTERCEPT') {
            const { actionType, data } = event.data.payload;

            if (actionType === 'CreateTweet' && data?.data?.create_tweet) {
                let tweetResult = data.data.create_tweet.tweet_results?.result;

                // Handle TweetWithVisibilityResults wrapper (Twitter sometimes wraps tweets this way)
                if (tweetResult?.tweet) {
                    tweetResult = tweetResult.tweet;
                }

                const replyId = tweetResult?.rest_id;
                const inReplyTo = tweetResult?.legacy?.in_reply_to_status_id_str;
                const inReplyToHandle = tweetResult?.legacy?.in_reply_to_screen_name;
                const content = tweetResult?.legacy?.full_text;

                if (inReplyTo && inReplyToHandle) {
                    // This is a REPLY
                    console.log('[Amendoa] Detected reply to @' + inReplyToHandle);
                    if (replyId) {
                        trackOutgoingReply(replyId, inReplyTo, inReplyToHandle, content || '');
                    }
                    // Award XP for reply
                    recordGamificationAction('reply').then(result => {
                        console.log(`[Amendoa] +${result.xpEarned} XP for reply`);
                        window.dispatchEvent(new CustomEvent('AMENDOA_XP_EARNED', {
                            detail: { action: 'reply', ...result }
                        }));
                    });
                } else {
                    // This is a POST
                    console.log('[Amendoa] Detected new post');
                    recordGamificationAction('post').then(result => {
                        console.log(`[Amendoa] +${result.xpEarned} XP for post`);
                        window.dispatchEvent(new CustomEvent('AMENDOA_XP_EARNED', {
                            detail: { action: 'post', ...result }
                        }));
                    });
                }
            }
        }
    });

    // Mount React app
    const root = createRoot(shadow);
    root.render(<App />);

    // Check streak on load (gamification)
    checkStreakOnLoad().then(result => {
        if (result.streakBroken) {
            console.log(`[Amendoa] Streak broken! Was ${result.previousStreak} days.`);
        } else if (result.currentStreak > 0) {
            console.log(`[Amendoa] Streak: ${result.currentStreak} days`);
        }
    });

    // Success message
    console.log(
        '%c Amendoa Loaded!',
        'background: #D97706; color: white; font-size: 14px; padding: 6px 10px; border-radius: 4px;'
    );
})();
