/**
 * Badge Injector Service
 *
 * Injects opportunity score badges inline after tweet timestamps.
 * Design: Fighter jet HUD style - data in the natural scan path.
 *
 * Badge format: @handle · 3m · 🔥92
 */

import { db, type ScoreBadge } from '../db';
import { getBadgeIcon, getBadgeClass } from './scoreEngine';

// =============================================================================
// TYPES
// =============================================================================

interface BadgeData {
    score: number;
    badge: ScoreBadge;
    tweetId: string;
}

// =============================================================================
// BADGE INJECTOR CLASS
// =============================================================================

export class BadgeInjector {
    private observer: MutationObserver | null = null;
    private processedTweets = new Set<string>();
    private isEnabled = true;
    private minimumScore = 20; // Only show badges for scores >= this

    constructor() {
        this.init();

        // Listen for batch of tweets being processed - re-scan to badge new ones
        window.addEventListener('AMENDOA_TWEETS_PROCESSED', (() => {
            // Clear processed set so we re-check all visible tweets
            // (some may now be in cache that weren't before)
            this.processedTweets.clear();
            this.processTweets();
        }) as EventListener);
    }

    private init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.startObserving());
        } else {
            this.startObserving();
        }
    }

    private injectStyles() {
        // Check if already injected
        if (document.getElementById('amendoa-badge-styles')) return;

        const style = document.createElement('style');
        style.id = 'amendoa-badge-styles';
        style.textContent = `
            @keyframes amendoa-pulse {
                0%, 100% {
                    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5), 0 1px 3px rgba(0,0,0,0.2);
                    transform: scale(1);
                }
                50% {
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2), 0 1px 3px rgba(0,0,0,0.2);
                    transform: scale(1.02);
                }
            }

            .amendoa-badge {
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }

            .amendoa-badge:hover {
                transform: scale(1.08) !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important;
            }
        `;
        document.head.appendChild(style);
    }

    private startObserving() {
        console.log('[Amendoa] BadgeInjector: Starting observation...');

        // Inject CSS animation for hot badges
        this.injectStyles();

        this.observer = new MutationObserver((mutations) => {
            let hasNewNodes = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    hasNewNodes = true;
                    break;
                }
            }
            if (hasNewNodes) {
                // Debounce processing
                requestAnimationFrame(() => this.processTweets());
            }
        });

        const timeline = document.querySelector('[data-testid="primaryColumn"]');
        if (timeline) {
            console.log('[Amendoa] BadgeInjector: Found primaryColumn, observing...');
            this.observer.observe(timeline, {
                childList: true,
                subtree: true
            });
            this.processTweets();
        } else {
            console.log('[Amendoa] BadgeInjector: primaryColumn not found, retrying in 1s...');
            setTimeout(() => this.startObserving(), 1000);
        }
    }

    private async processTweets() {
        if (!this.isEnabled) return;

        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        console.log(`[Amendoa] BadgeInjector: Found ${tweets.length} tweet elements on page`);

        let foundInCache = 0;
        let injectedCount = 0;

        for (const tweet of tweets) {
            const tweetElement = tweet as HTMLElement;
            const tweetId = this.extractTweetId(tweetElement);

            if (!tweetId) continue;
            if (this.processedTweets.has(tweetId)) continue;

            // Mark as processed
            this.processedTweets.add(tweetId);

            // Get score from DB
            const cached = await db.tweetCache.get(tweetId);
            if (!cached) {
                // Log first few misses for debugging
                if (this.processedTweets.size <= 5) {
                    console.log(`[Amendoa] BadgeInjector: Tweet ${tweetId} not in cache`);
                }
                continue;
            }

            foundInCache++;

            if (cached.opportunityScore < this.minimumScore) {
                console.log(`[Amendoa] BadgeInjector: Tweet ${tweetId} score ${cached.opportunityScore} below threshold ${this.minimumScore}`);
                continue;
            }

            // Inject badge
            this.injectBadge(tweetElement, {
                score: cached.opportunityScore,
                badge: cached.scoreBadge,
                tweetId
            });
            injectedCount++;
            console.log(`[Amendoa] BadgeInjector: Injected badge for tweet ${tweetId} (score: ${cached.opportunityScore})`);
        }

        if (foundInCache > 0 || injectedCount > 0) {
            console.log(`[Amendoa] BadgeInjector: ${foundInCache} in cache, ${injectedCount} badges injected`);
        }
    }

    private extractTweetId(tweetElement: HTMLElement): string | null {
        const links = tweetElement.querySelectorAll('a[href*="/status/"]');
        for (const link of links) {
            const href = (link as HTMLAnchorElement).href;
            const match = href.match(/\/status\/(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    private injectBadge(tweetElement: HTMLElement, data: BadgeData) {
        // Check if badge already exists
        if (tweetElement.querySelector('.amendoa-badge')) return;

        // Find the timestamp element - it's usually a <time> element inside an anchor
        const timeElement = tweetElement.querySelector('time');
        if (!timeElement) return;

        // Find the parent anchor of the time element
        const timeAnchor = timeElement.closest('a');
        if (!timeAnchor) return;

        // Create the badge element
        const badge = this.createBadgeElement(data);

        // Insert after the timestamp anchor
        // We need to add a separator and the badge
        const separator = document.createElement('span');
        separator.className = 'amendoa-separator';
        separator.textContent = ' · ';
        separator.style.cssText = 'color: rgb(113, 118, 123); font-size: 15px;';

        // Insert after the time anchor
        const parent = timeAnchor.parentElement;
        if (parent) {
            // Check if we already have a separator (avoid duplicates on re-process)
            const existingSep = parent.querySelector('.amendoa-separator');
            if (existingSep) return;

            timeAnchor.after(separator, badge);
        }
    }

    private createBadgeElement(data: BadgeData): HTMLElement {
        const badge = document.createElement('span');
        badge.className = `amendoa-badge ${getBadgeClass(data.badge)}`;
        badge.setAttribute('data-tweet-id', data.tweetId);
        badge.setAttribute('title', `Opportunity Score: ${data.score}`);

        const icon = getBadgeIcon(data.badge);
        const scoreStr = data.score.toString();

        badge.innerHTML = `<span class="amendoa-badge__icon">${icon}</span><span class="amendoa-badge__score">${scoreStr}</span>`;

        // Inline styles for the badge (fighter jet HUD aesthetic - PROMINENT)
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 6px;
            cursor: default;
            vertical-align: middle;
            margin-left: 4px;
            letter-spacing: 0.5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            ${this.getBadgeColorStyles(data.badge)}
        `;

        return badge;
    }

    private getBadgeColorStyles(badge: ScoreBadge): string {
        switch (badge) {
            case 'hot':
                // 🔥 Hot (80+) - Red/orange glow, impossible to miss
                return `
                    background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
                    border: 2px solid #fbbf24;
                    color: #ffffff;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                    animation: amendoa-pulse 1.5s ease-in-out infinite;
                `;
            case 'high':
                // ⚡ High (60-79) - Amber/gold, urgent
                return `
                    background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%);
                    border: 2px solid #fcd34d;
                    color: #1c1917;
                    text-shadow: 0 1px 1px rgba(255,255,255,0.2);
                `;
            case 'good':
                // ✓ Good (40-59) - Green, solid opportunity
                return `
                    background: linear-gradient(135deg, #22c55e 0%, #10b981 100%);
                    border: 2px solid #4ade80;
                    color: #ffffff;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                `;
            case 'meh':
                // ~ Meh (20-39) - Blue/gray, low priority
                return `
                    background: rgba(100, 116, 139, 0.25);
                    border: 1px solid rgba(148, 163, 184, 0.5);
                    color: #94a3b8;
                `;
            case 'skip':
            default:
                // ✗ Skip (<20) - Gray, not worth it
                return `
                    background: rgba(75, 85, 99, 0.2);
                    border: 1px solid rgba(107, 114, 128, 0.3);
                    color: #6b7280;
                `;
        }
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Enable or disable badge injection
     */
    public setEnabled(enabled: boolean) {
        this.isEnabled = enabled;

        if (!enabled) {
            // Remove all existing badges
            this.removeAllBadges();
        } else {
            // Re-process tweets
            this.processedTweets.clear();
            this.processTweets();
        }
    }

    /**
     * Set minimum score threshold for showing badges
     */
    public setMinimumScore(score: number) {
        this.minimumScore = score;
        // Re-process with new threshold
        this.processedTweets.clear();
        this.removeAllBadges();
        this.processTweets();
    }

    /**
     * Force refresh all badges
     */
    public refresh() {
        this.processedTweets.clear();
        this.removeAllBadges();
        this.processTweets();
    }

    /**
     * Remove all badges from DOM
     */
    private removeAllBadges() {
        const badges = document.querySelectorAll('.amendoa-badge');
        const separators = document.querySelectorAll('.amendoa-separator');

        badges.forEach(el => el.remove());
        separators.forEach(el => el.remove());
    }

    /**
     * Scroll to and highlight a specific tweet
     * Returns true if found on page, false if had to open in new tab
     */
    public scrollToTweet(tweetId: string, authorHandle?: string): boolean {
        const links = document.querySelectorAll(`a[href*="/status/${tweetId}"]`);
        for (const link of links) {
            const article = (link as HTMLElement).closest('article[data-testid="tweet"]');
            if (article) {
                // Scroll into view
                article.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Add temporary highlight
                const originalBg = (article as HTMLElement).style.backgroundColor;
                (article as HTMLElement).style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
                (article as HTMLElement).style.transition = 'background-color 0.3s ease';
                (article as HTMLElement).style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.4)';

                setTimeout(() => {
                    (article as HTMLElement).style.backgroundColor = originalBg;
                    (article as HTMLElement).style.boxShadow = '';
                }, 2500);

                return true;
            }
        }

        // Tweet not found on page - navigate in same tab
        // This keeps user in their workflow without tab clutter
        if (authorHandle) {
            window.location.href = `https://twitter.com/${authorHandle}/status/${tweetId}`;
        } else {
            // Try to get handle from cache
            db.tweetCache.get(tweetId).then(cached => {
                if (cached) {
                    window.location.href = `https://twitter.com/${cached.authorHandle}/status/${tweetId}`;
                } else {
                    // Last resort - use twitter's /i/status route which works without handle
                    window.location.href = `https://twitter.com/i/status/${tweetId}`;
                }
            });
        }
        return false;
    }

    /**
     * Clean up observer
     */
    public destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.removeAllBadges();
        this.processedTweets.clear();
    }
}

// Export singleton instance
export const badgeInjector = new BadgeInjector();
