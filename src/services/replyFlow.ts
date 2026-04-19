/**
 * Reply Flow Service
 *
 * Opens X's inline reply composer for a specific tweet and optionally
 * prefills text into the Draft.js contenteditable.
 *
 * No programmatic submit — user always clicks Post.
 */

// VERIFY: X's focal article on a status page has tabindex="-1"; the inline
// reply button inside it is the primary target. If X changes this, update
// FOCAL_ARTICLE_SELECTOR or REPLY_BUTTON_SELECTOR.
const FOCAL_ARTICLE_SELECTOR = 'article[tabindex="-1"][data-testid="tweet"]';
const REPLY_BUTTON_SELECTOR = 'button[data-testid="reply"]';
const COMPOSER_SELECTOR = 'div[data-testid="tweetTextarea_0"][contenteditable="true"]';

const FOCAL_WAIT_TIMEOUT_MS = 3000;
const COMPOSER_WAIT_TIMEOUT_MS = 3000;

function buildStatusUrl(handle: string, tweetId: string): string {
    return `https://x.com/${handle}/status/${tweetId}`;
}

function buildIntentUrl(tweetId: string): string {
    return `https://x.com/intent/tweet?in_reply_to_status_id=${tweetId}`;
}

function isOnStatusPage(tweetId: string): boolean {
    return window.location.pathname.includes(`/status/${tweetId}`);
}

/**
 * Wait for a selector to appear in the DOM, using a MutationObserver.
 */
function waitForElement<T extends Element = Element>(
    selector: string,
    timeoutMs: number
): Promise<T | null> {
    return new Promise(resolve => {
        const existing = document.querySelector<T>(selector);
        if (existing) {
            resolve(existing);
            return;
        }

        let resolved = false;
        const observer = new MutationObserver(() => {
            const found = document.querySelector<T>(selector);
            if (found && !resolved) {
                resolved = true;
                observer.disconnect();
                resolve(found);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                observer.disconnect();
                resolve(document.querySelector<T>(selector));
            }
        }, timeoutMs);
    });
}

/**
 * Prefill the X composer textarea using the browser's native text input
 * pipeline. Draft.js listens for beforeinput/input — setting innerText
 * alone does NOT update its internal state and leaves the Post button
 * disabled. execCommand('insertText') dispatches the synthetic events
 * Draft.js needs.
 *
 * Exported so future drafting phases can call this directly after the
 * composer is already open.
 */
export async function prefillComposer(draft: string): Promise<boolean> {
    const textarea = await waitForElement<HTMLElement>(
        COMPOSER_SELECTOR,
        COMPOSER_WAIT_TIMEOUT_MS
    );

    if (!textarea) return false;

    textarea.focus();

    if (draft.length === 0) return true;

    try {
        const ok = document.execCommand('insertText', false, draft);
        if (ok) return true;
    } catch {
        // fall through to InputEvent fallback
    }

    try {
        const event = new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: draft,
            bubbles: true,
            cancelable: true
        });
        textarea.dispatchEvent(event);
        return true;
    } catch {
        return false;
    }
}

/**
 * Open the inline reply composer for a tweet.
 *
 * Flow:
 *   1. Navigate to the status page if not already there.
 *   2. Wait for the focal article to mount (MutationObserver, 3s cap).
 *   3. Click its reply button.
 *   4. Wait for the composer textarea and prefill (empty for step 1).
 *   5. Fall back to the /intent/tweet URL if the focal article never mounts.
 */
export async function openReplyComposer(
    tweetId: string,
    handle: string,
    draft: string
): Promise<boolean> {
    if (!isOnStatusPage(tweetId)) {
        window.location.href = buildStatusUrl(handle, tweetId);
        return false;
    }

    const focal = await waitForElement<HTMLElement>(
        FOCAL_ARTICLE_SELECTOR,
        FOCAL_WAIT_TIMEOUT_MS
    );

    if (!focal) {
        window.location.href = buildIntentUrl(tweetId);
        return false;
    }

    const replyButton = focal.querySelector<HTMLElement>(REPLY_BUTTON_SELECTOR);
    if (!replyButton) {
        window.location.href = buildIntentUrl(tweetId);
        return false;
    }

    replyButton.click();

    const prefillOk = await prefillComposer(draft);
    if (!prefillOk) {
        // Composer selector broke or textarea never mounted — fall back
        // to the intent URL so the user still has a path to reply.
        window.location.href = buildIntentUrl(tweetId);
        return false;
    }
    return true;
}
