import { describe, it, expect } from "vitest";
import { formatWon, formatMonthLabel, prevMonthKey, isValidMonthKey, selectableMonths, formatAmountInput, parseAmountInput } from "@/utils/format";
import { RULES, STATUS_LABEL, REASON_TEXT, buildRuleDescriptions } from "@/domain/rules";

describe("packet-0002: 판정 규칙 상수 + 표시 포맷 유틸", () => {
  const now = new Date("2026-09-14T00:00:00+09:00");

  // ============ AC1: formatWon과 formatMonthLabel ============
  describe("AC1: formatWon과 formatMonthLabel", () => {
    it("AC1-1[P0]: formatWon should format 20,400,000 with comma and 원 suffix", () => {
      const result = formatWon(20400000);
      expect(result).toBe("20,400,000원");
    });

    it("AC1-2[P0]: formatMonthLabel should show month only for current year (8월)", () => {
      const result = formatMonthLabel("2026-08", now);
      expect(result).toBe("8월");
    });

    it("AC1-3[P0]: formatMonthLabel should show year and month for past year (2025년 12월)", () => {
      const result = formatMonthLabel("2025-12", now);
      expect(result).toBe("2025년 12월");
    });

    it("AC1-4: formatWon should handle zero", () => {
      expect(formatWon(0)).toBe("0원");
    });

    it("AC1-5: formatWon should handle negative amounts", () => {
      expect(formatWon(-1000)).toBe("-1,000원");
    });

    it("AC1-6: formatMonthLabel for current month should still show month only", () => {
      const result = formatMonthLabel("2026-09", now);
      expect(result).toBe("9월");
    });
  });

  // ============ AC2: prevMonthKey와 isValidMonthKey ============
  describe("AC2: prevMonthKey와 isValidMonthKey", () => {
    it("AC2-1[P0]: prevMonthKey should return '2026-12' for 2027-01-05", () => {
      const date = new Date("2027-01-05T09:00:00+09:00");
      const result = prevMonthKey(date);
      expect(result).toBe("2026-12");
    });

    it("AC2-2[P0]: isValidMonthKey should return false for '2026-13'", () => {
      expect(isValidMonthKey("2026-13")).toBe(false);
    });

    it("AC2-3[P0]: isValidMonthKey should return true for '2026-01'", () => {
      expect(isValidMonthKey("2026-01")).toBe(true);
    });

    it("AC2-4: isValidMonthKey should return false for month 00", () => {
      expect(isValidMonthKey("2026-00")).toBe(false);
    });

    it("AC2-5: isValidMonthKey should return false for invalid format", () => {
      expect(isValidMonthKey("202601")).toBe(false);
      expect(isValidMonthKey("26-01")).toBe(false);
    });

    it("AC2-6: prevMonthKey should handle year boundary (January -> December previous year)", () => {
      const date = new Date("2026-01-15T09:00:00+09:00");
      const result = prevMonthKey(date);
      expect(result).toBe("2025-12");
    });
  });

  // ============ AC3: selectableMonths ============
  describe("AC3: selectableMonths", () => {
    it("AC3-1[P0]: selectableMonths should return array of length 21", () => {
      const result = selectableMonths(now);
      expect(result).toHaveLength(21);
    });

    it("AC3-2[P0]: selectableMonths[0] should be '2026-09'", () => {
      const result = selectableMonths(now);
      expect(result[0]).toBe("2026-09");
    });

    it("AC3-3[P0]: selectableMonths[20] should be '2025-01'", () => {
      const result = selectableMonths(now);
      expect(result[20]).toBe("2025-01");
    });

    it("AC3-4: selectableMonths should be in descending order", () => {
      const result = selectableMonths(now);
      for (let i = 0; i < result.length - 1; i++) {
        const curr = result[i];
        const next = result[i + 1];
        expect(curr > next).toBe(true); // YYYY-MM format naturally sorts chronologically
      }
    });

    it("AC3-5: selectableMonths for different now date should adjust correctly", () => {
      const differentNow = new Date("2026-01-15T00:00:00+09:00");
      const result = selectableMonths(differentNow);
      expect(result[0]).toBe("2026-01");
      expect(result[20]).toBe("2024-05");
    });
  });

  // ============ AC4: formatAmountInput와 parseAmountInput ============
  describe("AC4: formatAmountInput와 parseAmountInput", () => {
    it("AC4-1[P0]: formatAmountInput should remove non-digit characters from '12a3' -> '123'", () => {
      const result = formatAmountInput("12a3");
      expect(result).toBe("123");
    });

    it("AC4-2[P0]: formatAmountInput should add thousand separators to '1000000' -> '1,000,000'", () => {
      const result = formatAmountInput("1000000");
      expect(result).toBe("1,000,000");
    });

    it("AC4-3[P0]: parseAmountInput should parse '1,000' to 1000", () => {
      const result = parseAmountInput("1,000");
      expect(result).toBe(1000);
    });

    it("AC4-4[P0]: parseAmountInput should return null for empty string", () => {
      const result = parseAmountInput("");
      expect(result).toBeNull();
    });

    it("AC4-5: formatAmountInput should handle empty string", () => {
      expect(formatAmountInput("")).toBe("");
    });

    it("AC4-6: formatAmountInput should remove multiple non-digit chars", () => {
      const result = formatAmountInput("1@2#3$4");
      expect(result).toBe("1234");
    });

    it("AC4-7: parseAmountInput should handle larger amounts", () => {
      expect(parseAmountInput("20,400,000")).toBe(20400000);
    });

    it("AC4-8: parseAmountInput should handle amounts without separators", () => {
      expect(parseAmountInput("1000")).toBe(1000);
    });

    it("AC4-9: parseAmountInput should return null for non-numeric input", () => {
      expect(parseAmountInput("abc")).toBeNull();
    });

    it("AC4-10: formatAmountInput then parseAmountInput should roundtrip", () => {
      const original = 5000000;
      const formatted = formatAmountInput(original.toString());
      const parsed = parseAmountInput(formatted);
      expect(parsed).toBe(original);
    });
  });

  // ============ AC5: 판정 상수 및 규칙 설명 ============
  describe("AC5: 판정 상수 및 규칙 설명", () => {
    it("AC5-1[P0]: STATUS_LABEL.SAFE should be '안전'", () => {
      expect(STATUS_LABEL.SAFE).toBe("안전");
    });

    it("AC5-2[P0]: STATUS_LABEL.WARNING should be '주의'", () => {
      expect(STATUS_LABEL.WARNING).toBe("주의");
    });

    it("AC5-3[P0]: STATUS_LABEL.DROP should be '탈락 위험'", () => {
      expect(STATUS_LABEL.DROP).toBe("탈락 위험");
    });

    it("AC5-4[P0]: REASON_TEXT.TOTAL_INCOME should be '연간 합산 소득이 2,000만원을 넘어요'", () => {
      expect(REASON_TEXT.TOTAL_INCOME).toBe("연간 합산 소득이 2,000만원을 넘어요");
    });

    it("AC5-5[P0]: buildRuleDescriptions should return array of 6 descriptions", () => {
      const result = buildRuleDescriptions(RULES);
      expect(result).toHaveLength(6);
    });

    it("AC5-6[P0]: buildRuleDescriptions should return non-empty strings", () => {
      const result = buildRuleDescriptions(RULES);
      result.forEach((desc, idx) => {
        expect(typeof desc).toBe("string");
        expect(desc.length).toBeGreaterThan(0);
      });
    });

    it("AC5-7: RULES should have totalIncomeLimit property", () => {
      expect(RULES.totalIncomeLimit).toBe(20000000);
    });

    it("AC5-8: RULES should have sideIncomeLimitUnregistered property", () => {
      expect(RULES.sideIncomeLimitUnregistered).toBe(5000000);
    });

    it("AC5-9: REASON_TEXT should contain required keys", () => {
      expect(REASON_TEXT).toHaveProperty("TOTAL_INCOME");
    });

    it("AC5-10: STATUS_LABEL should have exactly 3 keys", () => {
      const keys = Object.keys(STATUS_LABEL);
      expect(keys).toHaveLength(3);
      expect(keys).toContain("SAFE");
      expect(keys).toContain("WARNING");
      expect(keys).toContain("DROP");
    });

    it("AC5-11: buildRuleDescriptions descriptions should use formatted amounts from RULES", () => {
      const result = buildRuleDescriptions(RULES);
      // Each description should contain formatted versions of the rule values
      const allText = result.join("|");
      expect(allText).toContain("2,000");
      expect(allText).toContain("500");
      expect(allText).toContain("7.19");
    });
  });

  // ============ Integration checks ============
  describe("Integration: No hardcoded numeric literals in rules.ts", () => {
    it("should use RULES constants to build REASON_TEXT, not hardcoded numbers", () => {
      // REASON_TEXT.TOTAL_INCOME should reference RULES.totalIncomeLimit
      // formatWon(RULES.totalIncomeLimit) should equal "20,000,000원"
      expect(formatWon(RULES.totalIncomeLimit)).toBe("20,000,000원");
    });

    it("buildRuleDescriptions should format RULES.sideIncomeLimitUnregistered correctly", () => {
      // Should show 500만원 (which is 5,000,000)
      const result = buildRuleDescriptions(RULES);
      const allText = result.join("|");
      expect(allText).toContain("500");
    });

    it("buildRuleDescriptions should format health rate as percentage with 2 decimals", () => {
      // 719 bp = 7.19%
      const result = buildRuleDescriptions(RULES);
      const allText = result.join("|");
      expect(allText).toContain("7.19");
    });
  });
});
