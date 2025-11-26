/**
 * Amendoa v2 Content Script
 *
 * Entry point for the Chrome extension content script.
 * - Mounts React app in Shadow DOM
 * - Injects XHR/Fetch interceptor into main world
 * - Listens for intercepted data and processes it
 * - Initializes badge injector for tweet overlays
 */

import { createRoot } from 'react-dom/client';
import styles from '../index.css?inline';
import App from '../App';
import { processInterceptedData, trackOutgoingReply, trackIncomingReply } from '../services/processor';
import { badgeInjector } from '../services/badgeInjector';
import { profileButtonInjector } from '../services/profileButtonInjector';
import { recordGamificationAction, checkStreakOnLoad } from '../services/gamification';

console.log('[Amendoa v2] Initializing...');

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
            console.error('[Amendoa v2] Failed to inject interceptor:', e);
        }
    } else {
        console.log('[Amendoa v2] Dev Mode - Skipping injector injection');
    }

    // Listen for messages from interceptor
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        // Timeline/Tweet data intercepted
        if (event.data.type === 'AMENDOA_DATA_INTERCEPT') {
            processInterceptedData(event.data.payload.url, event.data.payload.data);
        }

        // Auth tokens intercepted
        if (event.data.type === 'AMENDOA_AUTH_INTERCEPT') {
            const { bearer, csrf } = event.data.payload;
            if (bearer) {
                console.log('[Amendoa v2] Captured Bearer Token');
                chrome.storage.local.set({ 'amendoa_bearer': bearer });
            }
            if (csrf) {
                console.log('[Amendoa v2] Captured CSRF Token');
                chrome.storage.local.set({ 'amendoa_csrf': csrf });
            }
        }

        // User action intercepted (posting a tweet or reply)
        if (event.data.type === 'AMENDOA_ACTION_INTERCEPT') {
            const { actionType, data } = event.data.payload;

            if (actionType === 'CreateTweet' && data?.data?.create_tweet) {
                // Extract tweet info
                const tweetResult = data.data.create_tweet.tweet_results?.result;
                const replyId = tweetResult?.rest_id;
                const inReplyTo = tweetResult?.legacy?.in_reply_to_status_id_str;
                const inReplyToHandle = tweetResult?.legacy?.in_reply_to_screen_name;
                const content = tweetResult?.legacy?.full_text;

                if (inReplyTo && inReplyToHandle) {
                    // This is a REPLY
                    console.log('[Amendoa v2] Detected reply to @' + inReplyToHandle);
                    if (replyId) {
                        trackOutgoingReply(replyId, inReplyTo, inReplyToHandle, content || '');
                    }
                    // Award gamification XP for reply
                    recordGamificationAction('reply').then(result => {
                        console.log(`[Amendoa v2] +${result.xpEarned} XP for reply (${result.multiplier}x multiplier)`);
                        // Emit event for UI update
                        window.dispatchEvent(new CustomEvent('AMENDOA_XP_EARNED', {
                            detail: { action: 'reply', ...result }
                        }));
                    });
                } else {
                    // This is a POST (not a reply)
                    console.log('[Amendoa v2] Detected new post');
                    // Award gamification XP for post
                    recordGamificationAction('post').then(result => {
                        console.log(`[Amendoa v2] +${result.xpEarned} XP for post (${result.multiplier}x multiplier)`);
                        // Emit event for UI update
                        window.dispatchEvent(new CustomEvent('AMENDOA_XP_EARNED', {
                            detail: { action: 'post', ...result }
                        }));
                    });
                }
            }
        }

        // Notification data intercepted (someone replied to us)
        if (event.data.type === 'AMENDOA_NOTIFICATION_INTERCEPT') {
            const { fromHandle, content, threadUrl, inReplyTo } = event.data.payload;
            if (fromHandle && threadUrl) {
                trackIncomingReply(fromHandle, content || '', threadUrl, inReplyTo);
            }
        }
    });

    // Mount React app
    const root = createRoot(shadow);
    root.render(<App />);

    // Initialize badge injector
    console.log('[Amendoa v2] Badge injector initialized:', badgeInjector ? '✓' : '✗');

    // Initialize profile button injector
    console.log('[Amendoa v2] Profile button injector initialized:', profileButtonInjector ? '✓' : '✗');

    // Check streak on load (gamification)
    checkStreakOnLoad().then(result => {
        if (result.streakBroken) {
            console.log(`[Amendoa v2] 💔 Streak broken! Was ${result.previousStreak} days.`);
            window.dispatchEvent(new CustomEvent('AMENDOA_STREAK_BROKEN', {
                detail: result
            }));
        } else if (result.currentStreak > 0) {
            console.log(`[Amendoa v2] 🔥 Streak: ${result.currentStreak} days`);
        }
    });

    // Success message
    console.log(
        '%c🎯 Amendoa v2 Loaded!',
        'background: #D97706; color: white; font-size: 16px; padding: 8px 12px; border-radius: 4px;'
    );
})();
