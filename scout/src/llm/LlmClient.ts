/**
 * The LLM seam — the ONE interface the draft engine depends on. The pure prompt
 * builder (`voice/draftReply.ts`) is tested against a fake; the real Opus 4.8
 * call lives behind this in `AnthropicLlmClient`, so swapping models or providers
 * never touches the voice logic.
 */

export interface DraftPrompt {
    /** Stable, cacheable prefix: voice profile + guardrails + few-shot examples. */
    system: string;
    /** The tweet to reply to, plus any context. */
    task: string;
    /** Number of distinct reply options to produce. */
    options: number;
}

export interface LlmClient {
    /** Return up to `prompt.options` distinct reply strings in the user's voice. */
    draftReplies(prompt: DraftPrompt): Promise<string[]>;
}
