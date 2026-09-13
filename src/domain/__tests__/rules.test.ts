import { describe, it, expect } from 'vitest';
import { RULES, STATUS_LABEL, REASON_TEXT, DISCLAIMER_TEXT, buildRuleDescriptions, JUDGMENT_RULES } from '@/domain/rules';
import { formatWon } from '@/utils/format';

describe('RULES', () => {
  it('has the agreed 2026 thresholds', () => {
    expect(RULES.totalIncomeLimit).toBe(20_000_000);
    expect(RULES.sideIncomeLimitUnregistered).toBe(5_000_000);
    expect(RULES.sideIncomeLimitRegistered).toBe(0);
    expect(RULES.warningRatioBp).toBe(8000);
    expect(RULES.healthRateBp).toBe(719);
    expect(RULES.ltcRatioBp).toBe(1314);
  });
});

describe('STATUS_LABEL', () => {
  it('has exactly SAFE/WARNING/DROP', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['DROP', 'SAFE', 'WARNING']);
    expect(STATUS_LABEL.SAFE).toBe('안전');
    expect(STATUS_LABEL.WARNING).toBe('주의');
    expect(STATUS_LABEL.DROP).toBe('탈락 위험');
  });
});

describe('REASON_TEXT', () => {
  it('describes TOTAL_INCOME', () => {
    expect(REASON_TEXT.TOTAL_INCOME).toBe('연간 합산 소득이 2,000만원을 넘어요');
  });

  it('describes SIDE_INCOME_UNREGISTERED', () => {
    expect(REASON_TEXT.SIDE_INCOME_UNREGISTERED).toBe('부업 소득이 연 500만원을 넘어요 (사업자 미등록)');
  });

  it('describes SIDE_INCOME_REGISTERED', () => {
    expect(REASON_TEXT.SIDE_INCOME_REGISTERED).toBe('사업자등록 상태에서 부업 소득이 있어요');
  });
});

describe('DISCLAIMER_TEXT', () => {
  it('is the fixed disclaimer copy', () => {
    expect(DISCLAIMER_TEXT).toBe(
      '이 앱의 진단은 입력한 소득을 바탕으로 한 참고용 추정치이며, 실제 자격 판정과 보험료는 국민건강보험공단 기준에 따라 달라질 수 있어요.'
    );
  });
});

describe('buildRuleDescriptions', () => {
  it('returns 6 non-empty descriptions', () => {
    const result = buildRuleDescriptions(RULES);
    expect(result).toHaveLength(6);
    result.forEach((desc) => {
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  it('formats values from RULES, not hardcoded numbers', () => {
    const allText = buildRuleDescriptions(RULES).join('|');
    expect(allText).toContain('2,000');
    expect(allText).toContain('500');
    expect(allText).toContain('7.19');
    expect(allText).toContain('13.14');
  });

  it('reflects a changed RULES value', () => {
    const customRules = { ...RULES, healthRateBp: 500 };
    const allText = buildRuleDescriptions(customRules).join('|');
    expect(allText).toContain('5%');
    expect(allText).not.toContain('7.19');
  });
});

describe('JUDGMENT_RULES', () => {
  it('derives its summary from RULES, not hardcoded numbers', () => {
    const result = JUDGMENT_RULES();
    expect(result.monthlyMinimum).toBe(Math.floor(RULES.totalIncomeLimit / 12));
    expect(result.coverageThreshold).toBe(RULES.warningRatioBp / 10_000);
    expect(result.premiumRate).toBe(RULES.healthRateBp / 10_000);
  });

  it('returns fresh values on each call (no shared mutable state)', () => {
    const a = JUDGMENT_RULES();
    const b = JUDGMENT_RULES();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe('Integration: no hardcoded numeric literals', () => {
  it('formatWon(RULES.totalIncomeLimit) matches the 원 display format', () => {
    expect(formatWon(RULES.totalIncomeLimit)).toBe('20,000,000원');
  });
});
