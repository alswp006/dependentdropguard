import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { mockTds } from "@/__tests__/__helpers__/mocks";
import type { DiagnosisResult, DiagnosisStatus, AnnualSummary } from "@/lib/types";

mockTds();

// 동적 import — mockTds() 훅 이후에 로드되도록 각 테스트에서 개별 import
async function loadModule() {
  return import("@/components/simulate/CompareCard");
}

function makeSummary(totalAnnual: number, overrides: Partial<AnnualSummary> = {}): AnnualSummary {
  return {
    year: 2026,
    recordedMonths: 3,
    actualTotal: totalAnnual,
    salaryAnnual: totalAnnual,
    sideAnnual: 0,
    otherAnnual: 0,
    totalAnnual,
    ...overrides,
  };
}

function makeResult(
  status: DiagnosisStatus,
  totalAnnual: number,
  overrides: Partial<DiagnosisResult> = {},
): DiagnosisResult {
  return {
    year: 2026,
    status,
    reasons: status === "DROP" ? ["TOTAL_INCOME"] : [],
    summary: makeSummary(totalAnnual),
    marginToDrop: status === "DROP" ? 0 : 1_000_000,
    overAmount: status === "DROP" ? totalAnnual - 20_000_000 : 0,
    totalRatioPercent: Math.floor((totalAnnual * 100) / 20_000_000),
    ...overrides,
  };
}

describe("SimulatePage 부품 — 현재/시뮬레이션 비교 카드 (CompareCard)", () => {
  it("AC-1[P0]: DROP 결과(연 20,400,000원)는 탈락 위험 배지·연 합계·월 예상 보험료를 보여준다", async () => {
    const { CompareCard } = await loadModule();
    const dropResult = makeResult("DROP", 20_400_000);

    render(React.createElement(CompareCard, { title: "시뮬레이션", result: dropResult }));

    const card = screen.getByTestId("compare-card");
    expect(card.textContent).toContain("탈락 위험");
    expect(card.textContent).toContain("연 20,400,000원");
    expect(card.textContent).toContain("월 예상 보험료 138,290원");
  });

  it("AC-2[P0]: SAFE 결과는 '보험료 0원 (피부양자 유지)'를 보여주고 '월 예상 보험료' 문구는 없다", async () => {
    const { CompareCard } = await loadModule();
    const safeResult = makeResult("SAFE", 14_400_000);

    render(React.createElement(CompareCard, { title: "현재", result: safeResult }));

    const card = screen.getByTestId("compare-card");
    expect(card.textContent).toContain("보험료 0원 (피부양자 유지)");
    expect(card.textContent).not.toContain("월 예상 보험료");
  });

  it("AC-2: WARNING 결과도 SAFE와 동일하게 보험료 0원 문구를 보여준다", async () => {
    const { CompareCard } = await loadModule();
    const warningResult = makeResult("WARNING", 17_400_000);

    render(React.createElement(CompareCard, { title: "현재", result: warningResult }));

    const card = screen.getByTestId("compare-card");
    expect(card.textContent).toContain("보험료 0원 (피부양자 유지)");
    expect(card.textContent).not.toContain("월 예상 보험료");
  });

  it("AC-3[P0]: result가 null이면 '안전'과 '연 0원'을 보여준다", async () => {
    const { CompareCard } = await loadModule();

    render(React.createElement(CompareCard, { title: "시뮬레이션", result: null }));

    const card = screen.getByTestId("compare-card");
    expect(card.textContent).toContain("안전");
    expect(card.textContent).toContain("연 0원");
  });

  it("AC-4: 루트에 data-testid='compare-card'가 있고 title '현재'가 보인다", async () => {
    const { CompareCard } = await loadModule();
    const safeResult = makeResult("SAFE", 14_400_000);

    render(React.createElement(CompareCard, { title: "현재", result: safeResult }));

    expect(screen.getByTestId("compare-card")).toBeInTheDocument();
    expect(screen.getByText("현재")).toBeInTheDocument();
  });

  it("AC-4: title '시뮬레이션'도 그대로 보인다", async () => {
    const { CompareCard } = await loadModule();
    const dropResult = makeResult("DROP", 20_400_000);

    render(React.createElement(CompareCard, { title: "시뮬레이션", result: dropResult }));

    expect(screen.getByText("시뮬레이션")).toBeInTheDocument();
  });
});
