import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AppDataProvider } from "@/state/AppDataContext";
import { getReportUnlock } from "@/storage/reportUnlock";
import { ReportUnlockManager } from "@/pages/ReportUnlockManager";

/**
 * Packet: ReportPage — 보상형 광고 게이트 상세 리포트 (/report), 잠금·해제 로직 절반
 *
 * ReportUnlockManager.tsx는 이번 달 열람 여부 판정 + 보상형 광고 시청 플로우 +
 * saveReportUnlock 호출만 책임진다(렌더링 조립은 Report.tsx가 전담 — Report.test.tsx 참조).
 * children은 "잠금 해제됐을 때 보여줄 리포트 본문"의 자리표시자로 넘긴다.
 *
 * @apps-in-toss/web-framework는 이 파일에서 직접(fine-grained) 목킹한다 — 공용
 * mockAppsInToss()의 loadFullScreenAd/showFullScreenAd는 항상 성공(rewarded)만
 * 자동 발화해 로드 실패·중도 이탈 시나리오(AC-6/AC-7)를 재현할 수 없기 때문이다.
 *
 * @toss/tds-mobile도 공용 mockTds() 대신 이 파일에서 직접 목킹한다 — mockTds/mockAppsInToss는
 * 같은 mocks.ts 파일에 있고, vitest의 vi.mock 호이스팅은 "파일 전체"를 정적 스캔하므로
 * mockTds만 import해도 그 파일에 적힌 mockAppsInToss()의 vi.mock("@apps-in-toss/web-framework", ...)
 * 까지 함께 호이스팅돼 아래의 fine-grained 목을 덮어써 버린다(mocks.ts의 mockRouter가 vi.doMock을
 * 쓰는 이유와 동일한 함정 — 적대 리뷰 실측).
 */

const sdk = vi.hoisted(() => ({
  loadFullScreenAd: vi.fn(),
  showFullScreenAd: vi.fn(),
}));

vi.mock("@apps-in-toss/web-framework", () => ({
  loadFullScreenAd: (...args: unknown[]) => (sdk.loadFullScreenAd as (...a: unknown[]) => void)(...args),
  showFullScreenAd: (...args: unknown[]) => (sdk.showFullScreenAd as (...a: unknown[]) => void)(...args),
  generateHapticFeedback: vi.fn(),
}));

vi.mock("@toss/tds-mobile", () => ({
  Badge: ({ children }: any) => React.createElement("span", { role: "status" }, children),
  Paragraph: {
    Text: ({ children, typography, ...props }: any) =>
      React.createElement("span", { "data-typography": typography, ...props }, children),
  },
  Spacing: ({ size }: any) => React.createElement("div", { "data-spacing": size }),
  Button: ({ children, onClick, ...props }: any) =>
    React.createElement("button", { onClick, ...props }, children),
}));

const NOW = new Date("2026-09-14T12:00:00");
const UNLOCK_KEY = "ddg:reportUnlock:v1";
const UNLOCKED_CONTENT_TESTID = "unlocked-content";

function renderManager(statusLabel = "탈락 위험") {
  return render(
    React.createElement(
      AppDataProvider,
      null,
      React.createElement(
        ReportUnlockManager,
        { statusLabel },
        React.createElement("div", { "data-testid": UNLOCKED_CONTENT_TESTID }, "리포트 본문"),
      ),
    ),
  );
}

