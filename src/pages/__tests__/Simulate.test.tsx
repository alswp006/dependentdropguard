import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { AppDataProvider } from "@/state/AppDataContext";
import type { UserProfile } from "@/lib/types";
import Simulate from "@/pages/Simulate";

/**
 * Packet 0016: SimulatePage — 지역가입자 전환 시뮬레이션 (/simulate)
 *
 * - 본업·부업 월 소득 입력 + Chip(+50/100/200만원) + 사업자등록 Switch(저장 안 함)
 * - 입력마다 computeSimulation으로 즉시 재계산 → CompareCard 2장(현재/시뮬레이션)
 * - 10억원 초과 입력은 lastValid ref 값으로 계산
 *
 * TDS는 jsdom에서 충돌하므로 mockTds() 사용. 라우팅 이동을 다루지 않는 화면이라
 * react-router-dom은 실제 MemoryRouter 그대로 쓴다(useNavigate 목킹 불필요).
 */

mockTds();
mockAppsInToss();

const PROFILE_KEY = "ddg:profile:v1";
const RECORDS_KEY = "ddg:records:v1";

function seedProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function seedNoRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, items: [] }));
}

function renderSimulate() {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/simulate"] },
      React.createElement(AppDataProvider, null, React.createElement(Simulate)),
    ),
  );
}

describe("SimulatePage — 지역가입자 전환 시뮬레이션 (/simulate)", () => {
  it("AC-1[P0]: 기록 0건·미등록 profile로 진입하면 최대 안전 부업 금액과 순증가 안내 기본 문구가 보인다", () => {
    seedProfile({ hasBusinessRegistration: false });
    seedNoRecords();

    renderSimulate();

    expect(screen.getByTestId("max-safe-side").textContent).toBe(
      "부업은 월 416,666원까지 피부양자 유지가 가능해요",
    );
    expect(screen.getByTestId("net-gain-value").textContent).toBe(
      "부업 소득을 늘려 비교해보세요",
    );
    expect(screen.getAllByTestId("compare-card")).toHaveLength(2);
  });

  it("AC-2: sim-side가 200,000일 때 '+50만원' Chip을 누르면 700,000, 이어서 '+200만원'을 누르면 2,700,000이고 tickWeak 햅틱이 2회 발생한다", async () => {
    seedProfile({ hasBusinessRegistration: false });
    seedNoRecords();

    const { generateHapticFeedback } = await import("@apps-in-toss/web-framework");
    renderSimulate();

    const sideInput = screen.getByTestId("sim-side") as HTMLInputElement;
    fireEvent.change(sideInput, { target: { value: "200000" } });
    expect(sideInput.value).toBe("200,000");

    fireEvent.click(screen.getByRole("button", { name: "+50만원" }));
    expect(sideInput.value).toBe("700,000");

    fireEvent.click(screen.getByRole("button", { name: "+200만원" }));
    expect(sideInput.value).toBe("2,700,000");

    expect(generateHapticFeedback).toHaveBeenCalledTimes(2);
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
  });

  it("AC-3[P0]: 기록 0건에서 본업 1,600,000원·부업 100,000원을 입력하면 손해 문구와 최대 안전 부업 금액이 정확히 계산된다", () => {
    seedProfile({ hasBusinessRegistration: false });
    seedNoRecords();

    renderSimulate();

    fireEvent.change(screen.getByTestId("sim-salary"), { target: { value: "1600000" } });
    fireEvent.change(screen.getByTestId("sim-side"), { target: { value: "100000" } });

    expect(screen.getByTestId("net-gain-value").textContent).toBe(
      "부업으로 연 1,200,000원 더 벌어도 보험료 연 1,659,480원 때문에 오히려 연 459,480원 손해예요",
    );
    expect(screen.getByTestId("max-safe-side").textContent).toBe(
      "부업은 월 66,666원까지 피부양자 유지가 가능해요",
    );
  });

  it("AC-4: sim-side에 1000000001을 입력하면 10억원 초과 에러 문구가 보이고 시뮬레이션 카드 금액은 직전 유효값 그대로다", () => {
    seedProfile({ hasBusinessRegistration: false });
    seedNoRecords();

    renderSimulate();

    fireEvent.change(screen.getByTestId("sim-side"), { target: { value: "100000" } });
    expect(screen.getByText("연 1,200,000원")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("sim-side"), { target: { value: "1000000001" } });

    expect(screen.getByRole("alert").textContent).toBe("월 소득은 10억원 이하로 입력해주세요");
    expect(screen.getByText("연 1,200,000원")).toBeInTheDocument();
  });

  it("AC-5: sim-biz-switch를 켜면 최대 안전 부업 금액 문구가 사업자등록 경고로 바뀌고 profile은 localStorage에 저장되지 않는다", () => {
    seedProfile({ hasBusinessRegistration: false });
    seedNoRecords();

    renderSimulate();

    const before = localStorage.getItem(PROFILE_KEY);

    fireEvent.click(screen.getByRole("switch"));

    expect(screen.getByTestId("max-safe-side").textContent).toBe(
      "사업자등록 시 부업 소득이 있으면 자격을 잃어요",
    );
    expect(localStorage.getItem(PROFILE_KEY)).toBe(before);
  });
});
