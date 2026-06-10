/**
 * DraftService — on-demand reply drafting. Given a tweetId (from a Telegram
 * button tap), it rebuilds the draft context from the stored alert, loads the
 * voice profile, and produces options via the LlmClient. On-demand by design:
 * cost is incurred only when the user actually asks for a draft.
 */

import type { LlmClient } from '../llm/LlmClient';
import type { Guardrails, ReplyDraft } from './types';
import type { VoiceStore } from './VoiceStore';
import { draftReply } from './draftReply';

/** Just the slice of the measurement store DraftService needs (structurally a MeasurementStore). */
export interface AlertContext {
    getAlert(tweetId: string): Promise<{ authorHandle: string; authorName?: string; text?: string } | null>;
}

export interface DraftServiceDeps {
    alerts: AlertContext;
    voice: VoiceStore;
    client: LlmClient;
    guardrails: Guardrails;
}

export class DraftService {
    constructor(private readonly deps: DraftServiceDeps) {}

    async draftFor(tweetId: string, options = 2): Promise<ReplyDraft[]> {
        const alert = await this.deps.alerts.getAlert(tweetId);
        if (!alert?.text) return [];
        const voice = await this.deps.voice.load();
        return draftReply(
            { tweetText: alert.text, authorHandle: alert.authorHandle, authorName: alert.authorName, options },
            { client: this.deps.client, voice, guardrails: this.deps.guardrails }
        );
    }
}