describe("ReportUnlockManager — 이번 달 열람 판정·보상형 광고·saveReportUnlock (/report)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    sdk.loadFullScreenAd.mockReset();
    sdk.showFullScreenAd.mockReset();
  });

  it("AC-2[P0]: 이번 달('2026-09') unlock 기록이 있으면 광고를 불러오지 않고 children을 바로 렌더한다", () => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({ version: 1, unlockedMonth: "2026-09" }));

    renderManager();

    expect(screen.getByTestId(UNLOCKED_CONTENT_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId("report-gate")).not.toBeInTheDocument();
    expect(sdk.loadFullScreenAd).not.toHaveBeenCalled();
  });

  it("AC-2[P0]: unlock 기록이 지난달('2026-08')이면 잠금 화면(Badge + 잠긴 항목 3개)이 다시 보인다", () => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({ version: 1, unlockedMonth: "2026-08" }));
    sdk.loadFullScreenAd.mockImplementation((opts: { onEvent?: (e: unknown) => void }) =>
      opts.onEvent?.({ type: "loaded" }),
    );

    renderManager();

    const gate = screen.getByTestId("report-gate");
    expect(within(gate).getByText("탈락 위험")).toBeInTheDocument();
    expect(within(gate).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByTestId(UNLOCKED_CONTENT_TESTID)).not.toBeInTheDocument();
  });

  it("AC-2[P0]: 광고 시청 완료(rewarded)하면 saveReportUnlock('2026-09')가 저장되고 children이 렌더된다", () => {
    sdk.loadFullScreenAd.mockImplementation((opts: { onEvent?: (e: unknown) => void }) =>
      opts.onEvent?.({ type: "loaded" }),
    );
    sdk.showFullScreenAd.mockImplementation((opts: { onEvent?: (e: unknown) => void }) =>
      opts.onEvent?.({ type: "rewarded" }),
    );

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "광고 보고 상세 리포트 열기" }));

    expect(sdk.showFullScreenAd).toHaveBeenCalledTimes(1);
    expect(getReportUnlock()).toEqual({ version: 1, unlockedMonth: "2026-09" });
    expect(screen.getByTestId(UNLOCKED_CONTENT_TESTID)).toBeInTheDocument();
  });

  it("AC-2: 버튼을 연속으로 두 번 눌러도 showFullScreenAd 호출은 1회이고 그동안 버튼은 disabled다", () => {
    sdk.loadFullScreenAd.mockImplementation((opts: { onEvent?: (e: unknown) => void }) =>
      opts.onEvent?.({ type: "loaded" }),
    );
    sdk.showFullScreenAd.mockImplementation(() => {
      // 응답 보류 — 로딩 상태를 유지한 채로 연속 클릭을 재현한다.
    });

    renderManager();
    const button = screen.getByRole("button", { name: "광고 보고 상세 리포트 열기" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(sdk.showFullScreenAd).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(getReportUnlock()).toBeNull();
  });

  it("AC-6[W][P1]: 광고 로드 실패 시 안내 문구와 함께 children이 바로 보이지만 unlock은 저장되지 않는다", () => {
    sdk.loadFullScreenAd.mockImplementation((opts: { onError?: (e: unknown) => void }) =>
      opts.onError?.({ code: "NO_FILL" }),
    );

    renderManager();

    expect(screen.getByText("광고를 불러오지 못했어요. 리포트를 바로 보여드릴게요")).toBeInTheDocument();
    expect(screen.getByTestId(UNLOCKED_CONTENT_TESTID)).toBeInTheDocument();
    expect(getReportUnlock()).toBeNull();
  });

  it("AC-7[W][P1]: 보상 완료 전 광고를 닫으면(dismissed) 잠금 화면이 유지되고 unlock은 저장되지 않는다", () => {
    sdk.loadFullScreenAd.mockImplementation((opts: { onEvent?: (e: unknown) => void }) =>
      opts.onEvent?.({ type: "loaded" }),
    );
    sdk.showFullScreenAd.mockImplementation((opts: { onEvent?: (e: unknown) => void }) =>
      opts.onEvent?.({ type: "dismissed" }),
    );

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "광고 보고 상세 리포트 열기" }));

    expect(screen.getByText("광고를 끝까지 보면 리포트가 열려요")).toBeInTheDocument();
    expect(screen.getByTestId("report-gate")).toBeInTheDocument();
    expect(getReportUnlock()).toBeNull();
  });
});
