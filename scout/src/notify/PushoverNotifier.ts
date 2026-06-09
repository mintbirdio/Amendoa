/**
 * PushoverNotifier — sends an alert to your iPhone via Pushover ($4.99 once).
 * Tapping the notification opens the bare X permalink, which deep-links into
 * the X app on the tweet (verified on-device, Jun 2026).
 */

import type { Notifier, Alert } from './Notifier';
import type { FetchFn } from '../sources/TweetSource';

export interface PushoverOptions {
    token: string;   // application token
    user: string;    // user/group key
    fetchFn?: FetchFn;
    endpoint?: string;
}

const DEFAULT_ENDPOINT = 'https://api.pushover.net/1/messages.json';

export class PushoverNotifier implements Notifier {
    private readonly token: string;
    private readonly user: string;
    private readonly fetchFn: FetchFn;
    private readonly endpoint: string;

    constructor(opts: PushoverOptions) {
        if (!opts.token || !opts.user) {
            throw new Error('PushoverNotifier: token and user are required');
        }
        this.token = opts.token;
        this.user = opts.user;
        this.fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
        this.endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
    }

    async send(alert: Alert): Promise<void> {
        const params = new URLSearchParams({
            token: this.token,
            user: this.user,
            title: alert.title,
            message: alert.message,
            url: alert.url,
            url_title: alert.urlTitle,
            // HOT (>=80) raises priority by one notch for an audible alert.
            priority: alert.score >= 80 ? '1' : '0'
        });

        const res = await this.fetchFn(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`PushoverNotifier: HTTP ${res.status} — ${body.slice(0, 200)}`);
        }
    }
}
