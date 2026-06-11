/**
 * ConsoleNotifier — prints alerts to stdout. For local dry-runs and tests.
 */

import type { Notifier, Alert } from './Notifier';

export class ConsoleNotifier implements Notifier {
    public readonly sent: Alert[] = [];

    constructor(private readonly log: (msg: string) => void = console.log) {}

    async send(alert: Alert): Promise<void> {
        this.sent.push(alert);
        this.log(`\n${alert.title}\n${alert.message}\n→ ${alert.url}`);
    }
}
