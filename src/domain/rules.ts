// 판정 기준 상수 + 표시 문구 — 수치는 RULES에서만 나오고, 문구는 RULES 값으로 조립한다.
import type { RuleSet, DiagnosisStatus, DropReason } from '@/lib/types';
import type { JUDGMENT_RULESFn } from '@/lib/contract';
import { formatWon } from '@/utils/format';

export const RULES: RuleSet = {
  year: 2026,
  totalIncomeLimit: 20_000_000,
  sideIncomeLimitUnregistered: 5_000_000,
  sideIncomeLimitRegistered: 0,
  warningRatioBp: 8000,
  healthRateBp: 719,
  ltcRatioBp: 1314,
};

export const STATUS_LABEL: Record<DiagnosisStatus, string> = {
  SAFE: '안전',
  WARNING: '주의',
  DROP: '탈락 위험',
};

export const DISCLAIMER_TEXT =
  '이 앱의 진단은 입력한 소득을 바탕으로 한 참고용 추정치이며, 실제 자격 판정과 보험료는 국민건강보험공단 기준에 따라 달라질 수 있어요.';

// 원 단위 금액을 만원 단위 문구로 표시 (예: 20_000_000 -> "2,000만원")
function formatManwon(amount: number): string {
  return `${Math.floor(amount / 10_000).toLocaleString('ko-KR')}만원`;
}

// bp(1/10000) 단위 비율을 소수 둘째 자리까지 표시하되, 불필요한 끝자리 0은 잘라낸다
// 예: 8000bp -> "80", 719bp -> "7.19", 1314bp -> "13.14"
function formatBpPercent(bp: number): string {
  return (bp / 100).toFixed(2).replace(/\.?0+$/, '');
}

export const REASON_TEXT: Record<DropReason, string> = {
  TOTAL_INCOME: `연간 합산 소득이 ${formatManwon(RULES.totalIncomeLimit)}을 넘어요`,
  SIDE_INCOME_UNREGISTERED: `부업 소득이 연 ${formatManwon(RULES.sideIncomeLimitUnregistered)}을 넘어요 (사업자 미등록)`,
  SIDE_INCOME_REGISTERED: '사업자등록 상태에서 부업 소득이 있어요',
};

// contract.ts가 다른 패킷에 약속한 요약 시그니처 — 실제 수치는 전부 RULES에서 파생한다.
export const JUDGMENT_RULES: JUDGMENT_RULESFn = () => ({
  monthlyMinimum: Math.floor(RULES.totalIncomeLimit / 12),
  coverageThreshold: RULES.warningRatioBp / 10_000,
  premiumRate: RULES.healthRateBp / 10_000,
});

export function buildRuleDescriptions(rules: RuleSet): string[] {
  return [
    `합산 소득 기준: 연 ${formatManwon(rules.totalIncomeLimit)} 초과 시 탈락`,
    `부업 소득 기준(사업자 미등록): 연 ${formatManwon(rules.sideIncomeLimitUnregistered)} 초과 시 탈락`,
    `부업 소득 기준(사업자 등록): ${formatWon(rules.sideIncomeLimitRegistered)} 초과 시 탈락`,
    `주의 구간: 기준의 ${formatBpPercent(rules.warningRatioBp)}% 이상`,
    `건강보험료율: ${formatBpPercent(rules.healthRateBp)}%`,
    `장기요양보험료: 건강보험료의 ${formatBpPercent(rules.ltcRatioBp)}%`,
  ];
}
