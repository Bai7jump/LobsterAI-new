import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Inline implementations mirroring src/renderer/utils/creditsFormat.ts
// (can't import TS directly in Node test runner)

function formatCredits(credits) {
  return credits.toLocaleString('en-US');
}

function quotaPercent(used, limit) {
  if (limit <= 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

function formatCreditsCompact(credits, lang = 'zh') {
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

// ==================== formatCredits ====================

describe('formatCredits', () => {
  it('should format zero', () => {
    assert.equal(formatCredits(0), '0');
  });

  it('should format small numbers without separators', () => {
    assert.equal(formatCredits(999), '999');
  });

  it('should add thousands separator', () => {
    assert.equal(formatCredits(1000), '1,000');
  });

  it('should format typical daily limit', () => {
    assert.equal(formatCredits(500000), '500,000');
  });

  it('should format large usage numbers', () => {
    assert.equal(formatCredits(123456), '123,456');
  });

  it('should format millions', () => {
    assert.equal(formatCredits(1234567), '1,234,567');
  });

  it('should handle negative numbers (edge case)', () => {
    assert.equal(formatCredits(-1234), '-1,234');
  });
});

// ==================== quotaPercent ====================

describe('quotaPercent', () => {
  it('should return 0 when nothing is used', () => {
    assert.equal(quotaPercent(0, 500000), 0);
  });

  it('should return 50 for half usage', () => {
    assert.equal(quotaPercent(250000, 500000), 50);
  });

  it('should return 100 when fully used', () => {
    assert.equal(quotaPercent(500000, 500000), 100);
  });

  it('should clamp to 100 when over limit', () => {
    assert.equal(quotaPercent(600000, 500000), 100);
  });

  it('should return 0 when limit is 0 (avoid division by zero)', () => {
    assert.equal(quotaPercent(0, 0), 0);
  });

  it('should return 0 when limit is 0 and used > 0', () => {
    assert.equal(quotaPercent(100, 0), 0);
  });

  it('should calculate fractional percentages correctly', () => {
    const pct = quotaPercent(123456, 500000);
    // 123456/500000 = 24.6912%
    assert.ok(Math.abs(pct - 24.69) < 0.01);
  });
});

// ==================== formatCreditsCompact ====================

describe('formatCreditsCompact', () => {
  it('should return plain number for small values in zh', () => {
    assert.equal(formatCreditsCompact(999, 'zh'), '999');
  });

  it('should format 10000 as 1万 in zh', () => {
    assert.equal(formatCreditsCompact(10000, 'zh'), '1万');
  });

  it('should format 500000 as 50万 in zh', () => {
    assert.equal(formatCreditsCompact(500000, 'zh'), '50万');
  });

  it('should format 123456 with decimal in zh', () => {
    // 123456 / 10000 = 12.3456 → "12.3万"
    assert.equal(formatCreditsCompact(123456, 'zh'), '12.3万');
  });

  it('should format 1000 as 1K in en', () => {
    assert.equal(formatCreditsCompact(1000, 'en'), '1K');
  });

  it('should format 500000 as 500K in en', () => {
    assert.equal(formatCreditsCompact(500000, 'en'), '500K');
  });

  it('should format 1234567 as 1.2M in en', () => {
    assert.equal(formatCreditsCompact(1234567, 'en'), '1.2M');
  });

  it('should return plain number for small values in en', () => {
    assert.equal(formatCreditsCompact(999, 'en'), '999');
  });
});
