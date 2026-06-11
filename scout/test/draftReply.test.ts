import { describe, it, expect } from 'vitest';
import { draftReply, buildSystemPrompt, buildTask } from '../src/voice/draftReply';
import { parseReplies } from '../src/llm/AnthropicLlmClient';
import { FakeLlmClient } from '../src/llm/FakeLlmClient';
import type { VoiceProfile, Guardrails } from '../src/voice/types';

const voice: VoiceProfile = {
    summary: 'Terse, warm, builder-to-builder. Lowercase. No hashtags.',
    dos: ['ask a sharp question', 'be specific'],
    donts: ['use emojis', 'be sycophantic'],
    examples: [{ tweet: 'shipped v1 of my app', reply: 'congrats — what was the hardest part to get right?' }]
};
const guardrails: Guardrails = { avoidTopics: ['politics'], neverSay: ['game changer'], languages: ['en'], maxLength: 240 };

describe('buildSystemPrompt', () => {
    it('includes voice, dos/donts, guardrails, and examples', () => {
        const s = buildSystemPrompt(voice, guardrails);
        expect(s).toContain('Terse, warm');
        expect(s).toContain('ask a sharp question');     // do
        expect(s).toContain('use emojis');               // don't
        expect(s).toContain('under 240 characters');     // guardrail
        expect(s).toContain('politics');                 // avoid topic
        expect(s).toContain('game changer');             // never say
        expect(s).toContain('congrats — what was the hardest part'); // example reply
    });
});

describe('buildTask', () => {
    it('embeds the tweet, author, and optional context', () => {
        const t = buildTask({ tweetText: 'just launched my SaaS', authorHandle: 'JaneDoe', authorName: 'Jane', contextNote: 'audience loves technical depth' });
        expect(t).toContain('Jane (@JaneDoe)');
        expect(t).toContain('just launched my SaaS');
        expect(t).toContain('audience loves technical depth');
    });
});

describe('draftReply', () => {
    it('passes voice+task to the client and returns trimmed, deduped, capped drafts', async () => {
        const client = new FakeLlmClient(['  hey nice work  ', 'hey nice work', 'what stack did you use?']);
        const out = await draftReply(
            { tweetText: 'just launched my SaaS', authorHandle: 'JaneDoe', authorName: 'Jane', options: 2 },
            { client, voice, guardrails }
        );
        expect(client.lastPrompt!.system).toContain('Terse, warm');
        expect(client.lastPrompt!.task).toContain('just launched my SaaS');
        expect(client.lastPrompt!.options).toBe(2);
        expect(out.map(d => d.text)).toEqual(['hey nice work', 'what stack did you use?']); // trimmed + deduped + capped
    });

    it('defaults to 2 options and drops empties', async () => {
        const client = new FakeLlmClient(['', '   ', 'real reply']);
        const out = await draftReply({ tweetText: 't', authorHandle: 'a' }, { client, voice, guardrails });
        expect(client.lastPrompt!.options).toBe(2);
        expect(out).toEqual([{ text: 'real reply' }]);
    });
});

describe('parseReplies', () => {
    it('parses a JSON envelope', () => {
        expect(parseReplies('{"replies":["one","two"]}')).toEqual(['one', 'two']);
    });
    it('extracts JSON embedded in prose', () => {
        expect(parseReplies('Here you go:\n{"replies": ["a", "b"]}\nhope that helps')).toEqual(['a', 'b']);
    });
    it('drops non-string / empty entries', () => {
        expect(parseReplies('{"replies":["ok","",null,3]}')).toEqual(['ok']);
    });
    it('falls back to stripped lines when there is no JSON', () => {
        expect(parseReplies('1. first option\n2. second option')).toEqual(['first option', 'second option']);
        expect(parseReplies('- dash one\n* star two')).toEqual(['dash one', 'star two']);
    });
});
