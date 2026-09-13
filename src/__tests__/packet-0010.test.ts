import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { validateAmount } from "@/lib/validation";
import { STATUS_LABEL } from "@/domain/rules";
import { getRecord } from "@/storage/records";
import type { RecordsStore, UserProfile } from "@/lib/types";

mockTds();
mockAppsInToss();

// react-router-dom: useNavigate만 오버라이드하고 useLocation/MemoryRouter는 실제 구현을 유지한다.
// (renderWithProviders가 실제 MemoryRouter로 route+state를 넣어주므로 useLocation은 실제 값을 반영해야 함)
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// 동적 import — mockTds()/mockAppsInToss() 훅 이후에 로드되도록 각 테스트에서 개별 import
async function loadRecordPage() {
  const mod = await import("@/pages/Record");
  return mod.default;
}

const NOW = new Date("2026-09-14T12:00:00");

function seedRecords(items: RecordsStore["items"]) {
  localStorage.setItem("ddg:records:v1", JSON.stringify({ version: 1, items }));
}

function seedProfile(hasBusinessRegistration: boolean) {
  const profile: UserProfile = {
    version: 1,
    hasBusinessRegistration,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  localStorage.setItem("ddg:profile:v1", JSON.stringify(profile));
}

function fillForm(values: { salary?: string; side?: string; other?: string; memo?: string }) {
  if (values.salary !== undefined) {
    fireEvent.change(screen.getByPlaceholderText("본업 소득"), { target: { value: values.salary } });
  }
  if (values.side !== undefined) {
    fireEvent.change(screen.getByPlaceholderText("부업 소득"), { target: { value: values.side } });
  }
  if (values.other !== undefined) {
    fireEvent.change(screen.getByPlaceholderText("기타 소득"), { target: { value: values.other } });
  }
  if (values.memo !== undefined) {
    fireEvent.change(screen.getByPlaceholderText("메모 (선택)"), { target: { value: values.memo } });
  }
}

function clickSave() {
  fireEvent.click(screen.getByRole("button", { name: "기록 저장" }));
}

describe("RecordPage — 월 소득 입력 폼·저장·상태 변화 연결 (/record)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-1[P0]: from='home' — 입력값 콤마 포맷·저장 후 getRecord 반영·'/'로 savedMonth와 함께 이동", async () => {
    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-08", from: "home" },
    });

    fillForm({ salary: "2000000", side: "300000", other: "50000", memo: "8월 정산" });

    expect((screen.getByPlaceholderText("본업 소득") as HTMLInputElement).value).toBe("2,000,000");

    clickSave();

    const saved = getRecord("2026-08");
    expect(saved?.salaryIncome).toBe(2_000_000);
    expect(saved?.sideIncome).toBe(300_000);
    expect(saved?.otherIncome).toBe(50_000);
    expect(mockNavigate).toHaveBeenCalledWith("/", { state: { savedMonth: "2026-08" } });

    // 탭바는 숨겨져 있어야 한다(단독 폼 화면)
    expect(screen.queryByRole("tablist", { name: "메인 네비게이션" })).not.toBeInTheDocument();
  });

  it("AC-1[P0]: from='history' — 저장 후 '/history'로 savedMonth와 함께 이동", async () => {
    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-08", from: "history" },
    });

    fillForm({ salary: "1500000", side: "0", other: "0", memo: "" });
    clickSave();

    expect(getRecord("2026-08")?.salaryIncome).toBe(1_500_000);
    expect(mockNavigate).toHaveBeenCalledWith("/history", { state: { savedMonth: "2026-08" } });
  });

  it("AC-2[P0]: 본업에 '1000000001' 입력 시 validateAmount와 동일한 에러가 보이고, 저장해도 setItem은 0회다", async () => {
    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-08", from: "home" },
    });

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    fillForm({ salary: "1000000001" });

    const expectedError = validateAmount("1000000001");
    expect(expectedError).toBe("월 소득은 10억원 이하로 입력해주세요");
    expect((screen.getByPlaceholderText("본업 소득") as HTMLInputElement).value).toBe("1,000,000,001");
    expect(screen.getByRole("alert").textContent).toBe(expectedError);

    clickSave();

    expect(setItemSpy).toHaveBeenCalledTimes(0);
    expect(getRecord("2026-08")).toBeNull();

    setItemSpy.mockRestore();
  });

  it("AC-3[P0]: 저장 버튼을 빠르게 2번 클릭해도 setItem 호출은 1회다", async () => {
    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-08", from: "home" },
    });

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    fillForm({ salary: "2000000", side: "0", other: "0", memo: "" });

    clickSave();
    clickSave();

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    setItemSpy.mockRestore();
  });

  it("AC-4[P0]: 2026년 기존 기록(1월, SAFE)이 있는 상태에서 DROP으로 악화되면 다이얼로그가 뜨고, '리포트 보기' 클릭 시 '/report'로 이동한다", async () => {
    seedProfile(false); // 미등록
    seedRecords([
      {
        month: "2026-01",
        salaryIncome: 1_000_000,
        sideIncome: 0,
        otherIncome: 0,
        memo: "",
        updatedAt: "2026-01-31T00:00:00.000Z",
      },
    ]);

    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-08", from: "home" },
    });

    fillForm({ salary: "30000000", side: "0", other: "0", memo: "" });
    clickSave();

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(STATUS_LABEL.DROP)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    within(dialog).getByText("리포트 보기").click();

    expect(mockNavigate).toHaveBeenCalledWith("/report", { state: { year: 2026 } });
  });

  it("AC-4: 2026년 기존 기록이 0건이면 같은 금액을 저장해도 다이얼로그 없이 바로 '/'로 이동한다", async () => {
    seedProfile(false);
    // 2026년 기록 0건 (localStorage 미시딩)

    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-08", from: "home" },
    });

    fillForm({ salary: "30000000", side: "0", other: "0", memo: "" });
    clickSave();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith("/", { state: { savedMonth: "2026-08" } });
  });

  it("AC-5: state.month='2026-10'(미래 월)이면 대상월은 '8월'로 대체되고 Toast로 알린다", async () => {
    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-10", from: "home" },
    });

    expect(screen.getByTestId("record-month").textContent).toContain("8월");
    expect(screen.getByRole("status").textContent).toMatch(/기록할 수 없/);
  });

  it("AC-5: setItem이 QuotaExceededError를 던지면 '/record'에 머물고 Toast가 보인다", async () => {
    const Record = await loadRecordPage();
    renderWithProviders(React.createElement(Record), {
      route: "/record",
      state: { month: "2026-08", from: "home" },
    });

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("QuotaExceeded", "QuotaExceededError");
    });

    fillForm({ salary: "2000000", side: "0", other: "0", memo: "" });
    clickSave();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/저장/);
    expect(getRecord("2026-08")).toBeNull();

    setItemSpy.mockRestore();
  });
});
