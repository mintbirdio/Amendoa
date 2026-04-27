import { db } from '../db';

export interface VoiceProfile {
    avgLength: number;
    p25Length: number;
    p75Length: number;
    commonPhrases: string[];
    questionRatio: number;
    exclamationRatio: number;
    firstPersonRatio: number;
    sampleSize: number;
    userOverride?: string;
    isDefault: boolean;
}

const STORAGE_KEY_PROFILE = 'amendoa.voiceProfile';
const STORAGE_KEY_OVERRIDE = 'amendoa.voiceOverride';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLES = 5;

const STOPWORDS = new Set<string>([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'am', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by',
    'from', 'as', 'that', 'this', 'these', 'those', 'it', 'its', 'i', 'you',
    'we', 'they', 'he', 'she', 'me', 'us', 'them', 'him', 'her', 'my', 'your',
    'our', 'their', 'his', 'hers', 'mine', 'yours', 'ours', 'theirs', 'do',
    'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'will', 'would',
    'can', 'could', 'should', 'shall', 'may', 'might', 'must', 'not', 'no',
    'yes', 'if', 'then', 'else', 'so', 'than', 'too', 'very', 'just', 'only',
    'also', 'like', 'get', 'got', 'getting', 'gets', 'into', 'about', 'over',
    'under', 'up', 'down', 'out', 'off', 'now', 'here', 'there', 'when',
    'where', 'who', 'what', 'how', 'why', 'all', 'any', 'some', 'one', 'two',
    'because', 'while', 'after', 'before', 'between', 'against', 'through',
    'during', 'without', 'within'
]);

interface StorageGetResult {
    [key: string]: unknown;
}

async function storageGet(keys: string[] | string | null): Promise<StorageGetResult> {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, items => resolve(items as StorageGetResult));
    });
}

async function storageSet(items: Record<string, unknown>): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.set(items, () => resolve());
    });
}

async function storageRemove(keys: string | string[]): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.remove(keys, () => resolve());
    });
}

function defaultProfile(sampleSize: number): VoiceProfile {
    return {
        avgLength: 120,
        p25Length: 80,
        p75Length: 180,
        commonPhrases: [],
        questionRatio: 0.1,
        exclamationRatio: 0.1,
        firstPersonRatio: 0.4,
        sampleSize,
        isDefault: true
    };
}

function percentile(sortedAsc: number[], p: number): number {
    if (sortedAsc.length === 0) return 0;
    const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor((sortedAsc.length - 1) * p)));
    return sortedAsc[idx];
}

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/’/g, "'")
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^a-z0-9'\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

function extractNGrams(tokens: string[], n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i + n <= tokens.length; i++) {
        const gram = tokens.slice(i, i + n);
        if (gram.every(t => STOPWORDS.has(t))) continue;
        out.push(gram.join(' '));
    }
    return out;
}

function topPhrases(allTexts: string[], topK: number): string[] {
    const counts = new Map<string, number>();
    for (const text of allTexts) {
        const tokens = tokenize(text);
        for (const gram of extractNGrams(tokens, 2)) {
            counts.set(gram, (counts.get(gram) ?? 0) + 1);
        }
        for (const gram of extractNGrams(tokens, 3)) {
            counts.set(gram, (counts.get(gram) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topK)
        .map(([phrase]) => phrase);
}

async function readUserOverride(): Promise<string | undefined> {
    const got = await storageGet(STORAGE_KEY_OVERRIDE);
    const v = got[STORAGE_KEY_OVERRIDE];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export async function computeVoiceProfile(): Promise<VoiceProfile> {
    const recent = await db.ourReplies
        .orderBy('repliedAt')
        .reverse()
        .limit(30)
        .toArray();

    const userOverride = await readUserOverride();

    if (recent.length < MIN_SAMPLES) {
        const profile = defaultProfile(recent.length);
        if (userOverride) profile.userOverride = userOverride;
        return profile;
    }

    const texts = recent.map(r => r.content || '').filter(t => t.length > 0);
    const lengths = texts.map(t => t.length).sort((a, b) => a - b);
    const sum = lengths.reduce((acc, n) => acc + n, 0);
    const avgLength = lengths.length > 0 ? Math.round(sum / lengths.length) : 0;
    const p25Length = percentile(lengths, 0.25);
    const p75Length = percentile(lengths, 0.75);

    const total = texts.length;
    const questionRatio = total > 0 ? texts.filter(t => /\?/.test(t)).length / total : 0;
    const exclamationRatio = total > 0 ? texts.filter(t => /!/.test(t)).length / total : 0;
    const firstPersonRatio = total > 0
        ? texts.filter(t => /\b(i|i'm|i'll|i've|i'd|me|my|mine|myself)\b/i.test(t.replace(/’/g, "'"))).length / total
        : 0;

    const commonPhrases = topPhrases(texts, 20);

    const profile: VoiceProfile = {
        avgLength,
        p25Length,
        p75Length,
        commonPhrases,
        questionRatio,
        exclamationRatio,
        firstPersonRatio,
        sampleSize: recent.length,
        isDefault: false
    };
    if (userOverride) profile.userOverride = userOverride;
    return profile;
}

export async function getStoredVoiceProfile(): Promise<VoiceProfile> {
    const got = await storageGet(STORAGE_KEY_PROFILE);
    const cached = got[STORAGE_KEY_PROFILE] as { profile: VoiceProfile; computedAt: number } | undefined;
    const userOverride = await readUserOverride();

    if (cached && typeof cached.computedAt === 'number' && Date.now() - cached.computedAt < CACHE_TTL_MS) {
        const profile = { ...cached.profile };
        if (userOverride) profile.userOverride = userOverride;
        else delete profile.userOverride;
        return profile;
    }

    const fresh = await computeVoiceProfile();
    await storageSet({
        [STORAGE_KEY_PROFILE]: { profile: fresh, computedAt: Date.now() }
    });
    if (userOverride) fresh.userOverride = userOverride;
    return fresh;
}

export async function setUserOverride(text: string): Promise<void> {
    if (text.length === 0) {
        await storageRemove(STORAGE_KEY_OVERRIDE);
        return;
    }
    await storageSet({ [STORAGE_KEY_OVERRIDE]: text });
}

export async function clearVoiceCache(): Promise<void> {
    await storageRemove(STORAGE_KEY_PROFILE);
}
