/**
 * Target Manager
 *
 * CRUD operations for managing target accounts.
 * Handles adding, removing, updating, and querying targets.
 */

import {
    db,
    type TargetAccount,
    type Tier,
    type RelationshipStatus,
    normalizeHandle,
    inferTier
} from '../db';

// =============================================================================
// TYPES
// =============================================================================

export interface AddTargetOptions {
    handle: string;
    displayName?: string;
    followerCount?: number;
    followingCount?: number;
    isPremium?: boolean;
    tier?: Tier;
    relationshipStatus?: RelationshipStatus;
    notes?: string;
    notificationsEnabled?: boolean;
}

export interface TargetStats {
    total: number;
    byTier: Record<Tier, number>;
    withNotifications: number;
    activeThisWeek: number;
}

export interface TierWarning {
    tier: Tier;
    count: number;
    recommended: number;
    message: string;
}

// Recommended tier limits (soft warnings, not enforced)
const RECOMMENDED_LIMITS: Record<Tier, number> = {
    titan: 10,
    star: 10,
    rising: 15,
    emerging: 20,
    peer: 25
};

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Add a new target account
 */
export async function addTarget(options: AddTargetOptions): Promise<TargetAccount> {
    const handle = normalizeHandle(options.handle);

    // Check if already exists
    const existing = await db.targetAccounts.get(handle);
    if (existing) {
        throw new Error(`Target @${handle} already exists`);
    }

    // Validate handle format
    if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
        throw new Error(`Invalid handle format: @${handle}`);
    }

    // Infer tier from follower count if not provided
    const tier = options.tier || (options.followerCount ? inferTier(options.followerCount) : 'peer');

    const target: TargetAccount = {
        handle,
        displayName: options.displayName || handle,
        followerCount: options.followerCount || 0,
        followingCount: options.followingCount || 0,
        isPremium: options.isPremium || false,
        tier,
        relationshipStatus: options.relationshipStatus || 'none',
        lastInteraction: null,
        interactionCount: 0,
        ourEngagementCount: 0,
        replyBackRate: 0,
        addedAt: Date.now(),
        notes: options.notes || '',
        notificationsEnabled: options.notificationsEnabled || false
    };

    await db.targetAccounts.add(target);

    console.log(`[Amendoa] Added target: @${handle} (${tier})`);
    return target;
}

/**
 * Remove a target account
 */
export async function removeTarget(handle: string): Promise<void> {
    const normalizedHandle = normalizeHandle(handle);
    await db.targetAccounts.delete(normalizedHandle);
    console.log(`[Amendoa] Removed target: @${normalizedHandle}`);
}

/**
 * Update a target account
 */
export async function updateTarget(
    handle: string,
    updates: Partial<Omit<TargetAccount, 'handle' | 'addedAt'>>
): Promise<TargetAccount | null> {
    const normalizedHandle = normalizeHandle(handle);

    await db.targetAccounts.update(normalizedHandle, updates);

    const result = await db.targetAccounts.get(normalizedHandle);
    return result || null;
}

/**
 * Get a single target by handle
 */
export async function getTarget(handle: string): Promise<TargetAccount | null> {
    const normalizedHandle = normalizeHandle(handle);
    return (await db.targetAccounts.get(normalizedHandle)) || null;
}

/**
 * Get all targets
 */
export async function getAllTargets(): Promise<TargetAccount[]> {
    return db.targetAccounts.toArray();
}

/**
 * Get targets by tier
 */
export async function getTargetsByTier(tier: Tier): Promise<TargetAccount[]> {
    return db.targetAccounts.where('tier').equals(tier).toArray();
}

/**
 * Get all targets grouped by tier
 */
export async function getTargetsGroupedByTier(): Promise<Record<Tier, TargetAccount[]>> {
    const all = await getAllTargets();

    const grouped: Record<Tier, TargetAccount[]> = {
        titan: [],
        star: [],
        rising: [],
        emerging: [],
        peer: []
    };

    for (const target of all) {
        grouped[target.tier].push(target);
    }

    // Sort each tier by follower count (descending)
    for (const tier of Object.keys(grouped) as Tier[]) {
        grouped[tier].sort((a, b) => b.followerCount - a.followerCount);
    }

    return grouped;
}

/**
 * Check if a handle is a target
 */
export async function isTarget(handle: string): Promise<boolean> {
    const normalizedHandle = normalizeHandle(handle);
    const target = await db.targetAccounts.get(normalizedHandle);
    return !!target;
}

/**
 * Get target handles as a Set (for fast lookup)
 */
export async function getTargetHandleSet(): Promise<Set<string>> {
    const targets = await db.targetAccounts.toCollection().primaryKeys();
    return new Set(targets);
}

// =============================================================================
// INTERACTION TRACKING
// =============================================================================

/**
 * Record that we engaged with a target (sent a reply)
 */
export async function recordOurEngagement(handle: string): Promise<void> {
    const normalizedHandle = normalizeHandle(handle);
    const target = await db.targetAccounts.get(normalizedHandle);

    if (target) {
        await db.targetAccounts.update(normalizedHandle, {
            ourEngagementCount: target.ourEngagementCount + 1
        });
    }
}

/**
 * Record that a target engaged with us (they replied)
 */
