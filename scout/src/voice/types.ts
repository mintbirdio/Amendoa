/**
 * V2 voice types. A `VoiceProfile` is distilled once from your own tweets/replies
 * (and refreshed by the learning loop); `Guardrails` are your hard rules. Both are
 * inputs to the pure draft builder — no LLM or network in this file.
 */

/** One of the user's own replies, paired with the tweet it answered. Few-shot fuel. */
export interface VoiceExample {
    tweet: string;
    reply: string;
}

/** Distilled description of how the user writes — the cacheable prompt prefix. */
export interface VoiceProfile {
    /** Free-text distillation of tone, length, structure (produced by Opus). */
    summary: string;
    dos: string[];
    donts: string[];
    /** A handful of the user's strongest real replies, for few-shot grounding. */
    examples: VoiceExample[];
}

/** Hard rules layered on top of the voice profile. */
export interface Guardrails {
    avoidTopics: string[];
    neverSay: string[];
    /** e.g. ['en'] — languages the user replies in. */
    languages: string[];
    /** Soft character cap for a reply (instruction to the model). */
    maxLength?: number;
}

/** A request to draft replies to one tweet. */
export interface DraftRequest {
    tweetText: string;
    authorHandle: string;
    authorName?: string;
    /** Optional context, e.g. an audience-engagement insight about this author. */
    contextNote?: string;
    /** How many distinct options to produce (default 2). */
    options?: number;
}

/** One drafted reply, ready to show in the Telegram cockpit. */
export interface ReplyDraft {
    text: string;
}

/** An empty profile — used until the real one is distilled from your handle. */
export const EMPTY_VOICE: VoiceProfile = {
    summary: 'Natural, concise, human. Reply as a knowledgeable peer — specific, not generic.',
    dos: ['be specific and add a concrete thought', 'sound like a real person'],
    donts: ['use hashtags', 'be sycophantic or fawning', 'say "as an AI"'],
    examples: []
};

export const DEFAULT_GUARDRAILS: Guardrails = {
    avoidTopics: [],
    neverSay: [],
    languages: ['en'],
    maxLength: 270
};
