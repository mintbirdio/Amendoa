/**
 * Build the concrete Notifier from resolved config. Shared by the cron entry
 * point (`main.ts`) and the webhook Worker (`worker.ts`) so both wire alerts the
 * same way.
 */

import type { NotifierConfig } from '../config';
import type { Notifier } from './Notifier';
import { TelegramNotifier } from './TelegramNotifier';
import { PushoverNotifier } from './PushoverNotifier';

export function buildNotifier(cfg: NotifierConfig): Notifier {
    if (cfg.kind === 'telegram') {
        return new TelegramNotifier({ botToken: cfg.botToken, chatId: cfg.chatId });
    }
    return new PushoverNotifier({ token: cfg.token, user: cfg.user });
}