export async function recordTheirEngagement(handle: string): Promise<void> {
    const normalizedHandle = normalizeHandle(handle);
    const target = await db.targetAccounts.get(normalizedHandle);

    if (target) {
        const newInteractionCount = target.interactionCount + 1;

        // Recalculate reply-back rate
        // replyBackRate = (theirEngagements / ourEngagements) * 100
        const replyBackRate = target.ourEngagementCount > 0
            ? Math.round((newInteractionCount / target.ourEngagementCount) * 100)
            : 0;

        await db.targetAccounts.update(normalizedHandle, {
            interactionCount: newInteractionCount,
            lastInteraction: Date.now(),
            replyBackRate: Math.min(replyBackRate, 100) // Cap at 100%
        });
    }
}

/**
 * Update relationship status for a target
 */
export async function updateRelationshipStatus(
    handle: string,
    status: RelationshipStatus
): Promise<void> {
    const normalizedHandle = normalizeHandle(handle);
    await db.targetAccounts.update(normalizedHandle, {
        relationshipStatus: status
    });
}

/**
 * Update target's profile info (from API intercept)
 */
export async function updateTargetProfile(
    handle: string,
    profile: {
        displayName?: string;
        followerCount?: number;
        followingCount?: number;
        isPremium?: boolean;
    }
): Promise<void> {
    const normalizedHandle = normalizeHandle(handle);
    const target = await db.targetAccounts.get(normalizedHandle);

    if (target) {
        const updates: Partial<TargetAccount> = {};

        if (profile.displayName !== undefined) {
            updates.displayName = profile.displayName;
        }
        if (profile.followerCount !== undefined) {
            updates.followerCount = profile.followerCount;
            // Optionally re-infer tier if follower count changed significantly
            // (commented out to respect user's manual tier assignment)
            // updates.tier = inferTier(profile.followerCount);
        }
        if (profile.followingCount !== undefined) {
            updates.followingCount = profile.followingCount;
        }
        if (profile.isPremium !== undefined) {
            updates.isPremium = profile.isPremium;
        }

        if (Object.keys(updates).length > 0) {
            await db.targetAccounts.update(normalizedHandle, updates);
        }
    }
}

// =============================================================================
// STATISTICS & WARNINGS
// =============================================================================

/**
 * Get target statistics
 */
export async function getTargetStats(): Promise<TargetStats> {
    const all = await getAllTargets();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const byTier: Record<Tier, number> = {
        titan: 0,
        star: 0,
        rising: 0,
        emerging: 0,
        peer: 0
    };

    let withNotifications = 0;
    let activeThisWeek = 0;

    for (const target of all) {
        byTier[target.tier]++;

        if (target.notificationsEnabled) {
            withNotifications++;
        }

        if (target.lastInteraction && target.lastInteraction >= oneWeekAgo) {
            activeThisWeek++;
        }
    }

    return {
        total: all.length,
        byTier,
        withNotifications,
        activeThisWeek
    };
}

/**
 * Get soft warnings for tier counts
 * Returns warnings for tiers that exceed recommended limits
 */
export async function getTierWarnings(): Promise<TierWarning[]> {
    const stats = await getTargetStats();
    const warnings: TierWarning[] = [];

    for (const [tier, count] of Object.entries(stats.byTier) as [Tier, number][]) {
        const recommended = RECOMMENDED_LIMITS[tier];
        if (count > recommended) {
            warnings.push({
                tier,
                count,
                recommended,
                message: `You have ${count} ${tier}s — most users find ${recommended} optimal for focused engagement`
            });
        }
    }

    return warnings;
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Add multiple targets at once
 */
export async function addTargetsBulk(targets: AddTargetOptions[]): Promise<{
    added: string[];
    skipped: string[];
    errors: { handle: string; error: string }[];
}> {
    const added: string[] = [];
    const skipped: string[] = [];
    const errors: { handle: string; error: string }[] = [];

    for (const target of targets) {
        try {
            const normalizedHandle = normalizeHandle(target.handle);
            const existing = await db.targetAccounts.get(normalizedHandle);

            if (existing) {
                skipped.push(normalizedHandle);
            } else {
                await addTarget(target);
                added.push(normalizedHandle);
            }
        } catch (err) {
            errors.push({
                handle: target.handle,
                error: err instanceof Error ? err.message : 'Unknown error'
            });
        }
    }

    return { added, skipped, errors };
}

/**
 * Export all targets as JSON
 */
export async function exportTargets(): Promise<string> {
    const targets = await getAllTargets();
    return JSON.stringify(targets, null, 2);
}

/**
 * Import targets from JSON
 */
export async function importTargets(json: string): Promise<{
    imported: number;
    skipped: number;
    errors: number;
}> {
    const data = JSON.parse(json) as TargetAccount[];
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const target of data) {
        try {
            const existing = await db.targetAccounts.get(target.handle);
            if (existing) {
                skipped++;
            } else {
                await db.targetAccounts.add(target);
                imported++;
            }
        } catch {
            errors++;
        }
    }

    return { imported, skipped, errors };
}

/**
 * Clear all targets
 */
export async function clearAllTargets(): Promise<number> {
    const count = await db.targetAccounts.count();
    await db.targetAccounts.clear();
    console.log(`[Amendoa] Cleared ${count} targets`);
    return count;
}
