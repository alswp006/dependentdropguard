import { describe, it, expect } from 'vitest';
import {
  formatWon,
  formatMonthLabel,
  formatYearMonth,
  toMonthKey,
  prevMonthKey,
  isValidMonthKey,
  selectableMonths,
  formatAmountInput,
  parseAmountInput,
} from '@/utils/format';

describe('formatWon', () => {
  it('formats a positive amount with comma and 원 suffix', () => {
    expect(formatWon(20400000)).toBe('20,400,000원');
  });

  it('formats zero', () => {
    expect(formatWon(0)).toBe('0원');
  });

  it('formats negative amounts', () => {
    expect(formatWon(-1000)).toBe('-1,000원');
  });
});

describe('formatMonthLabel', () => {
  const now = new Date('2026-09-14T00:00:00+09:00');

  it('shows month only for the current year', () => {
    expect(formatMonthLabel('2026-08', now)).toBe('8월');
  });

  it('shows year and month for a past year', () => {
    expect(formatMonthLabel('2025-12', now)).toBe('2025년 12월');
  });

  it('shows month only for the current month', () => {
    expect(formatMonthLabel('2026-09', now)).toBe('9월');
  });
});

describe('formatYearMonth', () => {
  it('always shows year and month', () => {
    expect(formatYearMonth('2026-09')).toBe('2026년 9월');
  });
});

describe('toMonthKey / prevMonthKey', () => {
  it('toMonthKey formats a Date as YYYY-MM', () => {
    expect(toMonthKey(new Date('2026-09-14T00:00:00+09:00'))).toBe('2026-09');
  });

  it('prevMonthKey returns the previous month', () => {
    expect(prevMonthKey(new Date('2027-01-05T09:00:00+09:00'))).toBe('2026-12');
  });

  it('prevMonthKey handles the year boundary', () => {
    expect(prevMonthKey(new Date('2026-01-15T09:00:00+09:00'))).toBe('2025-12');
  });
});

describe('isValidMonthKey', () => {
  it('rejects an out-of-range month', () => {
    expect(isValidMonthKey('2026-13')).toBe(false);
  });

  it('accepts a valid month key', () => {
    expect(isValidMonthKey('2026-01')).toBe(true);
  });

  it('rejects month 00', () => {
    expect(isValidMonthKey('2026-00')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidMonthKey('202601')).toBe(false);
    expect(isValidMonthKey('26-01')).toBe(false);
  });
});

describe('selectableMonths', () => {
  it('returns 21 months descending from now', () => {
    const now = new Date('2026-09-14T00:00:00+09:00');
    const result = selectableMonths(now);
    expect(result).toHaveLength(21);
    expect(result[0]).toBe('2026-09');
    expect(result[20]).toBe('2025-01');
  });

  it('adjusts for a different now date', () => {
    const now = new Date('2026-01-15T00:00:00+09:00');
    const result = selectableMonths(now);
    expect(result[0]).toBe('2026-01');
    expect(result[20]).toBe('2024-05');
  });
});

describe('formatAmountInput / parseAmountInput', () => {
  it('strips non-digit characters', () => {
    expect(formatAmountInput('12a3')).toBe('123');
  });

  it('adds thousand separators', () => {
    expect(formatAmountInput('1000000')).toBe('1,000,000');
  });

  it('handles an empty string', () => {
    expect(formatAmountInput('')).toBe('');
  });

  it('parses a comma-separated amount', () => {
    expect(parseAmountInput('1,000')).toBe(1000);
  });

  it('returns null for an empty string', () => {
    expect(parseAmountInput('')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(parseAmountInput('abc')).toBeNull();
  });

  it('roundtrips format -> parse', () => {
    const original = 5000000;
    expect(parseAmountInput(formatAmountInput(original.toString()))).toBe(original);
  });
});
