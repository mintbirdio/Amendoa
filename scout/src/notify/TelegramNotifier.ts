/**
 * TelegramNotifier — sends an alert to your phone via a free Telegram bot
 * (no Pushover license needed). The alert carries an inline "Reply on X" button
 * whose URL is the bare permalink; tapping it from the Telegram app deep-links
 * into the X app on the tweet (same verified Universal-Link behavior).
 *
 * Setup: message @BotFather → /newbot → get the bot token. Then message your
 * new bot once and read your chat id from
 * https://api.telegram.org/bot<token>/getUpdates (the message.chat.id field).
 */

import type { Notifier, Alert } from './Notifier';
import type { FetchFn } from '../sources/TweetSource';

export interface TelegramOptions {
    botToken: string;
    chatId: string;
    fetchFn?: FetchFn;
    /** Override the API base (for tests). Defaults to the public Telegram API. */
    apiBase?: string;
}

const DEFAULT_API_BASE = 'https://api.telegram.org';

export class TelegramNotifier implements Notifier {
    private readonly botToken: string;
    private readonly chatId: string;
    private readonly fetchFn: FetchFn;
    private readonly apiBase: string;

    constructor(opts: TelegramOptions) {
        if (!opts.botToken || !opts.chatId) {
            throw new Error('TelegramNotifier: botToken and chatId are required');
        }
        this.botToken = opts.botToken;
        this.chatId = opts.chatId;
        this.fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
        this.apiBase = (opts.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, '');
    }

    async send(alert: Alert): Promise<void> {
        const url = `${this.apiBase}/bot${this.botToken}/sendMessage`;

        // Row 1: deep-link to the tweet. Row 2 (cockpit): on-demand Draft + Skip,
        // handled by TelegramCockpit when the bot's webhook is wired.
        const keyboard: Array<Array<Record<string, string>>> = [[{ text: alert.urlTitle, url: alert.url }]];
        if (alert.tweetId) {
            keyboard.push([
                { text: '✍️ Draft a reply', callback_data: `draft:${alert.tweetId}` },
                { text: '👎 Skip', callback_data: `skip:${alert.tweetId}` }
            ]);
        }

        const body = JSON.stringify({
            chat_id: this.chatId,
            text: `${alert.title}\n\n${alert.message}`,
            // Plain text (no parse_mode) so tweet content never breaks Markdown.
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
        });

        const res = await this.fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`TelegramNotifier: HTTP ${res.status} — ${text.slice(0, 200)}`);
        }
    }
}
