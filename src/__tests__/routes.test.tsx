import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import type { UserProfile } from "@/lib/types";
import { AppRoutes } from "@/App";

// 실제 라우팅(리다이렉트/탭 클릭 이동)을 검증하므로 mockRouter()는 쓰지 않는다.
mockTds();
mockAppsInToss();

function seedProfile() {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  localStorage.setItem("ddg:profile:v1", JSON.stringify(profile));
}

function LocationDisplay() {
  return <div data-testid="location-display">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationDisplay />
      <AppRoutes />
    </MemoryRouter>,
  );
}

/** 하단 FloatingTabBar의 탭만 — 기록 화면의 연도 Tab은 제외 */
function mainTabs() {
  const nav = screen.queryByRole("tablist", { name: "메인 네비게이션" });
  return nav ? within(nav).getAllByRole("tab") : [];
}

describe("routes: AppRoutes + TabLayout", () => {
  beforeEach(() => {
    seedProfile();
  });

  it("AC-1: 알 수 없는 경로는 '/'로 보낸다", () => {
    renderAt("/unknown");
    expect(screen.getByTestId("location-display").textContent).toBe("/");
    expect(mainTabs()).toHaveLength(4);
  });

  it.each(["/", "/history", "/simulate", "/settings"])("AC-2: %s 에는 탭바 4개가 보인다", (path) => {
    renderAt(path);
    expect(mainTabs().map((t) => t.textContent)).toEqual(["홈", "기록", "시뮬레이션", "설정"]);
  });

  it.each(["/profile", "/record", "/report"])("AC-2: %s 에는 탭바가 없다", (path) => {
    renderAt(path);
    expect(mainTabs()).toHaveLength(0);
  });

  it("AC-3: '설정' 탭을 누르면 /settings로 이동하고 활성 탭이 바뀐다", async () => {
    renderAt("/");
    expect(screen.getByRole("tab", { name: "홈" }).getAttribute("aria-selected")).toBe("true");
    await act(async () => {
      screen.getByRole("tab", { name: "설정" }).click();
    });
    expect(screen.getByTestId("location-display").textContent).toBe("/settings");
    expect(screen.getByRole("tab", { name: "설정" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "홈" }).getAttribute("aria-selected")).toBe("false");
  });

  it("AC-4: App.tsx는 자체 Router를 만들지 않는다", () => {
    const mainSrc = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf-8");
    const appSrc = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf-8");
    expect(mainSrc).toContain("BrowserRouter");
    expect(appSrc).not.toMatch(/\b(BrowserRouter|MemoryRouter|HashRouter)\b/);
  });
});
