/**
 * Register (or refresh) the twitterapi.io filter rules that feed Scout's webhook.
 *
 *   SCRAPER_API_KEY=... WATCH_HANDLES="elonmusk, naval, paulg" \
 *     npm run register-rule
 *
 * Handles come from WATCH_HANDLES (comma/space/newline separated) or a file path
 * given as the first CLI arg (one handle per line). The script packs them into
 * the fewest 255-char rules, creates each via add_rule, then activates it via
 * update_rule (is_effect: 1). Set this Worker's URL as the webhook destination in
 * the twitterapi.io dashboard — rules route there once active.
 */

import { readFileSync } from 'node:fs';
import { buildRuleValues } from '../src/webhook/rule';

const API_BASE = process.env.TWITTERAPI_BASE?.trim() || 'https://api.twitterapi.io';
const INTERVAL_SECONDS = Number(process.env.RULE_INTERVAL_SECONDS || '5');

function die(msg: string): never {
    console.error(`register-rule: ${msg}`);
    process.exit(1);
}

function readHandles(): string[] {
    const fileArg = process.argv[2];
    const raw = fileArg ? readFileSync(fileArg, 'utf8') : (process.env.WATCH_HANDLES ?? '');
    const handles = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    if (handles.length === 0) {
        die('no handles — set WATCH_HANDLES="a,b,c" or pass a file of handles (one per line)');
    }
    return handles;
}

async function post(apiKey: string, path: string, payload: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) : {}; } catch { /* leave empty */ }
    if (!res.ok || body.status === 'error') {
        die(`${path} → HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    return body;
}

async function main(): Promise<void> {
    const apiKey = process.env.SCRAPER_API_KEY?.trim();
    if (!apiKey) die('set SCRAPER_API_KEY');

    const handles = readHandles();
    const values = buildRuleValues(handles);
    console.log(`Building ${values.length} rule(s) for ${handles.length} handle(s):\n`);

    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        const tag = `scout-${i + 1}`;
        console.log(`  [${tag}] ${value}`);

        const added = await post(apiKey, '/oapi/tweet_filter/add_rule', {
            tag,
            value,
            interval_seconds: INTERVAL_SECONDS
        });
        const ruleId = String(added.rule_id ?? '');
        if (!ruleId) die(`add_rule returned no rule_id: ${JSON.stringify(added)}`);

        await post(apiKey, '/oapi/tweet_filter/update_rule', {
            rule_id: ruleId,
            tag,
            value,
            interval_seconds: INTERVAL_SECONDS,
            is_effect: 1
        });
        console.log(`     ✓ active — rule_id ${ruleId}\n`);
    }

    console.log('Done. Final step: paste your deployed Worker URL as the webhook');
    console.log('destination in the twitterapi.io dashboard → Filter Rules.');
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
