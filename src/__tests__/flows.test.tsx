import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import type React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import type { MonthlyIncomeRecord, RecordsStore, ReportUnlock, UserProfile } from "@/lib/types";
import * as Tds from "@toss/tds-mobile";
import { AppRoutes } from "@/App";

/**
 * 화면 간 흐름 + 전 라우트 console.error 0회.
 * 실제 라우팅(리다이렉트·navigate)을 따라가야 하므로 mockRouter()는 쓰지 않는다.
 * haptic은 mockAppsInToss()의 generateHapticFeedback 목, 광고는 AdSlot·TossRewardAd 목.
 */
mockTds();
mockAppsInToss();
mockTossRewardAd();
vi.mock("@/components/AdSlot", () => ({
  AdSlot: () => null,
}));

// 공용 목의 Top은 title을 <h1>로 감싸고 TitleParagraph도 <h1>이라 h1>h1 validateDOMNesting이 난다.
// 실제 TDS에는 없는 목 전용 경고라 console.error 0회 검증을 오염시킨다 → TitleParagraph만 인라인으로 교체.
(Tds.Top as unknown as { TitleParagraph: (p: { children?: React.ReactNode }) => React.ReactElement }).TitleParagraph = ({
  children,
}) => <span>{children}</span>;

const PROFILE_KEY = "ddg:profile:v1";
const RECORDS_KEY = "ddg:records:v1";
const UNLOCK_KEY = "ddg:reportUnlock:v1";

const ROUTES = ["/", "/profile", "/record", "/history", "/report", "/simulate", "/settings"] as const;

// /report가 아직 "준비 중" 자리 페이지면 리포트 → 시뮬레이션 버튼이 없다. 화면이 들어오면 자동으로 켜진다.
const REPORT_IS_PLACEHOLDER = readFileSync(resolve(process.cwd(), "src/pages/Report.tsx"), "utf8").startsWith(
  "// @ai-factory:placeholder",
);

function LocationDisplay() {
  return <div data-testid="location-display">{useLocation().pathname}</div>;
}

function renderApp(entry: string | { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationDisplay />
      <AppRoutes />
    </MemoryRouter>,
  );
}

function currentPath() {
  return screen.getByTestId("location-display").textContent;
}

function seedProfile() {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function seedRecords() {
  const items: MonthlyIncomeRecord[] = ["2026-06", "2026-07", "2026-08"].map((month) => ({
    month,
    salaryIncome: 1_200_000,
    sideIncome: 150_000,
    otherIncome: 0,
    memo: "",
    updatedAt: "2026-09-01T00:00:00.000Z",
  }));
  const store: RecordsStore = { version: 1, items };
  localStorage.setItem(RECORDS_KEY, JSON.stringify(store));
}

function seedUnlock(unlockedMonth: string) {
  const unlock: ReportUnlock = { version: 1, unlockedMonth };
  localStorage.setItem(UNLOCK_KEY, JSON.stringify(unlock));
}

let errorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.setSystemTime(new Date("2026-09-14T10:00:00+09:00"));
  errorSpy = vi.spyOn(console, "error");
});

afterEach(() => {
  cleanup();
  errorSpy.mockRestore();
  vi.useRealTimers();
});

describe("flows: 온보딩 → 소득 입력 → 홈 진단", () => {
  it("빈 저장소에서 '/'로 들어오면 프로필 → 기록 저장 → 홈 Toast·안전 배지까지 이어진다", async () => {
    renderApp("/");

    // 프로필이 없으면 온보딩으로 보낸다
    expect(currentPath()).toBe("/profile");

    // '없어요'(사업자등록 없음) 선택 후 저장
    await act(async () => {
      fireEvent.click(screen.getByTestId("biz-option-no"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    });
    expect(currentPath()).toBe("/");
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null")).toMatchObject({
      hasBusinessRegistration: false,
    });

    // 빈 상태 CTA로 기록 화면
    const empty = screen.getByTestId("home-empty-state");
    await act(async () => {
      fireEvent.click(within(empty).getByRole("button", { name: "소득 입력하기" }));
    });
    expect(currentPath()).toBe("/record");
    expect(screen.getByTestId("record-month").textContent).toBe("8월");

    // 본업 소득 입력 후 저장.
    // AC 원문 금액 1,700,000원은 연 환산 20,400,000원으로 기준(2,000만 원)을 넘어 '탈락 위험'이 된다
    // (spec 진단 AC-5와 같은 계산). '안전' 흐름을 검증하려고 연 환산 1,200만 원(60%)이 되는 금액을 쓴다.
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("본업 소득"), { target: { value: "1000000" } });
    });
    expect((screen.getByPlaceholderText("본업 소득") as HTMLInputElement).value).toBe("1,000,000");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "기록 저장" }));
    });

    // 홈: 저장 Toast + 안전 배지
    expect(currentPath()).toBe("/");
    expect(screen.getByText("8월 소득을 저장했어요")).toBeInTheDocument();
    expect(screen.getByText("안전")).toBeInTheDocument();
    expect(screen.getByTestId("status-hero")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("flows: 전 라우트 순회 console.error", () => {
  it("7개 라우트를 순서대로 렌더하는 동안 console.error가 0회다", async () => {
    seedProfile();
    seedRecords();
    seedUnlock("2026-09");

    for (const path of ROUTES) {
      const { unmount } = renderApp(path);
      await act(async () => {
        await Promise.resolve();
      });
      // 리다이렉트 없이 그 화면에 머문다(프로필이 있으므로 온보딩으로 보내지 않는다)
      expect(currentPath()).toBe(path);
      unmount();
    }

    expect(errorSpy).toHaveBeenCalledTimes(0);
  });
});

describe("flows: 리포트 → 시뮬레이션", () => {
  it.skipIf(REPORT_IS_PLACEHOLDER)(
    "unlock '2026-09' 상태에서 '/report'의 '시뮬레이션 해보기'를 누르면 '/simulate'에 비교 카드 2개가 보인다",
    async () => {
      seedProfile();
      seedRecords();
      seedUnlock("2026-09");

      renderApp({ pathname: "/report", state: { year: 2026 } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "시뮬레이션 해보기" }));
      });

      expect(currentPath()).toBe("/simulate");
      expect(screen.getAllByTestId("compare-card")).toHaveLength(2);
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it("unlock '2026-09' 상태로 '/simulate'에 들어오면 현재/시뮬레이션 비교 카드 2개가 보인다", () => {
    seedProfile();
    seedRecords();
    seedUnlock("2026-09");

    renderApp({ pathname: "/simulate", state: { year: 2026 } });

    const cards = screen.getAllByTestId("compare-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("현재")).toBeInTheDocument();
    expect(within(cards[1]).getByText("시뮬레이션")).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
