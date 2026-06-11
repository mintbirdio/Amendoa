/**
 * AnthropicLlmClient — the production LlmClient, backed by Claude Opus 4.8.
 *
 * Uses adaptive thinking (right for nuanced voice-matching) and marks the system
 * block (the stable voice profile + guardrails) as a cache breakpoint, so repeat
 * drafts re-read the voice prefix at ~0.1× input cost. Asks for a JSON envelope
 * and parses defensively, so it doesn't depend on a specific structured-output
 * SDK shape. The Anthropic client is injectable for tests.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, DraftPrompt } from './LlmClient';

const DEFAULT_MODEL = 'claude-opus-4-8';

export interface AnthropicLlmClientOptions {
    apiKey?: string;
    model?: string;
    /** Injected client for tests; otherwise built from apiKey. */
    client?: Anthropic;
}

export class AnthropicLlmClient implements LlmClient {
    private readonly client: Anthropic;
    private readonly model: string;

    constructor(opts: AnthropicLlmClientOptions) {
        if (!opts.client && !opts.apiKey) throw new Error('AnthropicLlmClient: apiKey is required');
        this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey });
        this.model = opts.model ?? DEFAULT_MODEL;
    }

    async draftReplies(prompt: DraftPrompt): Promise<string[]> {
        const res = await this.client.messages.create({
            model: this.model,
            max_tokens: 1024,
            thinking: { type: 'adaptive' },
            system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
            messages: [{
                role: 'user',
                content: `${prompt.task}\n\nReturn ${prompt.options} distinct reply option(s) as JSON: ` +
                    `{"replies": ["...", "..."]}. Output only the JSON object.`
            }]
        });
        return parseReplies(extractText(res));
    }
}

function extractText(res: Anthropic.Message): string {
    return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');
}

/** Pull reply strings out of the model's response — JSON envelope first, then a
 *  line-based fallback. Pure → unit-tested without the SDK. */
export function parseReplies(text: string): string[] {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            const obj = JSON.parse(match[0]) as { replies?: unknown };
            if (Array.isArray(obj.replies)) {
                return obj.replies.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
            }
        } catch {
            // fall through to line parsing
        }
    }
    return text
        .split('\n')
        .map(l => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);
}
