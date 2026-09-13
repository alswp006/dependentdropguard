import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { getRecord, getRecords } from "@/storage/records";
import type { RecordsStore } from "@/lib/types";
import History from "@/pages/History";

/**
 * Packet 0014: HistoryPage — 연도 탭·월별 목록·누적·추이·삭제 (/history)
 *
 * - Tab으로 올해/작년 전환, 선택된 연도의 월별 기록을 ListRow로 표시
 * - 누적 실제 합계(salary+side+other) 표시, 기록 2건 이상이면 Sparkline 표시
 * - 행 클릭 → '/record' (state: {month, from:'history'})
 * - 삭제 버튼 → AlertDialog('닫기'/'삭제') → 삭제 시 Toast + 목록에서 제거
 * - state.savedMonth로 진입 시 해당 연도 탭 선택 + Toast, 기록 0건이면 빈 상태
 */

mockTds();
mockAppsInToss();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const { mockNavigate: navSpy } = await import("@/__tests__/__helpers__/mocks");
  return { ...actual, useNavigate: () => navSpy };
});

const NOW = new Date("2026-09-14T12:00:00");

function seedRecords(items: RecordsStore["items"]) {
  localStorage.setItem("ddg:records:v1", JSON.stringify({ version: 1, items }));
}

function makeRecord(
  month: string,
  overrides: Partial<{ salaryIncome: number; sideIncome: number; otherIncome: number; memo: string }> = {},
) {
  return {
    month,
    salaryIncome: overrides.salaryIncome ?? 0,
    sideIncome: overrides.sideIncome ?? 0,
    otherIncome: overrides.otherIncome ?? 0,
    memo: overrides.memo ?? "",
    updatedAt: `${month}-01T00:00:00.000Z`,
  };
}

async function renderHistory(state: { savedMonth: string } | null = null) {
  return renderWithProviders(React.createElement(History), { route: "/history", state });
}

describe("HistoryPage — 연도 탭·월별 목록·누적·추이·삭제 (/history)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-1[P0]: 2026-01·2026-08·2025-12 기록이 있으면 기본 탭 '2026년'에 행 2개, '2025년' 탭에 행 1개('2025년 12월')가 보인다", async () => {
    seedRecords([makeRecord("2026-01"), makeRecord("2026-08"), makeRecord("2025-12")]);

    await renderHistory();

    expect(screen.getByRole("tab", { name: "2026년" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(2);
    expect(screen.getByText("1월")).toBeInTheDocument();
    expect(screen.getByText("8월")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "2025년" }));

    expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(1);
    expect(screen.getByText("2025년 12월")).toBeInTheDocument();
  });

  it("AC-2: 2026-01 salary 1,000,000과 2026-08 side 500,000이면 누적 '1,500,000원'이 보이고, 기록이 2건 이상일 때만 Sparkline이 렌더된다", async () => {
    seedRecords([
      makeRecord("2026-01", { salaryIncome: 1_000_000 }),
      makeRecord("2026-08", { sideIncome: 500_000 }),
      makeRecord("2025-12", { salaryIncome: 900_000 }),
    ]);

    await renderHistory();

    expect(screen.getByText("1,500,000원")).toBeInTheDocument();
    expect(screen.getByTestId("history-sparkline")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "2025년" }));

    // 2025년엔 기록이 1건뿐이므로 Sparkline이 렌더되지 않는다.
    expect(screen.queryByTestId("history-sparkline")).not.toBeInTheDocument();
  });

  it("AC-3[P0]: '8월' 행을 클릭하면 pathname '/record', state {month:'2026-08', from:'history'}이다", async () => {
    seedRecords([makeRecord("2026-01"), makeRecord("2026-08")]);

    await renderHistory();

    fireEvent.click(screen.getByText("8월"));

    expect(mockNavigate).toHaveBeenCalledWith("/record", {
      state: { month: "2026-08", from: "history" },
    });
  });

  it("AC-4[P0]: 삭제 → AlertDialog에서 '닫기'를 누르면 기록 수가 유지되고, '삭제'를 누르면 getRecord('2026-08') === null, 행이 사라지고 Toast가 보인다", async () => {
    seedRecords([makeRecord("2026-01"), makeRecord("2026-08")]);

    await renderHistory();

    const row = screen.getByTestId("history-row-2026-08");
    fireEvent.click(within(row).getByRole("button", { name: /삭제/ }));

    let dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(getRecords()).toHaveLength(2);
    expect(getRecord("2026-08")).not.toBeNull();
    expect(mockNavigate).not.toHaveBeenCalledWith("/record", expect.anything());

    fireEvent.click(within(screen.getByTestId("history-row-2026-08")).getByRole("button", { name: /삭제/ }));
    dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(getRecord("2026-08")).toBeNull();
    expect(getRecords()).toHaveLength(1);
    expect(screen.queryByTestId("history-row-2026-08")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("AC-5[P0]: state {savedMonth:'2025-12'}로 진입하면 '2025년' 탭이 선택되어 있고, 기록 0건이면 빈 상태 CTA '소득 입력하기'가 보인다", async () => {
    seedRecords([makeRecord("2025-12")]);

    await renderHistory({ savedMonth: "2025-12" });

    expect(screen.getByRole("tab", { name: "2025년" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("2025년 12월 소득을 저장했어요")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "2026년" }));

    expect(screen.getByTestId("history-empty-state")).toBeInTheDocument();
    fireEvent.click(screen.getByText("소득 입력하기"));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/record",
      expect.objectContaining({ state: expect.objectContaining({ from: "history" }) }),
    );
  });
});
