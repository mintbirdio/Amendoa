/**
 * TelegramCockpit — handles taps on the inline buttons Scout attaches to alerts.
 * This is the phone-native cockpit: the alert's "✍️ Draft" button calls back
 * here, we generate a voice-matched draft on demand (Opus), and the follow-up
 * "✅ Used it / 🔁 Regenerate / 👎 Skip" buttons record the reply action — the
 * learning + funnel signal. Pure-ish: Telegram + drafting are injected.
 *
 * Wire it up once: set the bot webhook to the Worker's /telegram route with a
 * secret_token; the Worker verifies the token and forwards updates here.
 */

import type { DraftService } from '../voice/DraftService';
import type { MeasurementStore } from '../measure/MeasurementStore';
import type { FetchFn } from '../sources/TweetSource';

interface TgChat { id: number | string }
interface TgMessage { chat?: TgChat }
interface TgCallbackQuery { id: string; data?: string; message?: TgMessage }
export interface TgUpdate { callback_query?: TgCallbackQuery }

export interface TelegramCockpitOptions {
    botToken: string;
    draftService: DraftService;
    store: MeasurementStore;
    fetchFn?: FetchFn;
    apiBase?: string;
    now?: () => number;
}

export interface CockpitResult {
    handled: boolean;
    action?: 'draft' | 'used' | 'skip' | 'unknown';
    tweetId?: string;
    drafts?: number;
}

const DEFAULT_API_BASE = 'https://api.telegram.org';

export class TelegramCockpit {
    private readonly botToken: string;
    private readonly draftService: DraftService;
    private readonly store: MeasurementStore;
    private readonly fetchFn: FetchFn;
    private readonly apiBase: string;
    private readonly now: () => number;

    constructor(opts: TelegramCockpitOptions) {
        if (!opts.botToken) throw new Error('TelegramCockpit: botToken is required');
        this.botToken = opts.botToken;
        this.draftService = opts.draftService;
        this.store = opts.store;
        this.fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
        this.apiBase = (opts.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, '');
        this.now = opts.now ?? (() => Date.now());
    }

    async handleUpdate(update: TgUpdate): Promise<CockpitResult> {
        const cq = update?.callback_query;
        if (!cq || typeof cq.data !== 'string') return { handled: false };

        const sep = cq.data.indexOf(':');
        const action = sep >= 0 ? cq.data.slice(0, sep) : cq.data;
        const tweetId = sep >= 0 ? cq.data.slice(sep + 1) : '';
        const chatId = cq.message?.chat?.id;

        if (action === 'draft') {
            const drafts = await this.draftService.draftFor(tweetId, 2);
            if (chatId !== undefined) await this.sendDrafts(chatId, tweetId, drafts.map(d => d.text));
            await this.answer(cq.id, drafts.length ? 'Drafted ✍️' : 'No draft — missing tweet context');
            return { handled: true, action: 'draft', tweetId, drafts: drafts.length };
        }

        if (action === 'used') {
            await this.store.recordReplyAction({ tweetId, replied: true, usedDraft: true, repliedAt: this.now() });
            await this.answer(cq.id, 'Logged ✅ — nice one');
            return { handled: true, action: 'used', tweetId };
        }

        if (action === 'skip') {
            await this.store.recordReplyAction({ tweetId, replied: false });
            await this.answer(cq.id, 'Skipped');
            return { handled: true, action: 'skip', tweetId };
        }

        await this.answer(cq.id, '');
        return { handled: true, action: 'unknown', tweetId };
    }

    private async sendDrafts(chatId: number | string, tweetId: string, drafts: string[]): Promise<void> {
        const text = drafts.length
            ? drafts.map((d, i) => `Option ${i + 1}:\n${d}`).join('\n\n')
            : 'No draft available (the tweet text wasn’t stored).';
        await this.call('sendMessage', {
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ Used it', callback_data: `used:${tweetId}` },
                    { text: '🔁 Regenerate', callback_data: `draft:${tweetId}` },
                    { text: '👎 Skip', callback_data: `skip:${tweetId}` }
                ]]
            }
        });
    }

    private async answer(callbackQueryId: string, text: string): Promise<void> {
        await this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
    }

    private async call(method: string, payload: unknown): Promise<void> {
        await this.fetchFn(`${this.apiBase}/bot${this.botToken}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }
}
