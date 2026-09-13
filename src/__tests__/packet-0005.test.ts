import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  MonthlyIncomeRecord,
  AnnualSummary,
  DiagnosisResult,
  PremiumEstimate,
  RuleSet,
} from "@/lib/types";

// These functions will be implemented in src/domain/diagnosis.ts and src/domain/simulation.ts
// For now, they are imported (and will fail until created)
import {
  summarizeYear,
  diagnose,
  estimatePremium,
  findDropMonth,
  maxSafeSideMonthly,
  isWorsened,
} from "@/domain/diagnosis";
import { computeSimulation } from "@/domain/simulation";

const RULES: RuleSet = {
  year: 2026,
  totalIncomeLimit: 20_000_000,
  sideIncomeLimitUnregistered: 5_000_000,
  sideIncomeLimitRegistered: 0,
  warningRatioBp: 8000,
  healthRateBp: 719,
  ltcRatioBp: 1314,
};

describe("진단 엔진: 연 환산·판정·보험료·시뮬레이션 순수 함수", () => {
  describe("AC-1: 연 환산 및 상태 판정 (2개월 동일 소득)", () => {
    it("should summarize 2026-01, 2026-02 with salary 1,700,000 and side 0", () => {
      const records: MonthlyIncomeRecord[] = [
        {
          month: "2026-01",
          salaryIncome: 1_700_000,
          sideIncome: 0,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
        {
          month: "2026-02",
          salaryIncome: 1_700_000,
          sideIncome: 0,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
      ];

      const summary = summarizeYear(records, 2026);
      expect(summary).not.toBeNull();
      expect(summary!.totalAnnual).toBe(20_400_000);
      expect(summary!.salaryAnnual).toBe(20_400_000);
      expect(summary!.sideAnnual).toBe(0);
      expect(summary!.recordedMonths).toBe(2);
    });

    it("should diagnose DROP status with TOTAL_INCOME reason", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 2,
        actualTotal: 3_400_000,
        salaryAnnual: 20_400_000,
        sideAnnual: 0,
        otherAnnual: 0,
        totalAnnual: 20_400_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      expect(diagnosis.status).toBe("DROP");
      expect(diagnosis.reasons).toContain("TOTAL_INCOME");
      expect(diagnosis.overAmount).toBe(400_000);
    });

    it("should calculate premium correctly for totalAnnual 20,400,000", () => {
      const premium = estimatePremium(20_400_000, RULES);
      expect(premium.monthlyBase).toBe(1_700_000);
      expect(premium.healthMonthly).toBe(122_230);
      expect(premium.ltcMonthly).toBe(16_060);
      expect(premium.totalMonthly).toBe(138_290);
      expect(premium.totalAnnual).toBe(1_659_480);
    });

    it("should estimate premium for 14,400,000 correctly", () => {
      const premium = estimatePremium(14_400_000, RULES);
      expect(premium.totalMonthly).toBeCloseTo(97_610, -1);
    });
  });

  describe("AC-2: 미등록 경계값 검증", () => {
    it("should return WARNING for total at 20,000,000 (boundary)", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 20_000_000,
        salaryAnnual: 20_000_000,
        sideAnnual: 0,
        otherAnnual: 0,
        totalAnnual: 20_000_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      expect(diagnosis.status).toBe("WARNING");
      expect(diagnosis.reasons).toHaveLength(0);
    });

    it("should return WARNING for side at 4,000,000 (80% of 5M)", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 14_000_000,
        salaryAnnual: 10_000_000,
        sideAnnual: 4_000_000,
        otherAnnual: 0,
        totalAnnual: 14_000_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      expect(diagnosis.status).toBe("WARNING");
    });

    it("should return DROP for side > 5,000,000 (unregistered)", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 11_400_000,
        salaryAnnual: 6_000_000,
        sideAnnual: 5_400_000,
        otherAnnual: 0,
        totalAnnual: 11_400_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      expect(diagnosis.status).toBe("DROP");
      expect(diagnosis.reasons).toContain("SIDE_INCOME_UNREGISTERED");
      expect(diagnosis.overAmount).toBe(400_000);
    });

    it("should return SAFE for total 15,999,999 and side 3,999,999", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 15_999_999,
        salaryAnnual: 12_000_000,
        sideAnnual: 3_999_999,
        otherAnnual: 0,
        totalAnnual: 15_999_999,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      expect(diagnosis.status).toBe("SAFE");
      expect(diagnosis.reasons).toHaveLength(0);
    });

    it("should return DROP with 2 reasons for total 22M and side 6M", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 22_000_000,
        salaryAnnual: 16_000_000,
        sideAnnual: 6_000_000,
        otherAnnual: 0,
        totalAnnual: 22_000_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      expect(diagnosis.status).toBe("DROP");
      expect(diagnosis.reasons).toHaveLength(2);
      expect(diagnosis.reasons).toContain("TOTAL_INCOME");
      expect(diagnosis.reasons).toContain("SIDE_INCOME_UNREGISTERED");
      expect(diagnosis.overAmount).toBe(2_000_000);
    });

    it("should return DROP for registered with any side income", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 12_120_000,
        salaryAnnual: 12_000_000,
        sideAnnual: 120_000,
        otherAnnual: 0,
        totalAnnual: 12_120_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: true }, RULES);
      expect(diagnosis.status).toBe("DROP");
      expect(diagnosis.reasons).toContain("SIDE_INCOME_REGISTERED");
      expect(diagnosis.marginToDrop).toBe(0);
    });

    it("should calculate marginToDrop 4,000,000 for unregistered with total 10M and side 1M", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 11_000_000,
        salaryAnnual: 10_000_000,
        sideAnnual: 1_000_000,
        otherAnnual: 0,
        totalAnnual: 11_000_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      expect(diagnosis.status).toBe("SAFE");
      expect(diagnosis.marginToDrop).toBe(4_000_000);
    });
  });

  describe("AC-3: 연 환산 (월별 데이터)", () => {
    it("should annualize side income for 2026-01 (100,001) and 2026-02 (0) to 600,006", () => {
      const records: MonthlyIncomeRecord[] = [
        {
          month: "2026-01",
          salaryIncome: 0,
          sideIncome: 100_001,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
        {
          month: "2026-02",
          salaryIncome: 0,
          sideIncome: 0,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
      ];

      const summary = summarizeYear(records, 2026);
      expect(summary).not.toBeNull();
      // (100,001 + 0) * 12 / 2 = 100,001 * 6 = 600,006
      expect(summary!.sideAnnual).toBe(600_006);
    });

    it("should exclude 2025 records from 2026 summary", () => {
      const records: MonthlyIncomeRecord[] = [
        {
          month: "2025-12",
          salaryIncome: 1_000_000,
          sideIncome: 0,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
        {
          month: "2026-01",
          salaryIncome: 1_000_000,
          sideIncome: 0,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
      ];

      const summary = summarizeYear(records, 2026);
      expect(summary).not.toBeNull();
      expect(summary!.recordedMonths).toBe(1);
      expect(summary!.salaryAnnual).toBe(12_000_000);
    });
  });

  describe("AC-4: maxSafeSideMonthly & findDropMonth", () => {
    it("should return 416,666 for unregistered with salaryAnnual 0", () => {
      const maxSide = maxSafeSideMonthly(0, 0, false, RULES);
      expect(maxSide).toBe(416_666);
    });

    it("should return 66,666 for unregistered with salaryAnnual 19,200,000", () => {
      const maxSide = maxSafeSideMonthly(19_200_000, 0, false, RULES);
      expect(maxSide).toBe(66_666);
    });

    it("should return 0 for registered", () => {
      const maxSide = maxSafeSideMonthly(12_000_000, 0, true, RULES);
      expect(maxSide).toBe(0);
    });

    it("should find DROP month at 2026-12 for unregistered with salary 1.5M, side 200k", () => {
      const records: MonthlyIncomeRecord[] = [
        {
          month: "2026-01",
          salaryIncome: 1_500_000,
          sideIncome: 200_000,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
        {
          month: "2026-02",
          salaryIncome: 1_500_000,
          sideIncome: 200_000,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
        {
          month: "2026-03",
          salaryIncome: 1_500_000,
          sideIncome: 200_000,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
      ];

      const dropMonth = findDropMonth(records, 2026, { hasBusinessRegistration: false }, RULES);
      expect(dropMonth).toBe("2026-12");
    });

    it("should return null for findDropMonth when never exceeds limit (salary 1M, side 200k)", () => {
      const records: MonthlyIncomeRecord[] = [
        {
          month: "2026-01",
          salaryIncome: 1_000_000,
          sideIncome: 200_000,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
        {
          month: "2026-02",
          salaryIncome: 1_000_000,
          sideIncome: 200_000,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
        {
          month: "2026-03",
          salaryIncome: 1_000_000,
          sideIncome: 200_000,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
      ];

      const dropMonth = findDropMonth(records, 2026, { hasBusinessRegistration: false }, RULES);
      expect(dropMonth).toBeNull();
    });
  });

  describe("AC-5: isWorsened & computeSimulation", () => {
    it("should return true for isWorsened('SAFE', 'WARNING')", () => {
      const result = isWorsened("SAFE", "WARNING");
      expect(result).toBe(true);
    });

    it("should return false for isWorsened('DROP', 'WARNING')", () => {
      const result = isWorsened("DROP", "WARNING");
      expect(result).toBe(false);
    });

    it("should return false for isWorsened(null, 'DROP')", () => {
      const result = isWorsened(null, "DROP");
      expect(result).toBe(false);
    });

    it("should compute simulation with null baseSummary", () => {
      const result = computeSimulation({
        baseSummary: null,
        baseHasBiz: false,
        salaryMonthly: 1_600_000,
        sideMonthly: 100_000,
        simHasBiz: false,
        rules: RULES,
      });

      expect(result.deltaSide).toBe(1_200_000);
      expect(result.premiumAnnualDelta).toBe(1_659_480);
      expect(result.netGain).toBe(-459_480);
    });

    it("should compute simulation result properties", () => {
      const result = computeSimulation({
        baseSummary: null,
        baseHasBiz: false,
        salaryMonthly: 1_600_000,
        sideMonthly: 100_000,
        simHasBiz: false,
        rules: RULES,
      });

      expect(result).toHaveProperty("sim");
      expect(result).toHaveProperty("deltaSide");
      expect(result).toHaveProperty("premiumAnnualDelta");
      expect(result).toHaveProperty("netGain");
      expect(result.sim).toHaveProperty("status");
      expect(result.sim).toHaveProperty("reasons");
    });
  });

  describe("AC-1 Extended: Premium calculation verification", () => {
    it("should calculate premium correctly for various totals", () => {
      const testCases = [
        { total: 20_400_000, expectedMonthly: 138_290, expectedAnnual: 1_659_480 },
        { total: 18_000_000, expectedMonthly: 122_020, expectedAnnual: 1_464_240 },
        { total: 0, expectedMonthly: 0, expectedAnnual: 0 },
      ];

      testCases.forEach(({ total, expectedMonthly, expectedAnnual }) => {
        const premium = estimatePremium(total, RULES);
        expect(premium.totalMonthly).toBe(expectedMonthly);
        expect(premium.totalAnnual).toBe(expectedAnnual);
      });
    });
  });

  describe("summarizeYear returns null for empty records", () => {
    it("should return null when records array is empty", () => {
      const summary = summarizeYear([], 2026);
      expect(summary).toBeNull();
    });

    it("should return null when no records match the year", () => {
      const records: MonthlyIncomeRecord[] = [
        {
          month: "2025-12",
          salaryIncome: 1_000_000,
          sideIncome: 0,
          otherIncome: 0,
          memo: "",
          updatedAt: new Date().toISOString(),
        },
      ];

      const summary = summarizeYear(records, 2026);
      expect(summary).toBeNull();
    });
  });

  describe("diagnose handles all status transitions", () => {
    it("should track totalRatioPercent correctly", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 20_400_000,
        salaryAnnual: 20_400_000,
        sideAnnual: 0,
        otherAnnual: 0,
        totalAnnual: 20_400_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      // 20,400,000 / 20,000,000 * 100 = 102
      expect(diagnosis.totalRatioPercent).toBe(102);
    });

    it("should calculate marginToDrop correctly for unregistered", () => {
      const summary: AnnualSummary = {
        year: 2026,
        recordedMonths: 12,
        actualTotal: 14_000_000,
        salaryAnnual: 10_000_000,
        sideAnnual: 4_000_000,
        otherAnnual: 0,
        totalAnnual: 14_000_000,
      };

      const diagnosis = diagnose(summary, { hasBusinessRegistration: false }, RULES);
      // min(20M - 14M, 5M - 4M) = min(6M, 1M) = 1M
      expect(diagnosis.marginToDrop).toBe(1_000_000);
    });
  });
});
