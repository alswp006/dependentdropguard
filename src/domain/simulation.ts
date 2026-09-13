// 지역가입자 전환 시뮬레이션 — diagnosis.ts 순수 함수만 조합한다.
import type { AnnualSummary, DiagnosisResult, RuleSet } from '@/lib/types';
import { diagnose, estimatePremium } from '@/domain/diagnosis';

export interface SimulationInput {
  baseSummary: AnnualSummary | null;
  baseHasBiz: boolean;
  salaryMonthly: number;
  sideMonthly: number;
  simHasBiz: boolean;
  rules: RuleSet;
}

export interface SimulationResult {
  sim: DiagnosisResult;
  deltaSide: number;
  premiumAnnualDelta: number;
  netGain: number;
}

// DROP일 때만 보험료를 부담하므로, SAFE/WARNING이면 0으로 취급한다.
function premiumAnnualIfDrop(diagnosis: DiagnosisResult, rules: RuleSet): number {
  return diagnosis.status === 'DROP' ? estimatePremium(diagnosis.summary.totalAnnual, rules).totalAnnual : 0;
}

export function computeSimulation(input: SimulationInput): SimulationResult {
  const { baseSummary, baseHasBiz, salaryMonthly, sideMonthly, simHasBiz, rules } = input;

  const salaryAnnual = salaryMonthly * 12;
  const sideAnnual = sideMonthly * 12;
  const otherAnnual = baseSummary?.otherAnnual ?? 0;
  const totalAnnual = salaryAnnual + sideAnnual + otherAnnual;

  const simSummary: AnnualSummary = {
    year: baseSummary?.year ?? rules.year,
    recordedMonths: 12,
    actualTotal: totalAnnual,
    salaryAnnual,
    sideAnnual,
    otherAnnual,
    totalAnnual,
  };

  const sim = diagnose(simSummary, { hasBusinessRegistration: simHasBiz }, rules);
  const simPremiumAnnual = premiumAnnualIfDrop(sim, rules);

  const basePremiumAnnual = baseSummary
    ? premiumAnnualIfDrop(diagnose(baseSummary, { hasBusinessRegistration: baseHasBiz }, rules), rules)
    : 0;

  const baseSideAnnual = baseSummary?.sideAnnual ?? 0;
  const deltaSide = sideAnnual - baseSideAnnual;
  const premiumAnnualDelta = simPremiumAnnual - basePremiumAnnual;
  const netGain = deltaSide - premiumAnnualDelta;

  return { sim, deltaSide, premiumAnnualDelta, netGain };
}

// contract.ts가 다른 패킷에 약속한 이름 — 실제 시뮬레이션 로직은 computeSimulation과 동일하다.
export { computeSimulation as simulate };
