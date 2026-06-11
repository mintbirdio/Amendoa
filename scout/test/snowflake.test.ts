import { describe, it, expect } from 'vitest';
import { snowflakeToTimestamp } from '../src/snowflake';

describe('snowflakeToTimestamp', () => {
    it('decodes a known tweet id to its creation time', () => {
        // id 1288834974657 << 22 corresponds to epoch+0; use a real-ish id.
        // Tweet 20 (first tweet, "just setting up my twttr") predates snowflake,
        // so use a modern id and assert it lands in a sane range.
        const ts = snowflakeToTimestamp('2064089261121626531');
        expect(ts).not.toBeNull();
        const year = new Date(ts as number).getUTCFullYear();
        expect(year).toBeGreaterThanOrEqual(2025);
        expect(year).toBeLessThanOrEqual(2027);
    });

    it('is monotonic: a larger id is newer', () => {
        const a = snowflakeToTimestamp('2064089261121626531')!;
        const b = snowflakeToTimestamp('2074089261121626531')!;
        expect(b).toBeGreaterThan(a);
    });

    it('returns null for non-numeric ids', () => {
        expect(snowflakeToTimestamp('abc')).toBeNull();
        expect(snowflakeToTimestamp('')).toBeNull();
        expect(snowflakeToTimestamp('12a3')).toBeNull();
    });

    it('returns null for zero/negative', () => {
        expect(snowflakeToTimestamp('0')).toBeNull();
    });
});
