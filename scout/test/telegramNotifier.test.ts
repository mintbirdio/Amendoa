import { describe, it, expect, vi } from 'vitest';
import { TelegramNotifier } from '../src/notify/TelegramNotifier';
import { buildAlert } from '../src/notify/Notifier';
import { scoreTweet } from '../src/scoring';
import type { TweetData } from '../src/types';
import type { FetchFn } from '../src/sources/TweetSource';

const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);

function alert() {
    const tweet: TweetData = {
        tweetId: '777',
        authorHandle: 'businessbarista',
        postedAt: NOW - 3 * 60_000,
        likes: 5, retweets: 1, replies: 2, views: 900,
        isReply: false, isThread: false,
        authorFollowerCount: 250_000, authorIsPremium: true
    };
    return buildAlert(scoreTweet(tweet, { now: NOW, authorName: 'Alex Lieberman', text: 'hello world' }));
}

function fakeFetch(ok = true, status = 200) {
    return vi.fn(async () => ({
        ok, status,
        async text() { return ok ? '{"ok":true}' : 'bad request'; },
        async json() { return { ok }; }
    })) as unknown as FetchFn;
}

describe('TelegramNotifier', () => {
    it('requires botToken and chatId', () => {
        expect(() => new TelegramNotifier({ botToken: '', chatId: 'c' })).toThrow();
        expect(() => new TelegramNotifier({ botToken: 'b', chatId: '' })).toThrow();
    });

    it('POSTs sendMessage with the token in the path and an inline reply button', async () => {
        const ff = fakeFetch();
        const n = new TelegramNotifier({ botToken: 'BOTTOKEN', chatId: '42', fetchFn: ff, apiBase: 'https://tg.test' });
        await n.send(alert());

        expect(ff).toHaveBeenCalledTimes(1);
        const [url, init] = (ff as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toBe('https://tg.test/botBOTTOKEN/sendMessage');
        expect(init.headers['Content-Type']).toBe('application/json');

        const payload = JSON.parse(init.body);
        expect(payload.chat_id).toBe('42');
        expect(payload.text).toContain('Alex Lieberman');
        expect(payload.text).toContain('2 replies');
        const button = payload.reply_markup.inline_keyboard[0][0];
        expect(button.text).toBe('Reply on X');
        expect(button.url).toBe('https://x.com/businessbarista/status/777');
    });

    it('throws on a non-ok response', async () => {
        const n = new TelegramNotifier({ botToken: 'b', chatId: 'c', fetchFn: fakeFetch(false, 400) });
        await expect(n.send(alert())).rejects.toThrow(/400/);
    });
});
