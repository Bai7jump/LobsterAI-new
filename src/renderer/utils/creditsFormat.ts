/**
 * Utilities for formatting credits-based quota display.
 */

/**
 * Format a credits number with locale-appropriate thousands separators.
 * e.g., 500000 → "500,000"
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString('en-US');
}

/**
 * Calculate quota usage percentage (0–100), clamped.
 */
export function quotaPercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

/**
 * Format a compact credits display for tight UI spaces.
 * e.g., 500000 → "50万", 1234567 → "123.5万"
 * For English: 500000 → "500K", 1234567 → "1.2M"
 */
export function formatCreditsCompact(credits: number, lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'zh') {
    if (credits >= 10000) {
      const wan = credits / 10000;
      return Number.isInteger(wan) ? `${wan}万` : `${Math.floor(wan * 10) / 10}万`;
    }
    return String(credits);
  }
  // English
  if (credits >= 1000000) {
    const m = credits / 1000000;
    return Number.isInteger(m) ? `${m}M` : `${Math.floor(m * 10) / 10}M`;
  }
  if (credits >= 1000) {
    const k = credits / 1000;
    return Number.isInteger(k) ? `${k}K` : `${Math.floor(k * 10) / 10}K`;
  }
  return String(credits);
}
