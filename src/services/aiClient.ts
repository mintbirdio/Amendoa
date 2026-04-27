import type { VoiceProfile } from './voiceProfile';

export class AIKeyMissingError extends Error {
    name = 'AIKeyMissingError';
    constructor(message: string = 'Anthropic API key not set') {
        super(message);
    }
}

export class AICapExceededError extends Error {
    name = 'AICapExceededError';
    count: number;
    cap: number;
    constructor(count: number, cap: number) {
        super(`AI cap exceeded: ${count}/${cap}`);
        this.count = count;
        this.cap = cap;
    }
}

const KEY_API_KEY = 'amendoa.anthropicKey';
const KEY_DAILY_CAP = 'amendoa.dailyCap';
const KEY_CALL_TODAY = 'amendoa.aiCallToday';
const KEY_HOOK_PACK_PREFIX = 'amendoa.hookPack.';

const MODEL_SONNET = 'claude-sonnet-4-6';
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const DEFAULT_DAILY_CAP = 50;

interface CallCounter {
    date: string;
    count: number;
    cap: number;
}

interface AnthropicResponse {
    content?: Array<{ type: string; text?: string }>;
    error?: { type?: string; message?: string };
}

interface StorageResult {
    [key: string]: unknown;
}

function storageGet(keys: string[] | string | null): Promise<StorageResult> {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, items => resolve(items as StorageResult));
    });
}

function storageSet(items: Record<string, unknown>): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.set(items, () => resolve());
    });
}

function storageRemove(keys: string | string[]): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.remove(keys, () => resolve());
    });
}

function todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

async function getApiKey(): Promise<string> {
    const got = await storageGet(KEY_API_KEY);
    const key = got[KEY_API_KEY];
    if (typeof key !== 'string' || key.length === 0) {
        throw new AIKeyMissingError();
    }
    return key;
}

async function getDailyCap(): Promise<number> {
    const got = await storageGet(KEY_DAILY_CAP);
    const cap = got[KEY_DAILY_CAP];
    if (typeof cap === 'number' && cap > 0) return cap;
    if (typeof cap === 'string') {
        const parsed = Number(cap);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_DAILY_CAP;
}

export async function getCallCounter(): Promise<CallCounter> {
    const today = todayUtc();
    const cap = await getDailyCap();
    const got = await storageGet(KEY_CALL_TODAY);
    const stored = got[KEY_CALL_TODAY] as { date?: string; count?: number } | undefined;
    if (!stored || stored.date !== today) {
        return { date: today, count: 0, cap };
    }
    return { date: today, count: stored.count ?? 0, cap };
}

async function incrementCounter(): Promise<void> {
    const today = todayUtc();
    const got = await storageGet(KEY_CALL_TODAY);
    const stored = got[KEY_CALL_TODAY] as { date?: string; count?: number } | undefined;
    const nextCount = stored && stored.date === today ? (stored.count ?? 0) + 1 : 1;
    await storageSet({ [KEY_CALL_TODAY]: { date: today, count: nextCount } });
}

async function checkCap(): Promise<void> {
    const counter = await getCallCounter();
    if (counter.count >= counter.cap) {
        throw new AICapExceededError(counter.count, counter.cap);
    }
}

async function sweepStaleHookPacks(): Promise<void> {
    const today = todayUtc();
    const all = await storageGet(null);
    const toRemove: string[] = [];
    for (const k of Object.keys(all)) {
        if (k.startsWith(KEY_HOOK_PACK_PREFIX) && k !== KEY_HOOK_PACK_PREFIX + today) {
            toRemove.push(k);
        }
    }
    if (toRemove.length > 0) {
        await storageRemove(toRemove);
    }
}

async function callAnthropic(
    model: string,
    system: string,
    userContent: string,
    maxTokens: number
): Promise<string> {
    const apiKey = await getApiKey();
    const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: userContent }]
        })
    });

    let body: AnthropicResponse;
    try {
        body = await res.json() as AnthropicResponse;
    } catch {
        body = {};
    }

    if (!res.ok) {
        const msg = body?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(`Anthropic API error: ${msg}`);
    }

    const text = body.content?.[0]?.text;
    if (typeof text !== 'string') {
        throw new Error('Anthropic API returned no text content');
    }
    return text;
}

export async function pingAi(): Promise<string> {
    await checkCap();
    const text = await callAnthropic(MODEL_HAIKU, 'You are a test endpoint. Respond with the single word "pong".', 'ping', 16);
    await incrementCounter();
    return text;
}

interface HookPackResult {
    hooks: string[];
    threadSkeletons: string[];
}

function buildVoiceContext(voice: VoiceProfile): string {
    const parts: string[] = [];
    parts.push(`avgLength=${voice.avgLength}, p25=${voice.p25Length}, p75=${voice.p75Length}`);
    parts.push(`questionRatio=${voice.questionRatio.toFixed(2)}, exclamationRatio=${voice.exclamationRatio.toFixed(2)}, firstPersonRatio=${voice.firstPersonRatio.toFixed(2)}`);
    parts.push(`sampleSize=${voice.sampleSize}, isDefault=${voice.isDefault}`);
    if (voice.commonPhrases.length > 0) {
        parts.push(`commonPhrases=${voice.commonPhrases.slice(0, 10).join(' | ')}`);
    }
    if (voice.userOverride) {
        parts.push(`userOverride=${voice.userOverride}`);
    }
    return parts.join('\n');
}

