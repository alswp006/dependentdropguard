import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { renderHook, act, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";

/**
 * Packet 0006: 폼 검증 + Route State 파서 + AppDataContext + 테스트 하네스
 *
 * AC-1: validateAmount / validateMemo 금액·메모 검증
 * AC-2: parseRecordState — 미래 월 거부, null state 기본값, 잘못된 from 기본값
 * AC-3: parseYearState / parseProfileState 기본값·타입 정규화
 * AC-4: useAppData().upsertRecord — 성공 시 상태 갱신, STORAGE_FULL 실패 시 상태 불변
 * AC-5: renderWithProviders — MemoryRouter route+state가 useLocation에 반영
 *
 * 기준 시각: 2026-09-14 (parseRecordState는 now를 명시적으로 받는다)
 */

describe("Packet 0006: 폼 검증 + Route State 파서 + AppDataContext + 테스트 하네스", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ============ AC-1: validation.ts ============
  describe("AC-1: validateAmount / validateMemo", () => {
    it("AC-1.1[P0]: validateAmount('1,000,000,001') exceeds limit → exact error string", async () => {
      const { validateAmount } = await import("@/lib/validation");

      const result = validateAmount("1,000,000,001");

      expect(result).toBe("월 소득은 10억원 이하로 입력해주세요");
      expect(typeof result).toBe("string");
    });

    it("AC-1.2[P0]: validateAmount('1,000,000,000') at boundary → null (valid)", async () => {
      const { validateAmount } = await import("@/lib/validation");

      const result = validateAmount("1,000,000,000");

      expect(result).toBeNull();
    });

    it("AC-1.3[P0]: validateMemo rejects 31-character memo with a non-empty error string", async () => {
      const { validateMemo } = await import("@/lib/validation");

      const result = validateMemo("a".repeat(31));

      expect(typeof result).toBe("string");
      expect((result as string).length).toBeGreaterThan(0);
    });

    it("AC-1.4[P0]: validateMemo accepts exactly 30-character memo → null", async () => {
      const { validateMemo } = await import("@/lib/validation");

      const result = validateMemo("a".repeat(30));

      expect(result).toBeNull();
    });
  });

  // ============ AC-2: routeState.ts — parseRecordState ============
  describe("AC-2: parseRecordState — 기준 시각 2026-09-14", () => {
    const now = new Date("2026-09-14T12:00:00");

    it("AC-2.1[P0]: future month (2026-10) is rejected, falls back to prevMonthKey(now)='2026-08'", async () => {
      const { parseRecordState } = await import("@/lib/routeState");

      const result = parseRecordState({ month: "2026-10", from: "home" }, now);

      expect(result.month).toBe("2026-08");
      expect(result.from).toBe("home");
      expect(result.futureRejected).toBe(true);
    });

    it("AC-2.2[P0]: null state → default month prevMonthKey(now)='2026-08', from='home', futureRejected=false", async () => {
      const { parseRecordState } = await import("@/lib/routeState");

      const result = parseRecordState(null, now);

      expect(result).toEqual({ month: "2026-08", from: "home", futureRejected: false });
    });

    it("AC-2.3: state with unrecognized from ('x') falls back entirely to defaults", async () => {
      const { parseRecordState } = await import("@/lib/routeState");

      const result = parseRecordState({ month: "2024-12", from: "x" }, now);

      expect(result.month).toBe("2026-08");
      expect(result.from).toBe("home");
    });
  });

  // ============ AC-3: routeState.ts — parseYearState / parseProfileState ============
  describe("AC-3: parseYearState / parseProfileState — 기준 시각 2026-09-14", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-14T12:00:00"));
    });

    it("AC-3.1[P0]: parseYearState({year:'2026'}) and parseYearState(undefined) both resolve to 2026", async () => {
      const { parseYearState } = await import("@/lib/routeState");

      expect(parseYearState({ year: "2026" })).toBe(2026);
      expect(parseYearState(undefined)).toBe(2026);
    });

    it("AC-3.2: parseYearState({year:2025}) (number input) resolves to 2025", async () => {
      const { parseYearState } = await import("@/lib/routeState");

      expect(parseYearState({ year: 2025 })).toBe(2025);
    });

    it("AC-3.3[P0]: parseProfileState({mode:'edit'}).mode === 'edit', parseProfileState(null).mode === 'onboarding'", async () => {
      const { parseProfileState } = await import("@/lib/routeState");

      expect(parseProfileState({ mode: "edit" }).mode).toBe("edit");
      expect(parseProfileState(null).mode).toBe("onboarding");
    });
  });

  // ============ AC-4: AppDataContext ============
  describe("AC-4: useAppData().upsertRecord", () => {
    it("AC-4.1[P0]: successful upsertRecord updates records within the same render cycle", async () => {
      const { AppDataProvider, useAppData } = await import("@/state/AppDataContext");

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(AppDataProvider, null, children);

      const { result } = renderHook(() => useAppData(), { wrapper });

      expect(result.current.records).toHaveLength(0);

      let response: unknown;
      act(() => {
        response = result.current.upsertRecord({
          month: "2026-08",
          salaryIncome: 0,
          sideIncome: 200000,
          otherIncome: 0,
          memo: "",
        });
      });

      expect(response).toEqual({ ok: true, data: null });
      expect(result.current.records).toHaveLength(1);
      expect(result.current.records[0].month).toBe("2026-08");
      expect(result.current.records[0].sideIncome).toBe(200000);
    });

    it("AC-4.2[P0]: upsertRecord returns STORAGE_FULL on QuotaExceededError and leaves records unchanged", async () => {
      const { AppDataProvider, useAppData } = await import("@/state/AppDataContext");

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(AppDataProvider, null, children);

      const { result } = renderHook(() => useAppData(), { wrapper });

      const setItemSpy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementationOnce(() => {
          throw new DOMException("QuotaExceeded", "QuotaExceededError");
        });

      let response: unknown;
      act(() => {
        response = result.current.upsertRecord({
          month: "2026-08",
          salaryIncome: 0,
          sideIncome: 200000,
          otherIncome: 0,
          memo: "",
        });
      });

      expect(response).toEqual({ ok: false, error: "STORAGE_FULL" });
      expect(result.current.records).toHaveLength(0);

      setItemSpy.mockRestore();
    });
  });

  // ============ AC-5: renderWithProviders test harness ============
  describe("AC-5: renderWithProviders wires MemoryRouter route+state", () => {
    it("AC-5.1[P0]: useLocation().state reflects the route+state passed to renderWithProviders", async () => {
      const { renderWithProviders } = await import("@/test/renderWithProviders");

      function LocationProbe() {
        const location = useLocation();
        return React.createElement(
          "div",
          { "data-testid": "location-state" },
          JSON.stringify(location.state),
        );
      }

      renderWithProviders(React.createElement(LocationProbe), {
        route: "/record",
        state: { month: "2026-08", from: "home" },
      });

      expect(screen.getByTestId("location-state").textContent).toBe(
        JSON.stringify({ month: "2026-08", from: "home" }),
      );
    });

    it("AC-5.2: defaults to '/' with null state when no options are passed", async () => {
      const { renderWithProviders } = await import("@/test/renderWithProviders");

      function LocationProbe() {
        const location = useLocation();
        return React.createElement(
          "div",
          { "data-testid": "location-probe" },
          `${location.pathname}:${JSON.stringify(location.state)}`,
        );
      }

      renderWithProviders(React.createElement(LocationProbe));

      expect(screen.getByTestId("location-probe").textContent).toBe("/:null");
    });
  });
});
