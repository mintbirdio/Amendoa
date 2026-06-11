/**
 * Credential seam for X data sources. Credentials resolve PER FETCH (not per
 * source instance), so one `OfficialXSource` serves three identities across the
 * product's life with no pipeline change:
 *   - owner's own key now           → StaticCredentialProvider
 *   - per-user bring-your-own-key    → lookup by ctx.userId (Phase 1, zero-COGS)
 *   - a shared central pool at scale → pool token + fan-out above the source
 *
 * The token is an OAuth 2.0 bearer. For owned reads ($0.001) it must be a
 * user-context (PKCE) token; a provider may refresh it internally and return a
 * fresh bearer each call — callers never see the refresh.
 */

export interface XCredential {
    /** OAuth 2.0 bearer token (user-context PKCE for owned reads, or app-only). */
    bearerToken: string;
    /** Who this read is attributed to — 'owner' | <userId> | 'pool'. For metering. */
    identityId: string;
}

export interface CredentialContext {
    /** Which user we're fetching for (Phase-1 BYO keys); undefined → owner/default. */
    userId?: string;
}

export interface CredentialProvider {
    resolve(ctx?: CredentialContext): Promise<XCredential>;
}

/** Phase-0: a single fixed identity, one token (from env / a secret store). */
export class StaticCredentialProvider implements CredentialProvider {
    constructor(private readonly cred: XCredential) {
        if (!cred.bearerToken) throw new Error('StaticCredentialProvider: bearerToken is required');
    }
    async resolve(): Promise<XCredential> {
        return this.cred;
    }
}

/** Minimal fetch signature (matches sources/TweetSource FetchFn) so it's injectable in tests. */
type FetchLike = (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

export interface RefreshingCredentialOptions {
    clientId: string;
    refreshToken: string;
    /** Set only for confidential clients; public PKCE clients omit it. */
    clientSecret?: string;
    identityId?: string;
    /** Defaults to X's OAuth2 token endpoint. */
    tokenUrl?: string;
    fetchFn?: FetchLike;
    now?: () => number;
    /** Called when X rotates the refresh token, so the caller can persist it. */
    onRefresh?: (newRefreshToken: string) => void | Promise<void>;
}

const DEFAULT_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const EXPIRY_SKEW_MS = 60_000; // refresh a minute early

function base64(s: string): string {
    if (typeof btoa === 'function') return btoa(s);
    // Node fallback
    return Buffer.from(s, 'utf8').toString('base64');
}

/**
 * OAuth 2.0 user-context provider: exchanges a refresh token for a short-lived
 * bearer and caches it until it nears expiry. This is the production Phase-0
 * provider — a single owner identity whose token auto-refreshes. (Per-user BYO
 * and pooled identities are sibling providers behind the same interface.)
 */
export class RefreshingCredentialProvider implements CredentialProvider {
    private readonly clientId: string;
    private refreshToken: string;
    private readonly clientSecret?: string;
    private readonly identityId: string;
    private readonly tokenUrl: string;
    private readonly fetchFn: FetchLike;
    private readonly now: () => number;
    private readonly onRefresh?: (t: string) => void | Promise<void>;
    private cached?: { token: string; expiresAt: number };

    constructor(opts: RefreshingCredentialOptions) {
        if (!opts.clientId || !opts.refreshToken) {
            throw new Error('RefreshingCredentialProvider: clientId and refreshToken are required');
        }
        this.clientId = opts.clientId;
        this.refreshToken = opts.refreshToken;
        this.clientSecret = opts.clientSecret;
        this.identityId = opts.identityId ?? 'owner';
        this.tokenUrl = opts.tokenUrl ?? DEFAULT_TOKEN_URL;
        this.fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchLike);
        this.now = opts.now ?? (() => Date.now());
        this.onRefresh = opts.onRefresh;
    }

    async resolve(): Promise<XCredential> {
        const now = this.now();
        if (this.cached && this.cached.expiresAt - EXPIRY_SKEW_MS > now) {
            return { bearerToken: this.cached.token, identityId: this.identityId };
        }
        return this.refresh(now);
    }

    private async refresh(now: number): Promise<XCredential> {
        const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (this.clientSecret) {
            headers['Authorization'] = `Basic ${base64(`${this.clientId}:${this.clientSecret}`)}`;
        }
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
            client_id: this.clientId
        }).toString();

        const res = await this.fetchFn(this.tokenUrl, { method: 'POST', headers, body });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`RefreshingCredentialProvider: token refresh HTTP ${res.status} — ${txt.slice(0, 200)}`);
        }
        const json = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string };
        if (!json.access_token) {
            throw new Error('RefreshingCredentialProvider: token response missing access_token');
        }
        this.cached = { token: json.access_token, expiresAt: now + (json.expires_in ?? 7200) * 1000 };
        if (json.refresh_token && json.refresh_token !== this.refreshToken) {
            this.refreshToken = json.refresh_token; // X rotates refresh tokens
            await this.onRefresh?.(json.refresh_token);
        }
        return { bearerToken: this.cached.token, identityId: this.identityId };
    }
}

/** Build the right provider from resolved config. `XCredentialConfig` lives in config.ts. */
export interface BuildCredentialOptions {
    fetchFn?: FetchLike;
    onRefresh?: (newRefreshToken: string) => void | Promise<void>;
}
export function buildCredentialProvider(
    cfg: { mode: 'static'; bearerToken: string } | { mode: 'oauth'; clientId: string; refreshToken: string; clientSecret?: string },
    opts: BuildCredentialOptions = {}
): CredentialProvider {
    if (cfg.mode === 'static') {
        return new StaticCredentialProvider({ bearerToken: cfg.bearerToken, identityId: 'owner' });
    }
    return new RefreshingCredentialProvider({
        clientId: cfg.clientId,
        refreshToken: cfg.refreshToken,
        clientSecret: cfg.clientSecret,
        fetchFn: opts.fetchFn,
        onRefresh: opts.onRefresh
    });
}