function parseJsonOrThrow<T>(raw: string): T {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const candidate = fenced ? fenced[1] : trimmed;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('AI response did not contain JSON');
    }
    const slice = candidate.slice(start, end + 1);
    try {
        return JSON.parse(slice) as T;
    } catch (e) {
        throw new Error(`Failed to parse AI JSON: ${(e as Error).message}`);
    }
}

export async function generateHookPack(input: {
    pillars: string[];
    voice: VoiceProfile;
    recentReplies: string[];
}): Promise<HookPackResult> {
    const today = todayUtc();
    const cacheKey = KEY_HOOK_PACK_PREFIX + today;
    const got = await storageGet(cacheKey);
    const cached = got[cacheKey] as HookPackResult | undefined;
    if (cached && Array.isArray(cached.hooks) && Array.isArray(cached.threadSkeletons)) {
        return cached;
    }

    await sweepStaleHookPacks();
    await checkCap();

    const system = "You generate angle suggestions, not finished tweets. The user writes the actual posts. No em-dashes. No 'delve', 'tapestry', 'realm', 'leverage'. No \"It's not X, it's Y\" templates. Match the voice profile provided. Output strict JSON: {\"hooks\": [string × 5], \"threadSkeletons\": [string × 2]}.";

    const userContent = [
        `Pillars: ${input.pillars.join(', ')}`,
        '',
        'Voice profile:',
        buildVoiceContext(input.voice),
        '',
        'Recent reply themes (most recent first):',
        ...input.recentReplies.slice(0, 10).map(r => `- ${r.slice(0, 200)}`)
    ].join('\n');

    const raw = await callAnthropic(MODEL_SONNET, system, userContent, 3000);
    const parsed = parseJsonOrThrow<HookPackResult>(raw);

    if (!Array.isArray(parsed.hooks) || !Array.isArray(parsed.threadSkeletons)) {
        throw new Error('AI hook pack response missing required arrays');
    }

    await storageSet({ [cacheKey]: parsed });
    await incrementCounter();
    return parsed;
}

export type PolishMode = 'tighten' | 'sharper-hook' | 'de-slop';

const POLISH_SYSTEMS: Record<PolishMode, string> = {
    tighten: "You tighten the user's draft without changing their voice. Cut filler. Keep meaning. Match the voice profile. No em-dashes. No generic AI phrasing. Output strict JSON: {\"rewritten\": string}.",
    'sharper-hook': "You sharpen only the opening hook of the user's draft. Keep the body intact unless it weakens the hook. Match the voice profile. No em-dashes. No 'It’s not X, it’s Y' templates. Output strict JSON: {\"rewritten\": string}.",
    'de-slop': "You remove generic AI phrasing from the user's draft while preserving voice. Strip 'delve', 'tapestry', 'realm', 'leverage', em-dashes, and viral templates. Match the voice profile. Output strict JSON: {\"rewritten\": string}."
};

export async function polishDraft(input: {
    text: string;
    mode: PolishMode;
    voice: VoiceProfile;
}): Promise<{ rewritten: string }> {
    await checkCap();

    const system = POLISH_SYSTEMS[input.mode];
    const userContent = [
        'Voice profile:',
        buildVoiceContext(input.voice),
        '',
        'Draft:',
        input.text
    ].join('\n');

    const raw = await callAnthropic(MODEL_HAIKU, system, userContent, 600);
    const parsed = parseJsonOrThrow<{ rewritten: string }>(raw);
    if (typeof parsed.rewritten !== 'string') {
        throw new Error('AI polish response missing rewritten string');
    }

    await incrementCounter();
    return parsed;
}

export async function draftReplyCandidates(input: {
    tweet: { handle: string; content: string };
    voice: VoiceProfile;
    pastReplies: string[];
}): Promise<{ candidates: string[] }> {
    await checkCap();

    const system = "Generate 3 short reply candidates (each ≤ 240 chars) anchored to the user's voice profile and past replies. Each offers a different angle: 1) build-on, 2) gentle-disagree, 3) ask-to-extend. No em-dashes. No generic AI phrasing. Output JSON: {\"candidates\": [string, string, string]}.";

    const userContent = [
        `Tweet by @${input.tweet.handle}:`,
        input.tweet.content,
        '',
        'Voice profile:',
        buildVoiceContext(input.voice),
        '',
        'Past replies (most recent first):',
        ...input.pastReplies.slice(0, 8).map(r => `- ${r.slice(0, 200)}`)
    ].join('\n');

    const raw = await callAnthropic(MODEL_SONNET, system, userContent, 1200);
    const parsed = parseJsonOrThrow<{ candidates: string[] }>(raw);
    if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
        throw new Error('AI reply candidates response missing candidates');
    }

    await incrementCounter();
    return parsed;
}
