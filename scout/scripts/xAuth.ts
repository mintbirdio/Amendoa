/**
 * One-time X OAuth 2.0 (PKCE) helper — mints the refresh token Scout needs.
 *
 *   X_CLIENT_ID=... [X_CLIENT_SECRET=...] [X_REDIRECT_URI=...] npm run x-auth
 *
 * Walks the Authorization Code + PKCE flow: prints an authorize URL, you click
 * "Authorize" once in the browser, paste the redirected URL back, and it prints
 * X_REFRESH_TOKEN to set as a secret. Scout then auto-refreshes the bearer.
 *
 * Prereqs in your X app (developer.x.com → your app → User authentication
 * settings): OAuth 2.0 enabled, type "Native/Public" (or set X_CLIENT_SECRET for
 * confidential), and the redirect URI below registered as a callback.
 */

import { createHash, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const AUTH_URL = process.env.X_AUTH_URL || 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = process.env.X_TOKEN_URL || 'https://api.x.com/2/oauth2/token';
const SCOPES = 'tweet.read users.read list.read offline.access';

function die(msg: string): never {
    console.error(`x-auth: ${msg}`);
    process.exit(1);
}

function b64url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extractCode(pasted: string, expectedState: string): string {
    if (pasted.includes('code=')) {
        const qs = pasted.slice(pasted.indexOf('?') + 1);
        const params = new URLSearchParams(qs);
        const state = params.get('state');
        if (state && state !== expectedState) die('state mismatch — possible CSRF; re-run and use a fresh URL');
        const code = params.get('code');
        if (!code) die('no ?code= found in the pasted URL');
        return code;
    }
    return pasted; // assume they pasted just the code
}

async function main(): Promise<void> {
    const clientId = process.env.X_CLIENT_ID?.trim();
    if (!clientId) die('set X_CLIENT_ID (X app → OAuth 2.0 settings)');
    const clientSecret = process.env.X_CLIENT_SECRET?.trim();
    const redirectUri = process.env.X_REDIRECT_URI?.trim() || 'http://127.0.0.1/callback';

    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    const state = b64url(randomBytes(16));

    const authorize = `${AUTH_URL}?` + new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256'
    }).toString();

    console.log('\n1) Open this URL, click Authorize, then copy the URL it redirects to');
    console.log(`   (your registered redirect must equal: ${redirectUri}):\n`);
    console.log(authorize + '\n');

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const pasted = (await rl.question('2) Paste the redirected URL (or just the code): ')).trim();
    rl.close();

    const code = extractCode(pasted, state);

    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (clientSecret) headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers,
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: verifier
        }).toString()
    });
    const json = await res.json().catch(() => ({})) as { refresh_token?: string; expires_in?: number; access_token?: string };
    if (!res.ok || !json.refresh_token) {
        die(`token exchange failed (HTTP ${res.status}): ${JSON.stringify(json)}`);
    }

    console.log('\n✅ Success — set these as Scout secrets:\n');
    console.log(`X_CLIENT_ID=${clientId}`);
    console.log(`X_REFRESH_TOKEN=${json.refresh_token}`);
    if (clientSecret) console.log(`X_CLIENT_SECRET=${clientSecret}`);
    console.log(`\n(Scout auto-refreshes the bearer; access token here expires in ${json.expires_in ?? '?'}s.)`);
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
