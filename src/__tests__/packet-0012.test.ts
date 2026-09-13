import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import {
  mockTds,
  mockAppsInToss,
  mockRouter,
  mockNavigate,
  mockLocation,
} from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { AppDataProvider } from "@/state/AppDataContext";
import type { AppSettings, MonthlyIncomeRecord, RecordsStore, UserProfile } from "@/lib/types";

mockTds();
mockAppsInToss();
mockRouter();

// AdSlot 자체는 별도 컴포넌트 계약 — HomePage 테스트에서는 렌더 여부/개수만 확인하면 되므로
// 가벼운 스텁으로 대체(TossAds 임퍼러티브 세부사항과 분리).
vi.mock("@/components/AdSlot", () => ({
  AdSlot: () => React.createElement("div", { "data-testid": "adslot-stub" }),
}));

const PROFILE_KEY = "ddg:profile:v1";
const RECORDS_KEY = "ddg:records:v1";
const SETTINGS_KEY = "ddg:settings:v1";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    version: 1,
    hasBusinessRegistration: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRecord(month: string, salaryIncome: number): MonthlyIncomeRecord {
  return {
    month,
    salaryIncome,
    sideIncome: 0,
    otherIncome: 0,
    memo: "",
    updatedAt: `${month}-01T00:00:00.000Z`,
  };
}

function seedProfile(profile: UserProfile | null) {
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function seedRecords(records: MonthlyIncomeRecord[]) {
  const store: RecordsStore = { version: 1, items: records };
  localStorage.setItem(RECORDS_KEY, JSON.stringify(store));
}

function seedSettings(overrides: Partial<AppSettings> = {}) {
  const settings: AppSettings = {
    version: 1,
    reminderEnabled: true,
    dismissedReminderMonth: null,
    ...overrides,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function renderHome(Home: React.ComponentType) {
  return renderWithRouter(
    React.createElement(AppDataProvider, null, React.createElement(Home)),
  );
}

let Home: React.ComponentType;

beforeAll(async () => {
  Home = (await import("@/pages/Home")).default;
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockLocation.state = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HomePage — 진단 대시보드·빈 상태·저장 Toast·배너 광고 (/)", () => {
  it("AC-1[P0]: profile이 없으면 '/profile'로 replace 이동하고 state.mode는 'onboarding'이다", async () => {
    renderHome(Home);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockNavigate.mock.calls[0][0]).toBe("/profile");
    expect(mockNavigate.mock.calls[0][1]).toEqual({ replace: true, state: { mode: "onboarding" } });
  });

  it("AC-1[P0]: profile이 있으면 '/profile'로 이동하지 않는다", async () => {
    seedProfile(makeProfile());
    seedRecords([]);

    renderHome(Home);

    // 마운트 직후 잠깐의 여유를 두고도 profile 리다이렉트가 없어야 한다.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).not.toHaveBeenCalledWith("/profile", expect.anything());
  });

  it("AC-2: 미등록 사업자 + 2026-01·02 각 170만원 소득이면 탈락 위험 진단이 보이고, 리포트 보기 클릭 시 '/report'로 연도와 함께 이동한다", async () => {
    seedProfile(makeProfile({ hasBusinessRegistration: false }));
    seedRecords([makeRecord("2026-01", 1_700_000), makeRecord("2026-02", 1_700_000)]);

    renderHome(Home);

    expect(screen.getByText("탈락 위험")).toBeInTheDocument();
    expect(screen.getByText(/20,400,000원/)).toBeInTheDocument();
    expect(screen.getByText("연간 합산 소득이 2,000만원을 넘어요")).toBeInTheDocument();

    screen.getByText("상세 리포트 보기").click();

    expect(mockNavigate).toHaveBeenCalledWith("/report", expect.objectContaining({ state: { year: 2026 } }));
  });

  it("AC-3: profile은 있지만 2026년 기록이 0건이면 빈 상태와 '소득 입력하기' 버튼이 보이고, 클릭 시 '/record'로 대상 월과 함께 이동한다", async () => {
    seedProfile(makeProfile());
    seedRecords([]);

    renderHome(Home);

    expect(screen.getByTestId("home-empty-state")).toBeInTheDocument();

    screen.getByText("소득 입력하기").click();

    expect(mockNavigate).toHaveBeenCalledWith(
      "/record",
      expect.objectContaining({ state: { month: "2026-08", from: "home" } }),
    );
  });

  it("AC-4: state.savedMonth='2026-08'이면 저장 Toast가 1회 보이고, 리마인더 배너 닫기를 누르면 설정이 저장되며 배너가 사라진다", async () => {
    seedProfile(makeProfile());
    seedRecords([]);
    seedSettings();
    mockLocation.state = { savedMonth: "2026-08" } as unknown as null;

    renderHome(Home);

    expect(screen.getAllByText("8월 소득을 저장했어요")).toHaveLength(1);
    expect(screen.getByTestId("reminder-banner")).toBeInTheDocument();

    screen.getByText("닫기").click();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
      expect(stored.dismissedReminderMonth).toBe("2026-08");
    });
    expect(screen.queryByTestId("reminder-banner")).not.toBeInTheDocument();
  });

  it("AC-5: VITE_TOSS_AD_GROUP_ID가 있으면 광고 슬롯이 1개, 없으면 0개 렌더된다", async () => {
    seedProfile(makeProfile());
    seedRecords([]);

    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "test-ad-group-1");
    const { unmount } = renderHome(Home);
    expect(screen.getAllByTestId("home-ad-slot")).toHaveLength(1);
    unmount();

    vi.stubEnv("VITE_TOSS_AD_GROUP_ID", "");
    renderHome(Home);
    expect(screen.queryAllByTestId("home-ad-slot")).toHaveLength(0);
  });
});
