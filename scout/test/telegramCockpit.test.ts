import { describe, it, expect, vi } from 'vitest';
import { TelegramCockpit } from '../src/notify/TelegramCockpit';
import { DraftService } from '../src/voice/DraftService';
import { InMemoryVoiceStore } from '../src/voice/VoiceStore';
import { InMemoryMeasurementStore } from '../src/measure/MeasurementStore';
import { FakeLlmClient } from '../src/llm/FakeLlmClient';
import { DEFAULT_GUARDRAILS } from '../src/voice/types';
import type { AlertRow } from '../src/measure/types';
import type { FetchFn } from '../src/sources/TweetSource';

const NOW = Date.UTC(2026, 5, 10, 12, 0, 0);

function alertRow(): AlertRow {
    return {
        tweetId: 't1', authorHandle: 'jane', alertedAt: NOW, postedAt: NOW - 60000,
        score: 88, badge: 'hot', authorValue: 30, timingMultiplier: 1.6, competitionFactor: 1.3,
        replyCountAtAlert: 1, source: 'poll', text: 'just shipped my SaaS', authorName: 'Jane'
    };
}

function calls(fetchFn: ReturnType<typeof okFetch>) {
    return fetchFn.mock.calls.map(([url, init]) => ({
        method: String(url).split('/bot')[1]?.split('/')[1] ?? '',
        body: JSON.parse((init as { body: string }).body)
    }));
}
function okFetch() {
    return vi.fn(async (_url: string, _init?: { method?: string; headers?: Record<string, string>; body?: string }) => ({
        ok: true, status: 200, async text() { return ''; }, async json() { return {}; }
    })) as unknown as FetchFn & { mock: { calls: Array<[string, { body: string }]> } };
}

async function setup(text?: string) {
    const store = new InMemoryMeasurementStore();
    await store.recordAlerts([text === undefined ? alertRow() : { ...alertRow(), text }]);
    const draftService = new DraftService({
        alerts: store, voice: new InMemoryVoiceStore(),
        client: new FakeLlmClient(['congrats — what was hardest?', 'love this, how’d you pick the stack?']),
        guardrails: DEFAULT_GUARDRAILS
    });
    const fetchFn = okFetch();
    const cockpit = new TelegramCockpit({ botToken: 'B', draftService, store, fetchFn, now: () => NOW });
    return { store, cockpit, fetchFn };
}

const cb = (data: string) => ({ callback_query: { id: 'q1', data, message: { chat: { id: 42 } } } });

describe('TelegramCockpit', () => {
    it('ignores non-callback updates', async () => {
        const { cockpit } = await setup();
        expect(await cockpit.handleUpdate({})).toEqual({ handled: false });
    });

    it('drafts on the Draft button and offers Used/Regenerate/Skip', async () => {
        const { cockpit, fetchFn } = await setup();
        const res = await cockpit.handleUpdate(cb('draft:t1'));
        expect(res).toMatchObject({ handled: true, action: 'draft', tweetId: 't1', drafts: 2 });

        const c = calls(fetchFn);
        const send = c.find(x => x.method === 'sendMessage')!;
        expect(send.body.text).toContain('Option 1:');
        expect(send.body.text).toContain('congrats — what was hardest?');
        const buttons = send.body.reply_markup.inline_keyboard[0].map((b: { callback_data: string }) => b.callback_data);
        expect(buttons).toEqual(['used:t1', 'draft:t1', 'skip:t1']);
        expect(c.some(x => x.method === 'answerCallbackQuery')).toBe(true);
    });

    it('records a used-it action (replied + usedDraft)', async () => {
        const { cockpit, store } = await setup();
        const res = await cockpit.handleUpdate(cb('used:t1'));
        expect(res).toMatchObject({ handled: true, action: 'used', tweetId: 't1' });
        expect(store.snapshot().actions[0]).toMatchObject({ tweetId: 't1', replied: true, usedDraft: true, repliedAt: NOW });
    });

    it('records a skip action (not replied)', async () => {
        const { cockpit, store } = await setup();
        await cockpit.handleUpdate(cb('skip:t1'));
        expect(store.snapshot().actions[0]).toMatchObject({ tweetId: 't1', replied: false });
    });

    it('handles a draft request with no stored context gracefully', async () => {
        const { cockpit, fetchFn } = await setup('');     // empty text → no draft
        const res = await cockpit.handleUpdate(cb('draft:t1'));
        expect(res.drafts).toBe(0);
        const send = calls(fetchFn).find(x => x.method === 'sendMessage');
        expect(send?.body.text).toMatch(/No draft available/);
    });
});
