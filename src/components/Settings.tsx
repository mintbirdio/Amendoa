import React, { useCallback, useEffect, useState } from 'react';
import { db, getTodayDate } from '../db';
import {
    AICapExceededError,
    AIKeyMissingError,
    getCallCounter,
    pingAi
} from '../services/aiClient';
import {
    clearVoiceCache,
    getStoredVoiceProfile,
    setUserOverride,
    type VoiceProfile
} from '../services/voiceProfile';

const KEY_API_KEY = 'amendoa.anthropicKey';
const KEY_DAILY_CAP = 'amendoa.dailyCap';
const KEY_OVERRIDE = 'amendoa.voiceOverride';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';
type FollowerLogStatus = 'idle' | 'logged';

interface CounterState {
    date: string;
    count: number;
    cap: number;
}

function maskKey(raw: string): string {
    if (raw.length <= 8) return '••••••••';
    return raw.slice(0, 4) + '…' + raw.slice(-4);
}

function storageGet<T = unknown>(key: string): Promise<T | undefined> {
    return new Promise(resolve => {
        chrome.storage.local.get(key, items => resolve(items[key] as T | undefined));
    });
}

function storageSet(key: string, value: unknown): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.set({ [key]: value }, () => resolve());
    });
}

export const Settings: React.FC = () => {
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
    const [dailyCapInput, setDailyCapInput] = useState<string>('50');
    const [followerCountInput, setFollowerCountInput] = useState<string>('');
    const [followerLogStatus, setFollowerLogStatus] = useState<FollowerLogStatus>('idle');
    const [followerSubmitting, setFollowerSubmitting] = useState<boolean>(false);
    const [voiceOverrideInput, setVoiceOverrideInput] = useState<string>('');
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [testMessage, setTestMessage] = useState<string>('');
    const [counter, setCounter] = useState<CounterState | null>(null);
    const [voiceProfilePreview, setVoiceProfilePreview] = useState<VoiceProfile | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [storedKey, storedCap, storedOverride, c, profile] = await Promise.all([
                storageGet<string>(KEY_API_KEY),
                storageGet<number | string>(KEY_DAILY_CAP),
                storageGet<string>(KEY_OVERRIDE),
                getCallCounter(),
                getStoredVoiceProfile()
            ]);
            if (cancelled) return;
            if (typeof storedKey === 'string' && storedKey.length > 0) {
                setApiKeyMasked(maskKey(storedKey));
            }
            if (typeof storedCap === 'number') setDailyCapInput(String(storedCap));
            else if (typeof storedCap === 'string') setDailyCapInput(storedCap);
            if (typeof storedOverride === 'string') setVoiceOverrideInput(storedOverride);
            setCounter(c);
            setVoiceProfilePreview(profile);
        })();
        return () => { cancelled = true; };
    }, []);

    const refreshCounter = useCallback(async () => {
        const c = await getCallCounter();
        setCounter(c);
    }, []);

    const handleSaveKey = useCallback(async () => {
        const trimmed = apiKeyInput.trim();
        if (trimmed.length === 0) return;
        await storageSet(KEY_API_KEY, trimmed);
        setApiKeyMasked(maskKey(trimmed));
        setApiKeyInput('');
        setTestStatus('idle');
        setTestMessage('');
    }, [apiKeyInput]);

    const handleTest = useCallback(async () => {
        setTestStatus('testing');
        setTestMessage('');
        try {
            await pingAi();
            setTestStatus('ok');
            setTestMessage('Test call succeeded.');
        } catch (e) {
            setTestStatus('fail');
            if (e instanceof AIKeyMissingError) {
                setTestMessage('No API key set.');
            } else if (e instanceof AICapExceededError) {
                setTestMessage(`Daily cap reached (${e.count}/${e.cap}).`);
            } else {
                setTestMessage((e as Error).message || 'Test call failed.');
            }
        }
        await refreshCounter();
    }, [refreshCounter]);

    const handleSaveCap = useCallback(async () => {
        const parsed = Number(dailyCapInput);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) return;
        await storageSet(KEY_DAILY_CAP, Math.floor(parsed));
        await refreshCounter();
    }, [dailyCapInput, refreshCounter]);

    const handleLogFollowers = useCallback(async () => {
        if (followerSubmitting) return;
        const parsed = Number(followerCountInput);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        setFollowerSubmitting(true);
        try {
            const date = getTodayDate();
            const existing = await db.followerSnapshots.where('date').equals(date).first();
            if (existing && existing.id !== undefined) {
                await db.followerSnapshots.put({ id: existing.id, date, count: Math.floor(parsed) });
            } else {
                await db.followerSnapshots.put({ date, count: Math.floor(parsed) });
            }
            setFollowerLogStatus('logged');
            setTimeout(() => setFollowerLogStatus('idle'), 2000);
        } catch {
            setFollowerLogStatus('idle');
        } finally {
            setFollowerSubmitting(false);
        }
    }, [followerCountInput, followerSubmitting]);

    const handleSaveOverride = useCallback(async () => {
        await setUserOverride(voiceOverrideInput.trim());
        const profile = await getStoredVoiceProfile();
        setVoiceProfilePreview(profile);
    }, [voiceOverrideInput]);

    const handleRecompute = useCallback(async () => {
        await clearVoiceCache();
        const profile = await getStoredVoiceProfile();
        setVoiceProfilePreview(profile);
    }, []);

    const cardClass = 'p-3 rounded-xl bg-white/[0.02] border border-white/5';
    const labelClass = 'text-white/90 text-xs font-semibold mb-2';
    const subLabelClass = 'text-gray-500 text-[10px] mb-2';
    const inputClass = 'w-full px-2 py-1.5 text-xs bg-black/30 border border-white/10 rounded-md text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/50';
    const buttonPrimary = 'px-3 py-1.5 text-[11px] font-semibold rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-50';
    const buttonSecondary = 'px-3 py-1.5 text-[11px] font-semibold rounded-full bg-white/[0.02] border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all disabled:opacity-50';

    return (
        <div className="p-3 space-y-3">
            <div>
                <h2 className="text-white/90 text-sm font-semibold">Settings</h2>
                <p className="text-gray-600 text-[10px]">API key, daily cap, voice profile</p>
            </div>

            {/* Anthropic API Key */}
            <div className={cardClass}>
                <div className={labelClass}>Anthropic API Key</div>
                {apiKeyMasked && (
                    <div className="mb-2 text-[10px] text-gray-500">
                        Stored: <span className="font-mono text-amber-400">{apiKeyMasked}</span>
                    </div>
                )}
                <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                    className={inputClass + ' mb-2'}
                />
                <div className="flex items-center gap-2">
                    <button onClick={handleSaveKey} disabled={apiKeyInput.trim().length === 0} className={buttonPrimary}>
                        Save
                    </button>
                    <button onClick={handleTest} disabled={testStatus === 'testing'} className={buttonSecondary}>
                        {testStatus === 'testing' ? 'Testing…' : 'Test'}
                    </button>
                    {testStatus === 'ok' && <span className="text-[10px] text-green-400">{testMessage}</span>}
                    {testStatus === 'fail' && <span className="text-[10px] text-red-400">{testMessage}</span>}
                </div>
            </div>

            {/* Daily call cap */}
            <div className={cardClass}>
                <div className={labelClass}>Daily call cap</div>
                <div className={subLabelClass}>Hard limit on Anthropic calls per UTC day (1–500).</div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={1}
                        max={500}
                        value={dailyCapInput}
                        onChange={e => setDailyCapInput(e.target.value)}
                        className={inputClass + ' flex-1'}
                    />
                    <button onClick={handleSaveCap} className={buttonPrimary}>Save</button>
                </div>
            </div>

            {/* Today's calls */}
            <div className={cardClass}>
                <div className={labelClass}>Today's calls</div>
                {counter ? (
                    <div className="text-xs text-gray-300 font-mono">
                        {counter.count} / {counter.cap} today (UTC {counter.date})
                    </div>
                ) : (
                    <div className="text-xs text-gray-500">Loading…</div>
                )}
            </div>

            {/* Follower count today */}
            <div className={cardClass}>
                <div className={labelClass}>Follower count today</div>
                <div className={subLabelClass}>Manually log today's count for the 30-day delta.</div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={0}
                        value={followerCountInput}
                        onChange={e => setFollowerCountInput(e.target.value)}
                        placeholder="142"
                        className={inputClass + ' flex-1'}
                    />
                    <button
                        onClick={handleLogFollowers}
                        disabled={followerCountInput.trim().length === 0 || followerSubmitting}
                        className={buttonPrimary}
                    >
                        {followerSubmitting ? 'Submitting…' : 'Submit'}
                    </button>
                    {followerLogStatus === 'logged' && (
                        <span className="text-[10px] text-green-400">✓ Logged</span>
                    )}
                </div>
            </div>

            {/* Voice card override */}
            <div className={cardClass}>
                <div className={labelClass}>Voice card override</div>
                <div className={subLabelClass}>Optional: write a voice description that overrides the computed one.</div>
                <textarea
                    rows={6}
                    value={voiceOverrideInput}
                    onChange={e => setVoiceOverrideInput(e.target.value)}
                    placeholder="e.g. Direct, opinionated, 1-2 sentences, occasional dry humor."
                    className={inputClass + ' mb-2 font-mono'}
                />
                <button onClick={handleSaveOverride} className={buttonPrimary}>Save</button>
            </div>

            {/* Computed voice card preview */}
            <div className={cardClass}>
                <div className={labelClass}>Computed voice card</div>
                {voiceProfilePreview ? (
                    <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-words mb-2">
{`avgLength:        ${voiceProfilePreview.avgLength}
p25 / p75:        ${voiceProfilePreview.p25Length} / ${voiceProfilePreview.p75Length}
top phrases:      ${voiceProfilePreview.commonPhrases.slice(0, 5).join(', ') || '(none)'}
question ratio:   ${voiceProfilePreview.questionRatio.toFixed(2)}
exclaim ratio:    ${voiceProfilePreview.exclamationRatio.toFixed(2)}
1st-person ratio: ${voiceProfilePreview.firstPersonRatio.toFixed(2)}
sample size:      ${voiceProfilePreview.sampleSize}${voiceProfilePreview.isDefault ? ' (defaults)' : ''}`}
                    </pre>
                ) : (
                    <div className="text-xs text-gray-500 mb-2">Loading…</div>
                )}
                <button onClick={handleRecompute} className={buttonSecondary}>Recompute</button>
            </div>
        </div>
    );
};
