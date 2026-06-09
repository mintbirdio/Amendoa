/**
 * Build twitterapi.io filter-rule strings from a list of handles you want to
 * watch. A rule like
 *
 *   (from:alice OR from:bob) -filter:retweets -filter:replies
 *
 * pushes ONLY those accounts' new original tweets — one delivery per tweet, no
 * polling, no re-scanning. That's Scout's magic-wand data path: cost scales with
 * the new tweets you actually receive, not with a poll clock.
 *
 * Rule `value` is capped at 255 chars by the API, so a long watch list is split
 * across multiple rules (each billed identically — per tweet, not per rule).
 */

/** API hard limit on a rule's `value` length. */
export const MAX_RULE_LEN = 255;

const SUFFIX = ' -filter:retweets -filter:replies';

function render(handles: string[]): string {
    return `(${handles.map(h => `from:${h}`).join(' OR ')})${SUFFIX}`;
}

/** Normalize a handle: trim, drop a leading @, lowercase. */
export function cleanHandle(h: string): string {
    return h.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Pack handles into the fewest rule strings that each fit MAX_RULE_LEN.
 * Throws if a single handle can't fit (only possible with absurdly long input).
 */
export function buildRuleValues(handles: string[]): string[] {
    const clean = [...new Set(handles.map(cleanHandle).filter(Boolean))];
    const rules: string[] = [];
    let group: string[] = [];

    for (const handle of clean) {
        const next = [...group, handle];
        if (render(next).length > MAX_RULE_LEN) {
            if (group.length === 0) {
                throw new Error(`Handle too long to fit a rule: "${handle}"`);
            }
            rules.push(render(group));
            group = [handle];
        } else {
            group = next;
        }
    }
    if (group.length) rules.push(render(group));
    return rules;
}
