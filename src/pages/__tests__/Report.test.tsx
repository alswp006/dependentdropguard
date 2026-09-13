import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { getReportUnlock } from "@/storage/reportUnlock";
import type { RecordsStore, UserProfile } from "@/lib/types";
import Report from "@/pages/Report";

/**
 * Packet: ReportPage — 보상형 광고 게이트 상세 리포트 (/report), UI-only 절반
 *
 * Report.tsx는 렌더링·연도 상태·빈 상태·리포트 본문·탭만 책임지고, 보상형 광고
 * 잠금/해제 로직(saveReportUnlock 호출 포함)은 ReportUnlockManager.tsx로 분리한다.
 * 그래서 여기서는 ReportUnlockManager를 children을 그대로 렌더하는 스텁으로 목킹해
 * "항상 잠금 해제된 상태"를 가정하고 Report.tsx 자체의 책임만 검증한다
 * (잠금/해제 동작은 ReportUnlockManager.test.tsx가 전담 — AC-3 관련).
 *
 * AC-4(SCOPE_TOO_LARGE 없음)는 런타임으로 단언할 수 없는 구조적 기준이라 별도 테스트가
 * 없다 — Report.tsx/ReportUnlockManager.tsx로 파일과 테스트를 쪼갠 것 자체가 그 이행이다.
 */

mockTds();
mockAppsInToss();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const { mockNavigate: navSpy } = await import("@/__tests__/__helpers__/mocks");
  return { ...actual, useNavigate: () => navSpy };
});

vi.mock("@/pages/ReportUnlockManager", () => ({
  ReportUnlockManager: ({ children }: { children: React.ReactNode }) => children,
}));

const NOW = new Date("2026-09-14T12:00:00");
const PROFILE_KEY = "ddg:profile:v1";
const RECORDS_KEY = "ddg:records:v1";

function seedProfile(overrides: Partial<UserProfile> = {}) {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function seedRecords(items: RecordsStore["items"]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, items }));
}

function makeRecord(month: string, salaryIncome: number, sideIncome: number) {
  return { month, salaryIncome, sideIncome, otherIncome: 0, memo: "", updatedAt: `${month}-01T00:00:00.000Z` };
}

async function renderReport(state: { year: number } | null = null) {
  return renderWithProviders(React.createElement(Report), { route: "/report", state });
}

