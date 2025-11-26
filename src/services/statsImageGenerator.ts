/**
 * Stats Image Generator
 *
 * Generates shareable PNG images of user stats for Twitter sharing.
 * Uses Canvas API to create branded stat cards.
 */

import { type GamificationStatus, type WeeklyStats, getGamificationStatus, getWeeklyStats } from './gamification';

// =============================================================================
// TYPES
// =============================================================================

export interface StatsImageOptions {
    type: 'rank-up' | 'weekly' | 'milestone';
    previousTier?: string;
    previousRank?: string;
    newTier?: string;
    newRank?: string;
    milestoneType?: 'streak' | 'xp' | 'replies';
    milestoneValue?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 315; // Twitter card aspect ratio

const COLORS = {
    background: '#0d0d0d',
    backgroundGradient1: '#1a1a2e',
    backgroundGradient2: '#16213e',
    primary: '#f59e0b',
    secondary: '#fbbf24',
    text: '#ffffff',
    textMuted: '#9ca3af',
    streak: '#ef4444',
    xp: '#8b5cf6'
};

// =============================================================================
// CANVAS HELPERS
// =============================================================================

/**
 * Create a canvas element
 */
function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/**
 * Draw rounded rectangle
 */
function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Draw gradient background
 */
function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, COLORS.backgroundGradient1);
    gradient.addColorStop(1, COLORS.backgroundGradient2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add subtle pattern overlay
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.strokeStyle = COLORS.text;
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

/**
 * Draw Amendoa branding
 */
function drawBranding(ctx: CanvasRenderingContext2D, width: number): void {
    // Logo dot
    ctx.beginPath();
    ctx.arc(30, 30, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.primary;
    ctx.fill();

    // Logo text
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText('AMENDOA', 45, 35);

    // Watermark
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText('amendoa.app', width - 20, 30);
}

/**
 * Draw progress bar
 */
function drawProgressBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    progress: number,
    color: string
): void {
    // Background
    drawRoundedRect(ctx, x, y, width, height, height / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    // Progress
    const progressWidth = Math.max(height, width * (progress / 100));
    drawRoundedRect(ctx, x, y, progressWidth, height, height / 2);
    const gradient = ctx.createLinearGradient(x, y, x + progressWidth, y);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, COLORS.secondary);
    ctx.fillStyle = gradient;
    ctx.fill();
}

// =============================================================================
// IMAGE GENERATORS
// =============================================================================

/**
 * Generate rank-up celebration image
 */
async function generateRankUpImage(
    status: GamificationStatus,
    previousTier: string,
    previousRank: string
): Promise<Blob> {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d')!;

    // Background
    drawBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBranding(ctx, CANVAS_WIDTH);

    // "RANK UP!" header
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.primary;
    ctx.textAlign = 'center';
    ctx.fillText('RANK UP!', CANVAS_WIDTH / 2, 80);

    // New rank display
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.fillText(`${status.rankInfo.emoji} ${status.rankInfo.tier} ${status.rankInfo.rank}`, CANVAS_WIDTH / 2, 140);

    // Previous rank
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(`From ${previousTier} ${previousRank}`, CANVAS_WIDTH / 2, 170);

    // Stats row
    const statsY = 220;
    const statWidth = 150;
    const startX = (CANVAS_WIDTH - (statWidth * 3 + 40)) / 2;

    // Total XP
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.xp;
    ctx.textAlign = 'center';
    ctx.fillText(status.totalXP.toLocaleString(), startX + statWidth / 2, statsY);
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('TOTAL XP', startX + statWidth / 2, statsY + 20);

    // Streak
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.streak;
    ctx.fillText(`${status.currentStreak}`, startX + statWidth + 20 + statWidth / 2, statsY);
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('DAY STREAK', startX + statWidth + 20 + statWidth / 2, statsY + 20);

    // Multiplier
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(`${status.multiplier}x`, startX + (statWidth + 20) * 2 + statWidth / 2, statsY);
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('MULTIPLIER', startX + (statWidth + 20) * 2 + statWidth / 2, statsY + 20);

    // Progress to next rank
    drawProgressBar(
        ctx,
        100,
        CANVAS_HEIGHT - 50,
        CANVAS_WIDTH - 200,
        8,
        status.rankInfo.progressPercent,
        COLORS.xp
    );

    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(status.rankInfo.xpForNextRank - status.rankInfo.xpIntoRank).toLocaleString()} XP to next rank`, 100, CANVAS_HEIGHT - 30);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
}

/**
 * Generate weekly stats summary image
 */
async function generateWeeklyImage(
    status: GamificationStatus,
    weekly: WeeklyStats
): Promise<Blob> {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d')!;

    // Background
    drawBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBranding(ctx, CANVAS_WIDTH);

    // Header
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.primary;
    ctx.textAlign = 'center';
    ctx.fillText('WEEKLY STATS', CANVAS_WIDTH / 2, 70);

    // Date range
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(`${weekly.weekStart} → ${weekly.weekEnd}`, CANVAS_WIDTH / 2, 90);

    // Current rank
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${status.rankInfo.emoji} ${status.rankInfo.tier} ${status.rankInfo.rank}`, CANVAS_WIDTH / 2, 135);

    // Stats grid (2x2)
    const gridStartY = 165;
    const cellWidth = 130;
    const cellHeight = 50;
    const gridWidth = cellWidth * 2 + 20;
    const gridStartX = (CANVAS_WIDTH - gridWidth) / 2;

    // XP Earned
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.xp;
    ctx.textAlign = 'center';
    ctx.fillText(`+${weekly.totalXP.toLocaleString()}`, gridStartX + cellWidth / 2, gridStartY + 20);
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('XP EARNED', gridStartX + cellWidth / 2, gridStartY + 38);

    // Replies
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(weekly.totalReplies.toString(), gridStartX + cellWidth + 20 + cellWidth / 2, gridStartY + 20);
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('REPLIES', gridStartX + cellWidth + 20 + cellWidth / 2, gridStartY + 38);

    // Reply Backs
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#22c55e';
    ctx.fillText(weekly.totalReplyBacks.toString(), gridStartX + cellWidth / 2, gridStartY + cellHeight + 20);
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('REPLY BACKS', gridStartX + cellWidth / 2, gridStartY + cellHeight + 38);

    // Days Active
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.streak;
    ctx.fillText(`${weekly.daysActive}/7`, gridStartX + cellWidth + 20 + cellWidth / 2, gridStartY + cellHeight + 20);
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('DAYS ACTIVE', gridStartX + cellWidth + 20 + cellWidth / 2, gridStartY + cellHeight + 38);

    // Current streak at bottom
    if (status.currentStreak > 0) {
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = COLORS.streak;
        ctx.textAlign = 'center';
        ctx.fillText(`🔥 ${status.currentStreak} Day Streak (${status.multiplier}x bonus)`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
}

/**
 * Generate milestone celebration image
 */
async function generateMilestoneImage(
    status: GamificationStatus,
    milestoneType: 'streak' | 'xp' | 'replies',
    milestoneValue: number
): Promise<Blob> {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d')!;

    // Background
    drawBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBranding(ctx, CANVAS_WIDTH);

    // Milestone header
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.primary;
    ctx.textAlign = 'center';
    ctx.fillText('MILESTONE UNLOCKED!', CANVAS_WIDTH / 2, 80);

    // Milestone icon and value
    let icon: string;
    let label: string;
    let color: string;

    switch (milestoneType) {
        case 'streak':
            icon = '🔥';
            label = 'DAY STREAK';
            color = COLORS.streak;
            break;
        case 'xp':
            icon = '⚡';
            label = 'TOTAL XP';
            color = COLORS.xp;
            break;
        case 'replies':
            icon = '💬';
            label = 'REPLIES SENT';
            color = COLORS.primary;
            break;
    }

    ctx.font = '60px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(icon, CANVAS_WIDTH / 2, 150);

    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(milestoneValue.toLocaleString(), CANVAS_WIDTH / 2, 210);

    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(label, CANVAS_WIDTH / 2, 235);

    // Current rank
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${status.rankInfo.emoji} ${status.rankInfo.tier} ${status.rankInfo.rank}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate a stats image based on options
 */
export async function generateStatsImage(options: StatsImageOptions): Promise<Blob> {
    const status = await getGamificationStatus();

    switch (options.type) {
        case 'rank-up':
            return generateRankUpImage(
                status,
                options.previousTier || 'Lurker',
                options.previousRank || 'I'
            );

        case 'weekly':
            const weekly = await getWeeklyStats();
            return generateWeeklyImage(status, weekly);

        case 'milestone':
            return generateMilestoneImage(
                status,
                options.milestoneType || 'xp',
                options.milestoneValue || 0
            );

        default:
            throw new Error(`Unknown image type: ${options.type}`);
    }
}

/**
 * Generate image and copy to clipboard
 */
export async function generateAndCopyToClipboard(options: StatsImageOptions): Promise<boolean> {
    try {
        const blob = await generateStatsImage(options);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        return true;
    } catch (error) {
        console.error('[Amendoa] Failed to copy image to clipboard:', error);
        return false;
    }
}

/**
 * Generate image and trigger download
 */
export async function generateAndDownload(
    options: StatsImageOptions,
    filename: string = 'amendoa-stats.png'
): Promise<void> {
    const blob = await generateStatsImage(options);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Generate image and open share dialog (Twitter intent)
 */
export async function generateAndShare(
    options: StatsImageOptions,
    shareText: string = ''
): Promise<void> {
    // First copy image to clipboard
    const copied = await generateAndCopyToClipboard(options);

    // Open Twitter compose with pre-filled text
    const tweetText = shareText || getDefaultShareText(options);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    // Open in new tab
    window.open(twitterUrl, '_blank');

    if (copied) {
        // Alert user that image is in clipboard
        console.log('[Amendoa] Stats image copied to clipboard - paste it into your tweet!');
    }
}

/**
 * Get default share text based on image type
 */
function getDefaultShareText(options: StatsImageOptions): string {
    switch (options.type) {
        case 'rank-up':
            return `Just ranked up to ${options.newTier} ${options.newRank}! 🚀\n\nBuilding my network one reply at a time with @AmendoaApp`;

        case 'weekly':
            return `My engagement stats this week 📊\n\nTracking my growth with @AmendoaApp`;

        case 'milestone':
            if (options.milestoneType === 'streak') {
                return `🔥 ${options.milestoneValue} day streak!\n\nConsistency is key. Tracked with @AmendoaApp`;
            }
            if (options.milestoneType === 'xp') {
                return `Hit ${options.milestoneValue?.toLocaleString()} XP! ⚡\n\nGrowing my network with @AmendoaApp`;
            }
            return `Milestone unlocked! 🎯\n\nTracking my progress with @AmendoaApp`;

        default:
            return `Check out my stats from @AmendoaApp!`;
    }
}
