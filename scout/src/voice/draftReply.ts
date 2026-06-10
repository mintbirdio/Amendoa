/**
 * Pure draft builder: turns a VoiceProfile + Guardrails + a tweet into the
 * `DraftPrompt` the LlmClient consumes, then post-processes the returned options
 * (trim, drop empties, dedupe, cap). No LLM or network here — fully unit-tested
 * against FakeLlmClient. The `system` half is a stable, cacheable prefix; only
 * the `task` varies per tweet, so prompt-caching pays off across drafts.
 */

import type { LlmClient } from '../llm/LlmClient';
import type { VoiceProfile, Guardrails, DraftRequest, ReplyDraft } from './types';

const DEFAULT_OPTIONS = 2;

export function buildSystemPrompt(voice: VoiceProfile, guardrails: Guardrails): string {
    const lines: string[] = [
        "You draft X (Twitter) replies in the user's exact voice. The user reviews and posts them by hand — you never post.",
        '',
        '# Voice',
        voice.summary.trim()
    ];

    if (voice.dos.length) lines.push('', 'Do:', ...voice.dos.map(d => `- ${d}`));
    if (voice.donts.length) lines.push('', "Don't:", ...voice.donts.map(d => `- ${d}`));

    const g: string[] = [];
    if (guardrails.maxLength) g.push(`- Keep each reply under ${guardrails.maxLength} characters.`);
    if (guardrails.languages.length) g.push(`- Write in: ${guardrails.languages.join(', ')}.`);
    if (guardrails.avoidTopics.length) g.push(`- Avoid these topics: ${guardrails.avoidTopics.join(', ')}.`);
    if (guardrails.neverSay.length) g.push(`- Never say: ${guardrails.neverSay.join('; ')}.`);
    if (g.length) lines.push('', '# Guardrails', ...g);

    if (voice.examples.length) {
        lines.push('', "# Examples of the user's own replies (match this voice)");
        for (const ex of voice.examples) lines.push('', `Tweet: ${ex.tweet}`, `Reply: ${ex.reply}`);
    }

    lines.push('', 'Reply as a knowledgeable peer — specific and human. No preamble, no "as an AI".');
    return lines.join('\n');
}

export function buildTask(req: DraftRequest): string {
    const who = req.authorName ? `${req.authorName} (@${req.authorHandle})` : `@${req.authorHandle}`;
    const lines = [`Draft replies to this tweet by ${who}:`, '', `"""${req.tweetText.trim()}"""`];
    if (req.contextNote) lines.push('', `Context: ${req.contextNote}`);
    return lines.join('\n');
}

export interface DraftDeps {
    client: LlmClient;
    voice: VoiceProfile;
    guardrails: Guardrails;
}

/** Produce up to `req.options` distinct reply drafts in the user's voice. */
export async function draftReply(req: DraftRequest, deps: DraftDeps): Promise<ReplyDraft[]> {
    const options = Math.max(1, req.options ?? DEFAULT_OPTIONS);
    const raw = await deps.client.draftReplies({
        system: buildSystemPrompt(deps.voice, deps.guardrails),
        task: buildTask(req),
        options
    });

    const seen = new Set<string>();
    const out: ReplyDraft[] = [];
    for (const r of raw) {
        const text = r.trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text });
        if (out.length >= options) break;
    }
    return out;
}