describe("ReportPage(UI) — 렌더링·연도 상태·빈 상태·본문·탭 (/report)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-1[P0]: 2026년 기록이 0건이면 report-empty-state가 보이고 '소득 입력하기'를 누르면 /record로 이동한다", async () => {
    seedProfile();
    seedRecords([]);

    await renderReport({ year: 2026 });

    expect(screen.getByTestId("report-empty-state")).toBeInTheDocument();
    expect(screen.getByText("소득을 입력하면 리포트를 볼 수 있어요")).toBeInTheDocument();
    expect(screen.queryAllByTestId("criteria-card")).toHaveLength(0);

    fireEvent.click(screen.getByText("소득 입력하기"));

    expect(mockNavigate).toHaveBeenCalledWith("/record", {
      state: { month: "2026-08", from: "home" },
    });
  });

  it("AC-1[P0]: 잘못되거나 없는 year state(null, {year:1999}, {year:'2026'})는 모두 현재 연도(2026년) 탭 기준으로 예외 없이 렌더링된다", async () => {
    seedProfile();
    seedRecords([makeRecord("2026-01", 1_500_000, 200_000)]);

    for (const state of [null, { year: 1999 } as never, { year: "2026" } as never]) {
      const { unmount } = await renderReport(state);
      expect(screen.getByRole("tab", { name: "2026년" }).getAttribute("aria-selected")).toBe("true");
      expect(screen.getAllByTestId("criteria-card")).toHaveLength(2);
      unmount();
    }
  });

  it("AC-1: 2026년엔 기록이 있고 2025년엔 없을 때 기본 '2026년' 탭엔 리포트 카드가, '2025년' 탭을 누르면 빈 상태가 보인다", async () => {
    seedProfile();
    seedRecords([makeRecord("2026-01", 1_500_000, 200_000)]);

    await renderReport();

    expect(screen.getByRole("tab", { name: "2026년" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByTestId("criteria-card")).toHaveLength(2);
    expect(screen.queryByTestId("report-empty-state")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "2025년" }));

    expect(screen.getByTestId("report-empty-state")).toBeInTheDocument();
    expect(screen.queryAllByTestId("criteria-card")).toHaveLength(0);
  });

  it("AC-3[P0]: 탈락 위험 시나리오(salary 1,500,000·side 200,000×3개월, 미등록)에서 criteria-card 2개·premium-card·drop-month-card·income-breakdown이 정확한 값으로 렌더된다", async () => {
    seedProfile({ hasBusinessRegistration: false });
    seedRecords([
      makeRecord("2026-01", 1_500_000, 200_000),
      makeRecord("2026-02", 1_500_000, 200_000),
      makeRecord("2026-03", 1_500_000, 200_000),
    ]);

    await renderReport({ year: 2026 });

    const criteriaCards = screen.getAllByTestId("criteria-card");
    expect(criteriaCards).toHaveLength(2);
    expect(within(criteriaCards[0]).getByText("연간 합산 소득")).toBeInTheDocument();
    expect(within(criteriaCards[0]).getByText("20,400,000원 / 기준 20,000,000원")).toBeInTheDocument();
    expect(within(criteriaCards[0]).getByText("초과")).toBeInTheDocument();
    expect(within(criteriaCards[1]).getByText("부업 소득 (사업자 미등록)")).toBeInTheDocument();
    expect(within(criteriaCards[1]).getByText("2,400,000원 / 기준 5,000,000원")).toBeInTheDocument();
    expect(within(criteriaCards[1]).getByText("충족")).toBeInTheDocument();

    const premiumCard = screen.getByTestId("premium-card");
    expect(within(premiumCard).getByText("예상 월 보험료")).toBeInTheDocument();
    expect(screen.getByTestId("premium-card-value").textContent).toBe("138,290원");
    expect(within(premiumCard).getByText("건강보험료 122,230원")).toBeInTheDocument();
    expect(within(premiumCard).getByText("장기요양보험료 16,060원")).toBeInTheDocument();
    expect(within(premiumCard).getByText("연간 1,659,480원")).toBeInTheDocument();

    expect(screen.getByTestId("drop-month-card").textContent).toContain(
      "2026년 12월에 기준을 넘을 것으로 예상돼요",
    );

    const breakdown = screen.getByTestId("income-breakdown");
    expect(within(breakdown).getAllByRole("progressbar")).toHaveLength(3);
    expect(within(breakdown).getByText("본업 88%")).toBeInTheDocument();
    expect(within(breakdown).getByText("부업 12%")).toBeInTheDocument();
    expect(within(breakdown).getByText("기타 0%")).toBeInTheDocument();
  });

  it("AC-3: 안전 시나리오(salary 1,000,000·side 200,000, 1개월, 미등록)에서 premium-card 제목·값과 drop-month-card 문구가 바뀌고, '시뮬레이션 해보기'가 /simulate로 이동한다", async () => {
    seedProfile({ hasBusinessRegistration: false });
    seedRecords([makeRecord("2026-01", 1_000_000, 200_000)]);

    await renderReport({ year: 2026 });

    const premiumCard = screen.getByTestId("premium-card");
    expect(within(premiumCard).getByText("탈락 시 예상 월 보험료(현재 소득 기준)")).toBeInTheDocument();
    expect(screen.getByTestId("premium-card-value").textContent).toBe("97,610원");
    expect(screen.getByTestId("drop-month-card").textContent).toContain(
      "올해 안에는 기준을 넘지 않을 것으로 보여요",
    );

    fireEvent.click(screen.getByText("시뮬레이션 해보기"));

    expect(mockNavigate).toHaveBeenCalledWith("/simulate", { state: { year: 2026 } });
    expect(getReportUnlock()).toBeNull();
  });
});
