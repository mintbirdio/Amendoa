import { describe, it, expect, vi } from 'vitest';
import {
    StaticCredentialProvider,
    RefreshingCredentialProvider,
    buildCredentialProvider
} from '../src/sources/Credentials';

interface FetchInit { method?: string; headers?: Record<string, string>; body?: string }

function tokenFetch(body: unknown, ok = true, status = 200) {
    return vi.fn(async (_url: string, _init?: FetchInit) => ({
        ok, status,
        async text() { return JSON.stringify(body); },
        async json() { return body; }
    }));
}

describe('StaticCredentialProvider', () => {
    it('requires a bearer token', () => {
        expect(() => new StaticCredentialProvider({ bearerToken: '', identityId: 'owner' })).toThrow(/bearerToken/);
    });
    it('resolves the static credential', async () => {
        const p = new StaticCredentialProvider({ bearerToken: 't', identityId: 'owner' });
        expect(await p.resolve()).toEqual({ bearerToken: 't', identityId: 'owner' });
    });
});

describe('RefreshingCredentialProvider', () => {
    const base = { clientId: 'cid', refreshToken: 'rt0', now: () => 1_000_000 };

    it('requires clientId and refreshToken', () => {
        expect(() => new RefreshingCredentialProvider({ clientId: '', refreshToken: 'x' })).toThrow();
    });

    it('refreshes, returns the bearer, and sends the correct grant', async () => {
        const fetchFn = tokenFetch({ access_token: 'AT1', expires_in: 7200 });
        const p = new RefreshingCredentialProvider({ ...base, fetchFn });
        const cred = await p.resolve();

        expect(cred.bearerToken).toBe('AT1');
        const [url, init] = fetchFn.mock.calls[0]!;
        expect(url).toContain('oauth2/token');
        expect(init!.body).toContain('grant_type=refresh_token');
        expect(init!.body).toContain('refresh_token=rt0');
        expect(init!.body).toContain('client_id=cid');
        expect(init!.headers?.Authorization).toBeUndefined(); // public client, no Basic
    });

    it('caches the token until near expiry (no second refresh)', async () => {
        let t = 1_000_000;
        const fetchFn = tokenFetch({ access_token: 'AT1', expires_in: 7200 });
        const p = new RefreshingCredentialProvider({ ...base, now: () => t, fetchFn });
        await p.resolve();
        t += 60 * 60 * 1000;                 // +1h, still valid (2h token, 1m skew)
        await p.resolve();
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('re-refreshes once the token has expired', async () => {
        let t = 1_000_000;
        const fetchFn = tokenFetch({ access_token: 'AT1', expires_in: 7200 });
        const p = new RefreshingCredentialProvider({ ...base, now: () => t, fetchFn });
        await p.resolve();
        t += 3 * 60 * 60 * 1000;             // +3h, expired
        await p.resolve();
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('persists a rotated refresh token via onRefresh', async () => {
        const onRefresh = vi.fn();
        const fetchFn = tokenFetch({ access_token: 'AT1', expires_in: 7200, refresh_token: 'rt1' });
        const p = new RefreshingCredentialProvider({ ...base, fetchFn, onRefresh });
        await p.resolve();
        expect(onRefresh).toHaveBeenCalledWith('rt1');
    });

    it('sends Basic auth for a confidential client', async () => {
        const fetchFn = tokenFetch({ access_token: 'AT1', expires_in: 7200 });
        const p = new RefreshingCredentialProvider({ ...base, clientSecret: 'secret', fetchFn });
        await p.resolve();
        expect(fetchFn.mock.calls[0]![1]!.headers?.Authorization).toMatch(/^Basic /);
    });

    it('throws on a failed refresh', async () => {
        const p = new RefreshingCredentialProvider({ ...base, fetchFn: tokenFetch({ error: 'invalid_grant' }, false, 400) });
        await expect(p.resolve()).rejects.toThrow(/400/);
    });
});

describe('buildCredentialProvider', () => {
    it('builds a static provider', async () => {
        const p = buildCredentialProvider({ mode: 'static', bearerToken: 'b' });
        expect(await p.resolve()).toEqual({ bearerToken: 'b', identityId: 'owner' });
    });
    it('builds a refreshing provider for oauth', () => {
        const p = buildCredentialProvider({ mode: 'oauth', clientId: 'c', refreshToken: 'r' });
        expect(p).toBeInstanceOf(RefreshingCredentialProvider);
    });
});
