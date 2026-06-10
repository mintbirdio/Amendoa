/**
 * Scout entrypoint. Wires the real adapters and runs one poll cycle.
 * Designed to be invoked on a schedule (GitHub Actions cron).
 *
 *   npm start           # uses process.env
 */

import { loadEnv, ConfigError, type DataSourceConfig } from './config';
import { ScraperSource } from './sources/ScraperSource';
import { OfficialXSource } from './sources/OfficialXSource';
import { buildCredentialProvider } from './sources/Credentials';
import type { TweetSource } from './sources/TweetSource';
import { FileAlertStore } from './store/FileAlertStore';
import { buildNotifier } from './notify/factory';
import { runScout } from './pipeline';

/** Build the data source from config — official X API by default, scraper if chosen. */
export function buildSource(ds: DataSourceConfig): TweetSource {
    if (ds.kind === 'official') {
        return new OfficialXSource({ credentials: buildCredentialProvider(ds.credential) });
    }
    return new ScraperSource({ apiKey: ds.apiKey, baseUrl: ds.baseUrl });
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

    const source = buildSource(env.dataSource);
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
