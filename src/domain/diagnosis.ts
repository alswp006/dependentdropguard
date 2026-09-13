// 진단 엔진 — 연 환산·상태 판정·보험료 추정 순수 함수. 정수 연산만 사용(SPEC §5).
import type {
  MonthlyIncomeRecord,
  AnnualSummary,
  DiagnosisResult,
  DiagnosisStatus,
  DropReason,
  PremiumEstimate,
  RuleSet,
} from '@/lib/types';

export interface BizStatus {
  hasBusinessRegistration: boolean;
}

type IncomeField = 'salaryIncome' | 'sideIncome' | 'otherIncome';

function sumField(records: MonthlyIncomeRecord[], field: IncomeField): number {
  return records.reduce((acc, r) => acc + r[field], 0);
}

export function summarizeYear(records: MonthlyIncomeRecord[], year: number): AnnualSummary | null {
  const filtered = records.filter((r) => r.month.startsWith(`${year}-`));
  const recordedMonths = filtered.length;
  if (recordedMonths === 0) return null;

  const salarySum = sumField(filtered, 'salaryIncome');
  const sideSum = sumField(filtered, 'sideIncome');
  const otherSum = sumField(filtered, 'otherIncome');
  const actualTotal = salarySum + sideSum + otherSum;

  const salaryAnnual = Math.floor((salarySum * 12) / recordedMonths);
  const sideAnnual = Math.floor((sideSum * 12) / recordedMonths);
  const otherAnnual = Math.floor((otherSum * 12) / recordedMonths);
  const totalAnnual = salaryAnnual + sideAnnual + otherAnnual;

  return {
    year,
    recordedMonths,
    actualTotal,
    salaryAnnual,
    sideAnnual,
    otherAnnual,
    totalAnnual,
  };
}

// 건강보험료·장기요양보험료는 10원 단위 절사(floor)로 산정한다.
export function estimatePremium(totalAnnual: number, rules: RuleSet): PremiumEstimate {
  const monthlyBase = Math.floor(totalAnnual / 12);
  const healthMonthly = Math.floor((monthlyBase * rules.healthRateBp) / 100_000) * 10;
  const ltcMonthly = Math.floor((healthMonthly * rules.ltcRatioBp) / 100_000) * 10;
  const totalMonthly = healthMonthly + ltcMonthly;

  return {
    monthlyBase,
    healthMonthly,
    ltcMonthly,
    totalMonthly,
    totalAnnual: totalMonthly * 12,
  };
}

function sideLimitFor(hasBiz: BizStatus, rules: RuleSet): number {
  return hasBiz.hasBusinessRegistration ? rules.sideIncomeLimitRegistered : rules.sideIncomeLimitUnregistered;
}

export function diagnose(summary: AnnualSummary, hasBiz: BizStatus, rules: RuleSet): DiagnosisResult {
  const sideLimit = sideLimitFor(hasBiz, rules);
  const totalOver = Math.max(0, summary.totalAnnual - rules.totalIncomeLimit);
  const sideOver = Math.max(0, summary.sideAnnual - sideLimit);

  const reasons: DropReason[] = [];
  if (totalOver > 0) reasons.push('TOTAL_INCOME');
  if (sideOver > 0) {
    reasons.push(hasBiz.hasBusinessRegistration ? 'SIDE_INCOME_REGISTERED' : 'SIDE_INCOME_UNREGISTERED');
  }

  let status: DiagnosisStatus;
  if (reasons.length > 0) {
    status = 'DROP';
  } else {
    // 정수 교차곱으로 80% 경계 비교(부동소수 오차 회피)
    const totalWarn = summary.totalAnnual * 10_000 >= rules.totalIncomeLimit * rules.warningRatioBp;
    const sideWarn = sideLimit > 0 && summary.sideAnnual * 10_000 >= sideLimit * rules.warningRatioBp;
    status = totalWarn || sideWarn ? 'WARNING' : 'SAFE';
  }

  const overAmount = status === 'DROP' ? Math.max(totalOver, sideOver) : 0;
  const marginToDrop =
    status === 'DROP'
      ? 0
      : Math.min(rules.totalIncomeLimit - summary.totalAnnual, sideLimit - summary.sideAnnual);
  const totalRatioPercent = Math.floor((summary.totalAnnual * 100) / rules.totalIncomeLimit);

  return {
    year: summary.year,
    status,
    reasons,
    summary,
    marginToDrop,
    overAmount,
    totalRatioPercent,
  };
}

// 미입력 달은 입력된 달의 항목별 평균(Math.floor)으로 채워 12월까지 누적, DROP 기준을 처음 넘는 달을 찾는다.
export function findDropMonth(
  records: MonthlyIncomeRecord[],
  year: number,
  hasBiz: BizStatus,
  rules: RuleSet
): string | null {
  const yearRecords = records.filter((r) => r.month.startsWith(`${year}-`));
  const n = yearRecords.length;
  if (n === 0) return null;

  const fillSalary = Math.floor(sumField(yearRecords, 'salaryIncome') / n);
  const fillSide = Math.floor(sumField(yearRecords, 'sideIncome') / n);
  const fillOther = Math.floor(sumField(yearRecords, 'otherIncome') / n);
  const byMonth = new Map(yearRecords.map((r) => [r.month, r]));
  const sideLimit = sideLimitFor(hasBiz, rules);

  let cumTotal = 0;
  let cumSide = 0;
  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    const rec = byMonth.get(monthStr);
    const salary = rec ? rec.salaryIncome : fillSalary;
    const side = rec ? rec.sideIncome : fillSide;
    const other = rec ? rec.otherIncome : fillOther;

    cumTotal += salary + side + other;
    cumSide += side;

    if (cumTotal > rules.totalIncomeLimit || cumSide > sideLimit) {
      return monthStr;
    }
  }
  return null;
}

export function maxSafeSideMonthly(
  salaryAnnual: number,
  otherAnnual: number,
  hasBusinessRegistration: boolean,
  rules: RuleSet
): number {
  const sideLimit = hasBusinessRegistration ? rules.sideIncomeLimitRegistered : rules.sideIncomeLimitUnregistered;
  const remainingTotal = rules.totalIncomeLimit - salaryAnnual - otherAnnual;
  const maxSideAnnual = Math.max(0, Math.min(sideLimit, remainingTotal));
  return Math.floor(maxSideAnnual / 12);
}

const STATUS_SEVERITY: Record<DiagnosisStatus, number> = { SAFE: 0, WARNING: 1, DROP: 2 };

export function isWorsened(prev: DiagnosisStatus | null, next: DiagnosisStatus): boolean {
  if (prev === null) return false;
  return STATUS_SEVERITY[next] > STATUS_SEVERITY[prev];
}
