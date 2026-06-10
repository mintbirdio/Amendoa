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
