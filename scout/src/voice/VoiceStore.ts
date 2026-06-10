/**
 * VoiceStore — persists the distilled VoiceProfile. Phase-0 is one owner (id
 * 'owner'); per-user rows slot in later by varying the id. In-memory for tests,
 * D1 (single JSON row) for production.
 */

import type { VoiceProfile } from './types';
import { EMPTY_VOICE } from './types';
import type { D1Like } from '../measure/D1MeasurementStore';

export interface VoiceStore {
    load(): Promise<VoiceProfile>;
    save(profile: VoiceProfile): Promise<void>;
}

export class InMemoryVoiceStore implements VoiceStore {
    constructor(private profile: VoiceProfile = EMPTY_VOICE) {}
    async load(): Promise<VoiceProfile> { return this.profile; }
    async save(profile: VoiceProfile): Promise<void> { this.profile = profile; }
}

export const VOICE_SCHEMA =
    `CREATE TABLE IF NOT EXISTS voice_profile (id TEXT PRIMARY KEY, profile TEXT NOT NULL, updated_at INTEGER NOT NULL);`;

export class D1VoiceStore implements VoiceStore {
    constructor(private readonly db: D1Like, private readonly id: string = 'owner') {}

    async load(): Promise<VoiceProfile> {
        const row = await this.db.prepare(`SELECT profile FROM voice_profile WHERE id = ?`)
            .bind(this.id).first<{ profile: string }>();
        if (!row) return EMPTY_VOICE;
        try {
            return JSON.parse(row.profile) as VoiceProfile;
        } catch {
            return EMPTY_VOICE;
        }
    }

    async save(profile: VoiceProfile): Promise<void> {
        await this.db.prepare(`INSERT OR REPLACE INTO voice_profile (id, profile, updated_at) VALUES (?,?,?)`)
            .bind(this.id, JSON.stringify(profile), Date.now()).run();
    }
}
