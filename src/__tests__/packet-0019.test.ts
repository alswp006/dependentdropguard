import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import type { UserProfile } from "@/lib/types";

// 이 테스트는 실제 라우팅(리다이렉트/탭바 클릭 내비게이션)을 검증하므로
// mockRouter()(useNavigate/useLocation을 고정값으로 대체)는 쓰지 않는다.
mockTds();
mockAppsInToss();

const PROFILE_KEY = "ddg:profile:v1";

function seedProfile() {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function LocationDisplay() {
  const location = useLocation();
  return React.createElement("div", { "data-testid": "location-display" }, location.pathname);
}

async function renderAppRoutes(initialPath: string) {
  const { AppRoutes } = await import("@/App");
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(LocationDisplay),
      React.createElement(AppRoutes),
    ),
  );
}

// 하단 FloatingTabBar(nav[aria-label="메인 네비게이션"])의 탭만 센다 — 기록 화면은 자체 연도 Tab(role=tab)도 가진다.
function mainTabs() {
  const nav = screen.queryByRole("tablist", { name: "메인 네비게이션" });
  return nav ? within(nav).getAllByRole("tab") : [];
}

const TAB_ROUTES = ["/", "/history", "/simulate", "/settings"];
const TAB_LABELS = ["홈", "기록", "시뮬레이션", "설정"];
const NO_TAB_ROUTES = ["/profile", "/record", "/report"];

describe("라우팅 연결 + 탭바 레이아웃 + Provider 배선 (App.tsx)", () => {
  beforeEach(() => {
    seedProfile();
  });

  it("AC-1[P0]: 알 수 없는 경로('/unknown')는 홈('/')으로 리다이렉트된다(profile 있음)", async () => {
    await renderAppRoutes("/unknown");
    expect(screen.getByTestId("location-display").textContent).toBe("/");
    // catch-all이 홈으로 보냈으므로 탭바(홈 탭 포함)가 보여야 한다.
    expect(mainTabs()).toHaveLength(4);
  });

  it.each(TAB_ROUTES)("AC-2[P0]: %s 에서는 탭바 4개(홈/기록/시뮬레이션/설정)가 보인다", async (path) => {
    await renderAppRoutes(path);
    const tabs = mainTabs();
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(TAB_LABELS);
  });

  it.each(NO_TAB_ROUTES)("AC-2[P0]: %s 에서는 탭바가 숨겨진다(0개)", async (path) => {
    await renderAppRoutes(path);
    expect(mainTabs()).toHaveLength(0);
  });

  it("AC-3[P0]: 탭바의 '설정'을 클릭하면 '/settings'로 이동하고 활성 탭이 '설정'이 된다", async () => {
    await renderAppRoutes("/");
    // react-router 7 MemoryRouter는 내비게이션을 startTransition으로 반영하므로 act로 flush한다.
    await act(async () => {
      screen.getByRole("tab", { name: "설정" }).click();
    });

    expect(screen.getByTestId("location-display").textContent).toBe("/settings");
    const settingsTab = screen.getByRole("tab", { name: "설정" });
    expect(settingsTab.getAttribute("aria-selected")).toBe("true");
    const homeTab = screen.getByRole("tab", { name: "홈" });
    expect(homeTab.getAttribute("aria-selected")).toBe("false");
  });

  it("AC-4[P1]: main.tsx는 그대로 BrowserRouter 하나만 두고, App.tsx는 중복 Router를 만들지 않는다", () => {
    const mainSrc = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf-8");
    const appSrc = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf-8");

    // main.tsx는 이 패킷의 소유가 아니다 — BrowserRouter 배선이 남아있어야 한다.
    expect(mainSrc).toContain("BrowserRouter");
    // App.tsx가 자체 Router를 만들면 main.tsx의 BrowserRouter와 중첩되어 라우팅이 깨진다.
    expect(appSrc).not.toMatch(/\b(BrowserRouter|MemoryRouter|HashRouter)\b/);
  });
});
