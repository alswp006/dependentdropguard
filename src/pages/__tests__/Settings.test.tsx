import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AppDataProvider, useAppData } from "@/state/AppDataContext";
import { getSettings } from "@/storage/settings";
import { buildRuleDescriptions, RULES, DISCLAIMER_TEXT } from "@/domain/rules";
import type { UserProfile, MonthlyIncomeRecord } from "@/lib/types";
import Settings from "@/pages/Settings";

/**
 * Packet 0018: SettingsPage — 사업자 행·리마인더·전체 삭제·면책 (/settings)
 *
 * - row-biz: 사업자등록 여부(있음/없음/미설정) 표시, 클릭 시 /profile(state:{mode:'edit'})
 * - reminder-switch: 켜짐/꺼짐 즉시 저장(ddg:settings:v1)
 * - row-rules: RulesSheet 오픈(계산 기준 6행)
 * - row-reset: AlertDialog('닫기'/'삭제') → 전체 삭제(ddg:* 4키) + Toast
 * - removeItem 실패 시 삭제 실패 Toast, 메모리 상태(records) 보존
 * - DISCLAIMER_TEXT 전문 노출
 */

mockTds();
mockAppsInToss();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const { mockNavigate: navSpy } = await import("@/__tests__/__helpers__/mocks");
  return { ...actual, useNavigate: () => navSpy };
});

const PROFILE_KEY = "ddg:profile:v1";
const RECORDS_KEY = "ddg:records:v1";
const SETTINGS_KEY = "ddg:settings:v1";
const REPORTS_KEY = "ddg:reports:v1";

function seedProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

function seedRecords(items: MonthlyIncomeRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ version: 1, items }));
}

function makeRecord(month: string): MonthlyIncomeRecord {
  return {
    month,
    salaryIncome: 1_000_000,
    sideIncome: 0,
    otherIncome: 0,
    memo: "",
    updatedAt: `${month}-01T00:00:00.000Z`,
  };
}

// AppDataContext.records를 화면 밖에서 관찰하기 위한 프로브 — clearAll 실패 시
// "메모리 상태가 그대로다"를 UI 텍스트가 아닌 컨텍스트 값으로 직접 검증한다.
function RecordsProbe() {
  const { records } = useAppData();
  return React.createElement("span", { "data-testid": "probe-records-count" }, records.length);
}

function renderSettings() {
  return renderWithProviders(React.createElement(Settings), { route: "/settings" });
}

describe("SettingsPage — 사업자 행·리마인더·전체 삭제·면책 (/settings)", () => {
  it("AC-1: profile이 없으면 row-biz는 '미설정'을 보여주고, 클릭하면 '/profile'로 state {mode:'edit'}과 함께 이동한다", () => {
    renderSettings();

    const row = screen.getByTestId("row-biz");
    expect(within(row).getByText("미설정")).toBeInTheDocument();

    fireEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith("/profile", { state: { mode: "edit" } });
  });

  it("AC-1: hasBusinessRegistration이 true인 profile이 있으면 row-biz는 '있음'을 보여준다", () => {
    seedProfile({ hasBusinessRegistration: true });

    renderSettings();

    expect(within(screen.getByTestId("row-biz")).getByText("있음")).toBeInTheDocument();
  });

  it("AC-2: reminder-switch를 끄면 ddg:settings:v1의 reminderEnabled가 false로 저장되고, 재마운트해도 꺼진 채로 렌더된다", () => {
    const { unmount } = renderSettings();

    const switchEl = screen.getByTestId("reminder-switch") as HTMLInputElement;
    expect(switchEl.checked).toBe(true);

    fireEvent.click(switchEl);

    expect(getSettings().reminderEnabled).toBe(false);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) as string);
    expect(stored.reminderEnabled).toBe(false);
    expect(stored.version).toBe(1);

    unmount();
    renderSettings();

    expect((screen.getByTestId("reminder-switch") as HTMLInputElement).checked).toBe(false);
  });

  it("AC-3: row-rules를 클릭하면 계산 기준 문구 6행이 모두 보인다", () => {
    renderSettings();

    fireEvent.click(screen.getByTestId("row-rules"));

    const sheet = screen.getByRole("dialog");
    const lines = buildRuleDescriptions(RULES);
    expect(lines).toHaveLength(6);
    for (const line of lines) {
      expect(within(sheet).getByText(line)).toBeInTheDocument();
    }
  });

  it("AC-4: row-reset → '닫기'를 누르면 ddg:records:v1이 그대로 남는다", () => {
    seedRecords([makeRecord("2026-01")]);

    renderSettings();

    fireEvent.click(screen.getByTestId("row-reset"));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(RECORDS_KEY) as string);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].month).toBe("2026-01");
  });

  it("AC-4: row-reset → '삭제'를 누르면 ddg:* 4개 키가 모두 null이 되고 row-biz는 '미설정', 삭제 완료 Toast가 보인다", () => {
    seedProfile({ hasBusinessRegistration: true });
    seedRecords([makeRecord("2026-01")]);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, reminderEnabled: true, dismissedReminderMonth: null }));
    localStorage.setItem(REPORTS_KEY, JSON.stringify({ version: 1, unlockedMonth: "2026-01" }));

    renderSettings();

    fireEvent.click(screen.getByTestId("row-reset"));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(RECORDS_KEY)).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(localStorage.getItem(REPORTS_KEY)).toBeNull();

    expect(within(screen.getByTestId("row-biz")).getByText("미설정")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("AC-5: removeItem이 throw하면 삭제 실패 Toast가 보이고 records는 메모리 상태 그대로다", () => {
    seedRecords([makeRecord("2026-01")]);

    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("removeItem failed");
    });

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [{ pathname: "/settings", state: null }] },
        React.createElement(
          AppDataProvider,
          null,
          React.createElement(Settings),
          React.createElement(RecordsProbe),
        ),
      ),
    );

    expect(screen.getByTestId("probe-records-count").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("row-reset"));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByTestId("probe-records-count").textContent).toBe("1");

    removeItemSpy.mockRestore();
  });

  it("AC-5: 화면에 DISCLAIMER_TEXT 전문이 보인다", () => {
    renderSettings();

    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });
});
