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
const FOCAL_ARTICLE_FALLBACK_SELECTOR = 'article[data-testid="tweet"]';
const REPLY_BUTTON_SELECTOR = 'button[data-testid="reply"]';
const COMPOSER_SELECTOR = 'div[data-testid="tweetTextarea_0"][contenteditable="true"]';

const FOCAL_WAIT_TIMEOUT_MS = 3000;
const COMPOSER_WAIT_TIMEOUT_MS = 3000;

// -----------------------------------------------------------------------------
// Diagnostics: last-attempt status for openReplyComposer.
// Module-scope singleton, read by the Sent tab's status strip. Not persisted.
// -----------------------------------------------------------------------------

export interface LastOpenStatus {
    timestamp: number;                       // Date.now() at call start
    focalFound: boolean;
    focalSelector: 'primary' | 'fallback' | null;
    prefillOk: boolean;
    focusOk: boolean;
    fellBackToIntent: boolean;
}

export let lastOpenStatus: LastOpenStatus | null = null;

function updateLastOpenStatus(patch: Partial<LastOpenStatus>): void {
    lastOpenStatus = {
        timestamp: lastOpenStatus?.timestamp ?? Date.now(),
        focalFound: lastOpenStatus?.focalFound ?? false,
        focalSelector: lastOpenStatus?.focalSelector ?? null,
        prefillOk: lastOpenStatus?.prefillOk ?? false,
        focusOk: lastOpenStatus?.focusOk ?? false,
        fellBackToIntent: lastOpenStatus?.fellBackToIntent ?? false,
        ...patch
    };
}

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
async function ensureFocus(textarea: HTMLElement): Promise<boolean> {
    // X's modal animation and React focus management can steal focus after we
    // call .focus(). Real users place the caret via click, which React-based
    // editors (Draft.js / Lexical) handle more reliably than focus() alone.
    // We click, call focus(), and place a caret at end-of-content via the
    // Selection API, then retry if focus drifts.
    const placeCaretAtEnd = (el: HTMLElement): void => {
        try {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } catch (e) {
            console.warn('[Amendoa][replyFlow] caret placement failed', e);
        }
    };

    const MAX_ATTEMPTS = 30;
    const ATTEMPT_DELAY_MS = 40;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (!textarea.isConnected) {
            console.warn('[Amendoa][replyFlow] textarea disconnected');
            return false;
        }
        const active = document.activeElement;
        const won = active === textarea || textarea.contains(active);
        if (won) {
            placeCaretAtEnd(textarea);
            console.log('[Amendoa][replyFlow] focus won after', i, 'attempts');
            return true;
        }
        if (i === 0) textarea.click();
        textarea.focus();
        placeCaretAtEnd(textarea);
        await new Promise(r => setTimeout(r, ATTEMPT_DELAY_MS));
    }
    const finalActive = document.activeElement;
    console.warn('[Amendoa][replyFlow] focus lost after retries. active=', finalActive?.tagName, (finalActive as HTMLElement)?.getAttribute?.('data-testid'), (finalActive as HTMLElement)?.className?.slice?.(0, 60));
    return false;
}

export async function prefillComposer(draft: string): Promise<boolean> {
    console.log('[Amendoa][replyFlow] prefillComposer start, waiting for', COMPOSER_SELECTOR);
    const textarea = await waitForElement<HTMLElement>(
        COMPOSER_SELECTOR,
        COMPOSER_WAIT_TIMEOUT_MS
    );

    if (!textarea) {
        console.warn('[Amendoa][replyFlow] composer textarea never appeared');
        return false;
    }
    console.log('[Amendoa][replyFlow] composer found', textarea);

    const focused = await ensureFocus(textarea);
    updateLastOpenStatus({ focusOk: focused });

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
    console.log('[Amendoa][replyFlow] openReplyComposer', { tweetId, handle, draftLen: draft.length });
    // Reset diagnostics for this attempt.
    lastOpenStatus = {
        timestamp: Date.now(),
        focalFound: false,
        focalSelector: null,
        prefillOk: false,
        focusOk: false,
        fellBackToIntent: false
    };

    if (!isOnStatusPage(tweetId)) {
        console.log('[Amendoa][replyFlow] not on status page, navigating');
        window.location.href = buildStatusUrl(handle, tweetId);
        return false;
    }

    let focal = await waitForElement<HTMLElement>(
        FOCAL_ARTICLE_SELECTOR,
        FOCAL_WAIT_TIMEOUT_MS
    );
    let matchedSelector: 'primary' | 'fallback' | null = focal ? 'primary' : null;

    if (!focal) {
        // Fallback selector — X may have dropped tabindex="-1" on the focal
        // article. Still better than jumping straight to /intent/tweet.
        focal = document.querySelector<HTMLElement>(FOCAL_ARTICLE_FALLBACK_SELECTOR);
        if (focal) matchedSelector = 'fallback';
    }

    updateLastOpenStatus({
        focalFound: !!focal,
        focalSelector: matchedSelector
    });

    if (!focal) {
        updateLastOpenStatus({ fellBackToIntent: true });
        window.location.href = buildIntentUrl(tweetId);
        return false;
    }

    const replyButton = focal.querySelector<HTMLElement>(REPLY_BUTTON_SELECTOR);
    if (!replyButton) {
        updateLastOpenStatus({ fellBackToIntent: true });
        window.location.href = buildIntentUrl(tweetId);
        return false;
    }

    replyButton.click();

    const prefillOk = await prefillComposer(draft);
    updateLastOpenStatus({ prefillOk });
    if (!prefillOk) {
        // Composer selector broke or textarea never mounted — fall back
        // to the intent URL so the user still has a path to reply.
        updateLastOpenStatus({ fellBackToIntent: true });
        window.location.href = buildIntentUrl(tweetId);
        return false;
    }
    return true;
}
