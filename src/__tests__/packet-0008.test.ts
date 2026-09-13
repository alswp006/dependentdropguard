import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { mockTds } from "@/__tests__/__helpers__/mocks";

/**
 * Packet 0008: RecordPage 부품 — 월 선택 BottomSheet (MonthPickerSheet)
 *
 * Props: { open, value, now, recordedMonths, onSelect, onClose }
 * - selectableMonths(now)를 내림차순 ListRow로 렌더 (현재 달부터 20개월 전까지, 총 21개)
 * - 같은 해는 "M월", 이전 해는 "YYYY년 M월" 형식
 * - recordedMonths에 포함된 달의 행에는 "입력함" 보조 문구
 * - value와 일치하는 달의 행에는 선택 표시(Asset.Icon aria-label="선택됨")
 * - 행 클릭 시 onSelect(month) → onClose() 순서로 호출
 * - now 이후 미래 달은 렌더하지 않음
 *
 * 기준 시각: 2026-09-14
 */

mockTds();

describe("Packet 0008: MonthPickerSheet", () => {
  const NOW = new Date("2026-09-14T00:00:00");

  it("AC-1[P0]: open=true, now=2026-09-14 → 월 행 21개, 첫 행 '9월', 마지막 행 '2025년 1월'", async () => {
    const { MonthPickerSheet } = await import("@/components/record/MonthPickerSheet");

    render(
      React.createElement(MonthPickerSheet, {
        open: true,
        value: null,
        now: NOW,
        recordedMonths: [],
        onSelect: vi.fn(),
        onClose: vi.fn(),
      }),
    );

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(21);
    expect(within(rows[0]).getByText("9월", { exact: true })).toBeInTheDocument();
    expect(within(rows[20]).getByText("2025년 1월", { exact: true })).toBeInTheDocument();
  });

  it("AC-2[P0]: recordedMonths=['2026-08'] → '8월' 행에만 '입력함' 표시 (다른 행 0개)", async () => {
    const { MonthPickerSheet } = await import("@/components/record/MonthPickerSheet");

    render(
      React.createElement(MonthPickerSheet, {
        open: true,
        value: null,
        now: NOW,
        recordedMonths: ["2026-08"],
        onSelect: vi.fn(),
        onClose: vi.fn(),
      }),
    );

    const augLabel = screen.getByText("8월", { exact: true });
    const augRow = augLabel.closest('[role="listitem"]') as HTMLElement;
    expect(within(augRow).getByText("입력함")).toBeInTheDocument();
    expect(screen.getAllByText("입력함")).toHaveLength(1);
  });

  it("AC-3[P0]: '8월' 행 클릭 → onSelect('2026-08') 1회, onClose 1회, 이 순서로 호출", async () => {
    const { MonthPickerSheet } = await import("@/components/record/MonthPickerSheet");
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const callOrder: string[] = [];
    onSelect.mockImplementation(() => callOrder.push("onSelect"));
    onClose.mockImplementation(() => callOrder.push("onClose"));

    render(
      React.createElement(MonthPickerSheet, {
        open: true,
        value: null,
        now: NOW,
        recordedMonths: [],
        onSelect,
        onClose,
      }),
    );

    const augLabel = screen.getByText("8월", { exact: true });
    const augRow = augLabel.closest('[role="listitem"]') as HTMLElement;
    fireEvent.click(augRow);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("2026-08");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["onSelect", "onClose"]);
  });

  it("AC-4[P0]: 미래 달(2026-10)은 렌더되지 않는다", async () => {
    const { MonthPickerSheet } = await import("@/components/record/MonthPickerSheet");

    render(
      React.createElement(MonthPickerSheet, {
        open: true,
        value: null,
        now: NOW,
        recordedMonths: [],
        onSelect: vi.fn(),
        onClose: vi.fn(),
      }),
    );

    expect(screen.queryByText("10월", { exact: true })).toBeNull();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(21);
  });

  it("AC-5[P1]: value='2026-07'과 일치하는 행에만 선택 표시가 보인다", async () => {
    const { MonthPickerSheet } = await import("@/components/record/MonthPickerSheet");

    render(
      React.createElement(MonthPickerSheet, {
        open: true,
        value: "2026-07",
        now: NOW,
        recordedMonths: [],
        onSelect: vi.fn(),
        onClose: vi.fn(),
      }),
    );

    const julLabel = screen.getByText("7월", { exact: true });
    const julRow = julLabel.closest('[role="listitem"]') as HTMLElement;
    expect(within(julRow).getByRole("img", { name: "선택됨" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "선택됨" })).toHaveLength(1);
  });

  it("AC-6: open=false면 아무 행도 렌더하지 않는다", async () => {
    const { MonthPickerSheet } = await import("@/components/record/MonthPickerSheet");

    render(
      React.createElement(MonthPickerSheet, {
        open: false,
        value: null,
        now: NOW,
        recordedMonths: [],
        onSelect: vi.fn(),
        onClose: vi.fn(),
      }),
    );

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("9월", { exact: true })).toBeNull();
  });
});
