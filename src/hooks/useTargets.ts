/**
 * useTargets Hook
 *
 * React hook for accessing and managing target accounts.
 * Uses Dexie's live queries for reactive updates.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TargetAccount, type Tier } from '../db';
import {
    addTarget,
    removeTarget,
    updateTarget,
    getTargetsGroupedByTier,
    getTargetStats,
    getTierWarnings,
    type AddTargetOptions,
    type TargetStats,
    type TierWarning
} from '../services/targetManager';

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get all targets as a flat array
 */
export function useAllTargets(): TargetAccount[] {
    return useLiveQuery(
        () => db.targetAccounts.toArray(),
        [],
        []
    );
}

/**
 * Get targets grouped by tier
 */
export function useTargetsGroupedByTier(): Record<Tier, TargetAccount[]> {
    return useLiveQuery(
        () => getTargetsGroupedByTier(),
        [],
        {
            titan: [],
            star: [],
            rising: [],
            emerging: [],
            peer: []
        }
    );
}

/**
 * Get targets for a specific tier
 */
export function useTargetsByTier(tier: Tier): TargetAccount[] {
    return useLiveQuery(
        () => db.targetAccounts.where('tier').equals(tier).toArray(),
        [tier],
        []
    );
}

/**
 * Get a single target by handle
 */
export function useTarget(handle: string): TargetAccount | null {
    const normalizedHandle = handle.toLowerCase().replace(/^@/, '');

    return useLiveQuery(
        () => db.targetAccounts.get(normalizedHandle),
        [normalizedHandle],
        null
    ) || null;
}

/**
 * Get target statistics
 */
export function useTargetStats(): TargetStats {
    return useLiveQuery(
        () => getTargetStats(),
        [],
        {
            total: 0,
            byTier: { titan: 0, star: 0, rising: 0, emerging: 0, peer: 0 },
            withNotifications: 0,
            activeThisWeek: 0
        }
    );
}

/**
 * Get tier warnings (soft limits exceeded)
 */
export function useTierWarnings(): TierWarning[] {
    return useLiveQuery(
        () => getTierWarnings(),
        [],
        []
    );
}

/**
 * Get target count
 */
export function useTargetCount(): number {
    return useLiveQuery(
        () => db.targetAccounts.count(),
        [],
        0
    );
}

/**
 * Check if a handle is a target
 */
export function useIsTarget(handle: string): boolean {
    const normalizedHandle = handle.toLowerCase().replace(/^@/, '');

    const target = useLiveQuery(
        () => db.targetAccounts.get(normalizedHandle),
        [normalizedHandle]
    );

    return !!target;
}

// =============================================================================
// ACTIONS (for use in components)
// =============================================================================

/**
 * Target management actions
 * These are re-exported for convenience in components
 */
export const targetActions = {
    add: addTarget,
    remove: removeTarget,
    update: updateTarget
} as const;

/**
 * Hook that returns both data and actions
 */
export function useTargetManager() {
    const targets = useTargetsGroupedByTier();
    const stats = useTargetStats();
    const warnings = useTierWarnings();

    return {
        targets,
        stats,
        warnings,
        actions: {
            add: async (options: AddTargetOptions) => {
                return addTarget(options);
            },
            remove: async (handle: string) => {
                return removeTarget(handle);
            },
            update: async (handle: string, updates: Partial<TargetAccount>) => {
                return updateTarget(handle, updates);
            }
        }
    };
}
