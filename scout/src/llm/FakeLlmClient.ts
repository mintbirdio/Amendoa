/**
 * Deterministic LlmClient for tests and local dry-runs — records the prompt it
 * received and returns canned replies, so the whole draft pipeline runs with no
 * API key and no tokens spent.
 */

import type { LlmClient, DraftPrompt } from './LlmClient';

export class FakeLlmClient implements LlmClient {
    public lastPrompt?: DraftPrompt;

    constructor(
        private readonly replies: string[] = [
            'congrats — what was the hardest part to get right?',
            'love this. how are you thinking about distribution?'
        ]
    ) {}

    async draftReplies(prompt: DraftPrompt): Promise<string[]> {
        this.lastPrompt = prompt;
        return [...this.replies];
    }
}
