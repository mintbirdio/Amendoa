/**
 * Scout entrypoint. Wires the real adapters and runs one poll cycle.
 * Designed to be invoked on a schedule (GitHub Actions cron).
 *
 *   npm start           # uses process.env
 */

import { loadEnv, ConfigError, type NotifierConfig } from './config';
import { ScraperSource } from './sources/ScraperSource';
import { PushoverNotifier } from './notify/PushoverNotifier';
import { TelegramNotifier } from './notify/TelegramNotifier';
import type { Notifier } from './notify/Notifier';
import { FileAlertStore } from './store/FileAlertStore';
import { runScout } from './pipeline';

function buildNotifier(cfg: NotifierConfig): Notifier {
    if (cfg.kind === 'telegram') {
        return new TelegramNotifier({ botToken: cfg.botToken, chatId: cfg.chatId });
    }
    return new PushoverNotifier({ token: cfg.token, user: cfg.user });
}

export async function main(): Promise<number> {
    let env;
    try {
        env = loadEnv();
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error(`Config error: ${err.message}`);
            return 2;
        }
        throw err;
    }

    const source = new ScraperSource({
        apiKey: env.scraperApiKey,
        baseUrl: env.scraperBaseUrl
    });
    const notifier = buildNotifier(env.notifier);
    const store = await FileAlertStore.load(env.statePath);

    const summary = await runScout(env.watch, {
        source,
        notifier,
        store,
        config: env.config,
        log: (msg) => console.log(`[scout] ${msg}`)
    });

    console.log(`[scout] done: ${JSON.stringify({
        fetched: summary.fetched,
        eligible: summary.eligible,
        deduped: summary.deduped,
        alerted: summary.alerted
    })}`);
    return 0;
}

// Run when executed directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    main()
        .then((code) => process.exit(code))
        .catch((err) => {
            console.error('[scout] fatal:', err);
            process.exit(1);
        });
}
