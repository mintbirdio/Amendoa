import { describe, it, expect, vi } from 'vitest';
import { buildAlert } from '../src/notify/Notifier';
import { PushoverNotifier } from '../src/notify/PushoverNotifier';
import { ConsoleNotifier } from '../src/notify/ConsoleNotifier';
import { scoreTweet } from '../src/scoring';
import type { TweetData } from '../src/types';
import type { FetchFn } from '../src/sources/TweetSource';

const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);

function scored(over: Partial<TweetData> = {}, name?: string, text?: string) {
    const tweet: TweetData = {
        tweetId: '777',
        authorHandle: 'businessbarista',
        postedAt: NOW - 3 * 60_000,
        likes: 5, retweets: 1, replies: 2, views: 900,
        isReply: false, isThread: false,
        authorFollowerCount: 250_000, authorIsPremium: true,
        ...over
    };
    return scoreTweet(tweet, { now: NOW, authorName: name, text });
}

describe('buildAlert', () => {
    it('builds a phone-friendly alert with the bare permalink', () => {
        const alert = buildAlert(scored({}, 'Alex Lieberman', 'Most AI transformation has nothing to do with AI.'));
        expect(alert.url).toBe('https://x.com/businessbarista/status/777');
        expect(alert.urlTitle).toBe('Reply on X');
        expect(alert.title).toContain('Alex Lieberman');
        expect(alert.title).toContain('@businessbarista');
        expect(alert.message).toContain('AI transformation');
        expect(alert.message).toContain('2 replies');
        expect(alert.message).toContain('EARLY');
        expect(alert.message).toContain('250.0K followers');
    });

    it('truncates long tweet text', () => {
        const long = 'x'.repeat(400);
        const alert = buildAlert(scored({}, undefined, long));
        const firstLine = alert.message.split('\n')[0];
        expect(firstLine.length).toBeLessThanOrEqual(141);
        expect(firstLine.endsWith('…')).toBe(true);
    });

    it('works without text or author name', () => {
        const alert = buildAlert(scored());
        expect(alert.title).toContain('@businessbarista');
        expect(alert.url).toBe('https://x.com/businessbarista/status/777');
    });
});

function fakeFetch(ok = true, status = 200) {
    return vi.fn(async () => ({
        ok, status,
        async text() { return ok ? '{"status":1}' : 'error'; },
        async json() { return { status: ok ? 1 : 0 }; }
    })) as unknown as FetchFn;
}

describe('PushoverNotifier', () => {
    it('requires token and user', () => {
        expect(() => new PushoverNotifier({ token: '', user: 'u' })).toThrow();
        expect(() => new PushoverNotifier({ token: 't', user: '' })).toThrow();
    });

    it('POSTs the right params and url', async () => {
        const ff = fakeFetch();
        const n = new PushoverNotifier({ token: 'tok', user: 'usr', fetchFn: ff });
        await n.send(buildAlert(scored()));
        expect(ff).toHaveBeenCalledTimes(1);
        const [url, init] = (ff as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(url).toContain('api.pushover.net');
        const body = String(init.body);
        expect(body).toContain('token=tok');
        expect(body).toContain('user=usr');
        expect(body).toContain('url=https%3A%2F%2Fx.com%2Fbusinessbarista%2Fstatus%2F777');
    });

    it('raises priority for HOT (score >= 80)', async () => {
        const ff = fakeFetch();
        const n = new PushoverNotifier({ token: 'tok', user: 'usr', fetchFn: ff });
        const hot = scored({ replies: 0 }); // titan + fresh + 0 replies = 100
        expect(hot.score).toBeGreaterThanOrEqual(80);
        await n.send(buildAlert(hot));
        const body = String((ff as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
        expect(body).toContain('priority=1');
    });

    it('throws on non-ok', async () => {
        const n = new PushoverNotifier({ token: 'tok', user: 'usr', fetchFn: fakeFetch(false, 500) });
        await expect(n.send(buildAlert(scored()))).rejects.toThrow(/500/);
    });
});

describe('ConsoleNotifier', () => {
    it('records sent alerts', async () => {
        const n = new ConsoleNotifier(() => {});
        await n.send(buildAlert(scored()));
        expect(n.sent).toHaveLength(1);
    });
});
