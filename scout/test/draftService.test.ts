import { describe, it, expect } from 'vitest';
import { InMemoryVoiceStore, D1VoiceStore } from '../src/voice/VoiceStore';
import { DraftService } from '../src/voice/DraftService';
import { InMemoryMeasurementStore } from '../src/measure/MeasurementStore';
import type { D1Like, D1Stmt } from '../src/measure/D1MeasurementStore';
import { FakeLlmClient } from '../src/llm/FakeLlmClient';
import { EMPTY_VOICE, DEFAULT_GUARDRAILS, type VoiceProfile } from '../src/voice/types';
import type { AlertRow as MAlertRow } from '../src/measure/types';

const NOW = Date.UTC(2026, 5, 10, 12, 0, 0);

function alertRow(over: Partial<MAlertRow> = {}): MAlertRow {
    return {
        tweetId: 't1', authorHandle: 'jane', alertedAt: NOW, postedAt: NOW - 60000,
        score: 88, badge: 'hot', authorValue: 30, timingMultiplier: 1.6, competitionFactor: 1.3,
        replyCountAtAlert: 1, source: 'poll', text: 'just shipped my SaaS', authorName: 'Jane',
        ...over
    };
}

describe('InMemoryVoiceStore', () => {
    it('defaults to EMPTY_VOICE and round-trips a saved profile', async () => {
        const s = new InMemoryVoiceStore();
        expect(await s.load()).toBe(EMPTY_VOICE);
        const p: VoiceProfile = { summary: 'mine', dos: ['x'], donts: ['y'], examples: [] };
        await s.save(p);
        expect(await s.load()).toEqual(p);
    });
});

describe('D1VoiceStore', () => {
    function fakeD1() {
        const runs: Array<{ sql: string; binds: unknown[] }> = [];
        let firstRow: unknown = null;
        const db: D1Like = {
            prepare(sql: string): D1Stmt {
                let binds: unknown[] = [];
                const stmt: D1Stmt = {
                    bind(...v) { binds = v; return stmt; },
                    async run() { runs.push({ sql, binds }); return {}; },
                    async all<T>() { return { results: [] as T[] }; },
                    async first<T>() { return firstRow as T | null; }
                };
                return stmt;
            }
        };
        return { db, runs, setFirst: (f: unknown) => { firstRow = f; } };
    }

    it('returns EMPTY_VOICE when no row exists', async () => {
        const f = fakeD1();
        expect(await new D1VoiceStore(f.db).load()).toBe(EMPTY_VOICE);
    });
    it('parses a stored profile', async () => {
        const f = fakeD1();
        const p: VoiceProfile = { summary: 'stored', dos: [], donts: [], examples: [] };
        f.setFirst({ profile: JSON.stringify(p) });
        expect(await new D1VoiceStore(f.db).load()).toEqual(p);
    });
    it('falls back to EMPTY_VOICE on corrupt JSON', async () => {
        const f = fakeD1();
        f.setFirst({ profile: 'not json' });
        expect(await new D1VoiceStore(f.db).load()).toBe(EMPTY_VOICE);
    });
    it('saves as a single JSON row', async () => {
        const f = fakeD1();
        await new D1VoiceStore(f.db, 'owner').save(EMPTY_VOICE);
        expect(f.runs[0].sql).toMatch(/INSERT OR REPLACE INTO voice_profile/);
        expect(f.runs[0].binds[0]).toBe('owner');
    });
});

describe('DraftService', () => {
    async function seeded(text?: string) {
        const store = new InMemoryMeasurementStore();
        await store.recordAlerts([alertRow(text === undefined ? {} : { text })]);
        return store;
    }

    it('drafts for a known tweet using its stored context + voice', async () => {
        const store = await seeded();
        const client = new FakeLlmClient(['congrats — what was the hardest part?']);
        const svc = new DraftService({ alerts: store, voice: new InMemoryVoiceStore(), client, guardrails: DEFAULT_GUARDRAILS });

        const drafts = await svc.draftFor('t1', 1);
        expect(drafts).toEqual([{ text: 'congrats — what was the hardest part?' }]);
        expect(client.lastPrompt!.task).toContain('just shipped my SaaS');
        expect(client.lastPrompt!.task).toContain('Jane (@jane)');
    });

    it('returns [] for an unknown tweet', async () => {
        const store = await seeded();
        const svc = new DraftService({ alerts: store, voice: new InMemoryVoiceStore(), client: new FakeLlmClient(), guardrails: DEFAULT_GUARDRAILS });
        expect(await svc.draftFor('nope')).toEqual([]);
    });

    it('returns [] when the alert has no stored text to reply to', async () => {
        const store = new InMemoryMeasurementStore();
        await store.recordAlerts([alertRow({ text: undefined })]);
        const svc = new DraftService({ alerts: store, voice: new InMemoryVoiceStore(), client: new FakeLlmClient(), guardrails: DEFAULT_GUARDRAILS });
        expect(await svc.draftFor('t1')).toEqual([]);
    });
});
