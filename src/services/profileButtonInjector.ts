/**
 * Profile Button Injector
 *
 * Injects an "Add to Amendoa" button on Twitter profile pages.
 * Allows one-click target addition while browsing.
 */

import { db, inferTier, normalizeHandle } from '../db/index';
import { addTarget, getTarget } from './targetManager';

// =============================================================================
// TYPES
// =============================================================================

interface ProfileData {
    handle: string;
    displayName: string;
    followerCount: number;
    followingCount: number;
    isPremium: boolean;
}

// =============================================================================
// PROFILE BUTTON INJECTOR
// =============================================================================

class ProfileButtonInjector {
    private observer: MutationObserver | null = null;
    private currentPath: string = '';
    private isEnabled: boolean = true;
    private debounceTimer: number | null = null;

    constructor() {
        this.init();
    }

    private init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.startObserving());
        } else {
            this.startObserving();
        }
    }

    private injectStyles() {
        if (document.getElementById('amendoa-profile-btn-styles')) return;

        const style = document.createElement('style');
        style.id = 'amendoa-profile-btn-styles';
        style.textContent = `
            .amendoa-profile-btn-container {
                padding: 12px 16px 0 16px;
                text-align: left;
            }

            .amendoa-profile-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 32px;
                padding: 0 12px;
                border-radius: 6px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                outline: none;
                white-space: nowrap;
            }

            .amendoa-profile-btn--add {
                background: #1a1a1a;
                color: #f59e0b;
                border: 1px solid #f59e0b;
            }

            .amendoa-profile-btn--add:hover {
                background: #2a2a2a;
            }

            .amendoa-profile-btn--added {
                background: #1a1a1a;
                color: #22c55e;
                border: 1px solid #22c55e;
            }

            .amendoa-profile-btn--added:hover {
                background: #2a2a2a;
            }

            .amendoa-profile-btn--loading {
                opacity: 0.6;
                pointer-events: none;
            }

            .amendoa-tier-dropdown {
                position: fixed;
                background: rgb(0, 0, 0);
                border: 1px solid rgb(47, 51, 54);
                border-radius: 12px;
                box-shadow: rgba(255, 255, 255, 0.2) 0px 0px 15px, rgba(255, 255, 255, 0.15) 0px 0px 3px 1px;
                z-index: 10001;
                min-width: 180px;
                overflow: hidden;
                padding: 8px 0;
            }

            .amendoa-tier-option {
                display: flex;
                align-items: center;
                gap: 12px;
                width: 100%;
                padding: 14px 16px;
                text-align: left;
                font-family: "TwitterChirp", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 15px;
                font-weight: 400;
                color: rgb(231, 233, 234);
                background: transparent;
                border: none;
                cursor: pointer;
                transition: background 0.2s;
            }

            .amendoa-tier-option:hover {
                background: rgba(239, 243, 244, 0.1);
            }

            .amendoa-tier-option svg {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
            }

            .amendoa-tier-option--suggested {
                background: rgba(29, 155, 240, 0.1);
            }

            .amendoa-tier-option--suggested:hover {
                background: rgba(29, 155, 240, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    private startObserving() {
        console.log('[Amendoa v2] ProfileButtonInjector: Starting...');
        this.injectStyles();

        // Watch for URL changes (SPA navigation)
        this.currentPath = window.location.pathname;

        // Check immediately
        this.checkAndInject();

        // Observe DOM changes with debounce
        this.observer = new MutationObserver(() => {
            // Check if URL changed
            if (window.location.pathname !== this.currentPath) {
                this.currentPath = window.location.pathname;
            }

            // Debounce to avoid multiple rapid calls
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = window.setTimeout(() => {
                this.checkAndInject();
            }, 100);
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    private isProfilePage(): boolean {
        const path = window.location.pathname;
        // Profile page: /username (not /username/status/xxx, /settings, etc.)
        // Exclude known non-profile paths
        const nonProfilePaths = [
            '/home', '/explore', '/notifications', '/messages', '/settings',
            '/i/', '/search', '/compose', '/intent', '/login', '/logout'
        ];

        if (nonProfilePaths.some(p => path.startsWith(p))) {
            return false;
        }

        // Check if it's /@username or /username format without subpaths
        // Allow /username/followers, /username/following but not /username/status/123
        const match = path.match(/^\/([a-zA-Z0-9_]{1,15})(\/(?:followers|following|verified_followers|likes|lists)?)?$/);
        return !!match;
    }

    private extractHandleFromURL(): string | null {
        const path = window.location.pathname;
        const match = path.match(/^\/([a-zA-Z0-9_]{1,15})/);
        return match ? match[1] : null;
    }

    private extractProfileData(): ProfileData | null {
        const handle = this.extractHandleFromURL();
        if (!handle) return null;

        // Find the profile header area
        const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
        if (!primaryColumn) return null;

        // Get display name from the profile
        let displayName = handle;
        const nameElement = primaryColumn.querySelector('[data-testid="UserName"]');
        if (nameElement) {
            const nameSpan = nameElement.querySelector('span');
            if (nameSpan) {
                displayName = nameSpan.textContent || handle;
            }
        }

        // Get follower count
        let followerCount = 0;
        let followingCount = 0;

        // Look for follower/following links
        const links = primaryColumn.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
        for (const link of links) {
            const href = (link as HTMLAnchorElement).href;
            const text = link.textContent || '';

            // Parse count from text like "123K Followers" or "1.2M Following"
            const countMatch = text.match(/([\d,.]+)([KMB]?)/i);
            if (countMatch) {
                let count = parseFloat(countMatch[1].replace(/,/g, ''));
                const suffix = countMatch[2].toUpperCase();
                if (suffix === 'K') count *= 1000;
                else if (suffix === 'M') count *= 1000000;
                else if (suffix === 'B') count *= 1000000000;

                if (href.includes('/followers')) {
                    followerCount = Math.round(count);
                } else if (href.includes('/following')) {
                    followingCount = Math.round(count);
                }
            }
        }

        // Check for premium/verified badge
        let isPremium = false;
        const verifiedBadge = primaryColumn.querySelector('[data-testid="icon-verified"]');
        if (verifiedBadge) {
            isPremium = true;
        }

        return {
            handle,
            displayName,
            followerCount,
            followingCount,
            isPremium
        };
    }

    private async checkAndInject() {
        if (!this.isEnabled) return;
        if (!this.isProfilePage()) {
            return;
        }

        const handle = this.extractHandleFromURL();
        if (!handle) return;

        // Check if we already have a button for this handle
        const existingBtn = document.querySelector(`.amendoa-profile-btn[data-amendoa-handle="${handle}"]`);
        if (existingBtn) {
            return;
        }

        // Clean up any stale buttons from other profiles
        document.querySelectorAll('.amendoa-profile-btn-container').forEach(el => el.remove());

        const profileData = this.extractProfileData();
        if (!profileData) return;

        // Check if already a target
        const isTarget = await this.checkIsTarget(profileData.handle);

        // Create button
        const button = this.createButton(profileData, isTarget);
        button.setAttribute('data-amendoa-handle', handle);

        // Find the bio/description area and place button after it
        const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
        if (!primaryColumn) return;

        // Look for the user description or the area after the profile header
        const userDescription = primaryColumn.querySelector('[data-testid="UserDescription"]');
        const userCell = primaryColumn.querySelector('[data-testid="UserProfileHeader_Items"]');

        // Create a container for our button that sits nicely in the profile
        const container = document.createElement('div');
        container.className = 'amendoa-profile-btn-container';
        container.appendChild(button);

        if (userDescription) {
            // Insert after the bio
            userDescription.parentNode?.insertBefore(container, userDescription.nextSibling);
        } else if (userCell) {
            // Insert after the profile header items (location, link, join date)
            userCell.parentNode?.insertBefore(container, userCell.nextSibling);
        } else {
            // Fallback: don't inject if we can't find a good spot
            return;
        }

        console.log(`[Amendoa v2] ProfileButtonInjector: Injected button for @${profileData.handle}`);
    }

    private async checkIsTarget(handle: string): Promise<boolean> {
        const normalized = normalizeHandle(handle);
        const target = await getTarget(normalized);
        return !!target;
    }

    private createButton(profileData: ProfileData, isTarget: boolean): HTMLElement {
        const button = document.createElement('button');
        button.className = `amendoa-profile-btn ${isTarget ? 'amendoa-profile-btn--added' : 'amendoa-profile-btn--add'}`;
        button.setAttribute('data-amendoa-handle', profileData.handle);

        this.updateButtonContent(button, isTarget);

        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.handleButtonClick(button, profileData);
        });

        return button;
    }

    private updateButtonContent(button: HTMLElement, isTarget: boolean) {
        if (isTarget) {
            button.textContent = 'Tracking ✓';
            button.className = 'amendoa-profile-btn amendoa-profile-btn--added';
        } else {
            button.textContent = 'Track in Amendoa';
            button.className = 'amendoa-profile-btn amendoa-profile-btn--add';
        }
    }

    private async handleButtonClick(button: HTMLElement, profileData: ProfileData) {
        const isCurrentlyTarget = button.classList.contains('amendoa-profile-btn--added');

        if (isCurrentlyTarget) {
            // Remove from targets
            button.classList.add('amendoa-profile-btn--loading');
            try {
                await db.targetAccounts.delete(normalizeHandle(profileData.handle));
                this.updateButtonContent(button, false);
                console.log(`[Amendoa v2] Removed target: @${profileData.handle}`);
            } catch (err) {
                console.error('[Amendoa v2] Failed to remove target:', err);
            } finally {
                button.classList.remove('amendoa-profile-btn--loading');
            }
        } else {
            // Show tier dropdown
            this.showTierDropdown(button, profileData);
        }
    }

    private showTierDropdown(button: HTMLElement, profileData: ProfileData) {
        // Remove any existing dropdown
        const existing = document.querySelector('.amendoa-tier-dropdown');
        if (existing) {
            existing.remove();
            return;
        }

        const suggestedTier = inferTier(profileData.followerCount);

        const dropdown = document.createElement('div');
        dropdown.className = 'amendoa-tier-dropdown';

        // SVG icons matching Lucide icons from sidebar
        const tierIcons: Record<string, string> = {
            titan: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>',
            star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
            rising: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
            emerging: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
            peer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
        };

        const tiers: Array<{ id: string; label: string }> = [
            { id: 'titan', label: 'Titan' },
            { id: 'star', label: 'Star' },
            { id: 'rising', label: 'Rising' },
            { id: 'emerging', label: 'Emerging' },
            { id: 'peer', label: 'Peer' }
        ];

        for (const tier of tiers) {
            const option = document.createElement('button');
            option.className = `amendoa-tier-option${tier.id === suggestedTier ? ' amendoa-tier-option--suggested' : ''}`;
            option.innerHTML = `${tierIcons[tier.id]}<span>${tier.label}</span>`;
            option.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
                await this.addTargetWithTier(button, profileData, tier.id as any);
            });
            dropdown.appendChild(option);
        }

        // Append to body for proper fixed positioning
        document.body.appendChild(dropdown);

        // Position dropdown below the button
        const buttonRect = button.getBoundingClientRect();
        dropdown.style.top = `${buttonRect.bottom + 8}px`;
        dropdown.style.left = `${buttonRect.left}px`;

        // Ensure dropdown doesn't go off-screen to the right
        const dropdownRect = dropdown.getBoundingClientRect();
        if (dropdownRect.right > window.innerWidth - 16) {
            dropdown.style.left = `${buttonRect.right - dropdownRect.width}px`;
        }

        // Close dropdown when clicking outside
        const closeDropdown = (e: MouseEvent) => {
            if (!dropdown.contains(e.target as Node) && !button.contains(e.target as Node)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    }

    private async addTargetWithTier(button: HTMLElement, profileData: ProfileData, tier: 'titan' | 'star' | 'rising' | 'emerging' | 'peer') {
        button.classList.add('amendoa-profile-btn--loading');
        try {
            await addTarget({
                handle: profileData.handle,
                displayName: profileData.displayName,
                followerCount: profileData.followerCount,
                followingCount: profileData.followingCount,
                isPremium: profileData.isPremium,
                tier
            });
            this.updateButtonContent(button, true);
            console.log(`[Amendoa v2] Added target: @${profileData.handle} (${tier})`);

            window.dispatchEvent(new CustomEvent('AMENDOA_TARGET_ADDED', {
                detail: { handle: profileData.handle }
            }));
        } catch (err) {
            console.error('[Amendoa v2] Failed to add target:', err);
            button.textContent = 'Error';
            setTimeout(() => {
                this.updateButtonContent(button, false);
            }, 2000);
        } finally {
            button.classList.remove('amendoa-profile-btn--loading');
        }
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    public enable() {
        this.isEnabled = true;
        this.checkAndInject();
    }

    public disable() {
        this.isEnabled = false;
        document.querySelectorAll('.amendoa-profile-btn-container').forEach(el => el.remove());
    }

    public destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        document.querySelectorAll('.amendoa-profile-btn-container').forEach(el => el.remove());
    }
}

// Export singleton instance
export const profileButtonInjector = new ProfileButtonInjector();
