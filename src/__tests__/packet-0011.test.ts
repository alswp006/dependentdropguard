import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { mockTds } from "@/__tests__/__helpers__/mocks";
import type { AppSettings, MonthlyIncomeRecord } from "@/lib/types";

mockTds();

// 동적 import — mockTds() 훅 이후에 로드되도록 각 테스트에서 개별 import
async function loadModule() {
  return import("@/components/home/ReminderBanner");
}

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    version: 1,
    reminderEnabled: true,
    dismissedReminderMonth: null,
    ...overrides,
  };
}

function makeRecord(month: string): MonthlyIncomeRecord {
  return {
    month,
    salaryIncome: 3_000_000,
    sideIncome: 0,
    otherIncome: 0,
    memo: "",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("HomePage 부품 — 월간 입력 리마인더 배너 (ReminderBanner)", () => {
  it("AC-1[P0]: now=2026-09-14, 리마인더 켜짐, 8월 기록 없음, dismiss 없음이면 true다", async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date(2026, 8, 14); // 2026-09-14
    const result = shouldShowReminder(makeSettings(), [], now);
    expect(result).toBe(true);
  });

  it("AC-1[P0]: dismissedReminderMonth가 대상 월(2026-08)과 같으면 false다", async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date(2026, 8, 14); // 2026-09-14
    const result = shouldShowReminder(
      makeSettings({ dismissedReminderMonth: "2026-08" }),
      [],
      now,
    );
    expect(result).toBe(false);
  });

  it("AC-1: 대상 월(2026-08) 기록이 이미 있으면 false다", async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date(2026, 8, 14); // 2026-09-14
    const result = shouldShowReminder(makeSettings(), [makeRecord("2026-08")], now);
    expect(result).toBe(false);
  });

  it("AC-1: reminderEnabled가 false면 false다", async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date(2026, 8, 14); // 2026-09-14
    const result = shouldShowReminder(makeSettings({ reminderEnabled: false }), [], now);
    expect(result).toBe(false);
  });

  it("AC-2: now=2026-10-01, dismissed='2026-08'이면 대상 월은 2026-09이라 true다", async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date(2026, 9, 1); // 2026-10-01
    const result = shouldShowReminder(
      makeSettings({ dismissedReminderMonth: "2026-08" }),
      [],
      now,
    );
    expect(result).toBe(true);
  });

  it("AC-3: month='2026-08'을 렌더하면 '8월'이 들어간 문구가 보이고, 버튼 클릭 시 콜백이 각 1회 호출된다", async () => {
    const { ReminderBanner } = await loadModule();
    const onRecord = vi.fn();
    const onDismiss = vi.fn();
    render(
      React.createElement(ReminderBanner, {
        month: "2026-08",
        now: new Date(2026, 8, 14),
        onRecord,
        onDismiss,
      }),
    );

    expect(screen.getByText(/8월/)).toBeInTheDocument();

    screen.getByText("입력하기").click();
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(0);

    screen.getByText("닫기").click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it("AC-4: 입력하기/닫기 버튼이 TDS 기본 크기 이상(size='small' 미사용, 인라인 축소 없음)이다", async () => {
    const { ReminderBanner } = await loadModule();
    render(
      React.createElement(ReminderBanner, {
        month: "2026-08",
        now: new Date(2026, 8, 14),
        onRecord: () => {},
        onDismiss: () => {},
      }),
    );

    const recordButton = screen.getByText("입력하기").closest("button");
    const dismissButton = screen.getByText("닫기").closest("button");
    expect(recordButton).not.toBeNull();
    expect(dismissButton).not.toBeNull();

    for (const btn of [recordButton!, dismissButton!]) {
      // TDS Button의 size='small'은 44px 미만 — 기본값(medium 이상)만 허용
      expect(btn.getAttribute("size")).not.toBe("small");
      expect(btn.getAttribute("size")).not.toBe("xsmall");
      // 인라인 style로 44px 미만 높이를 강제하지 않아야 한다
      const style = btn.getAttribute("style") ?? "";
      const heightMatch = style.match(/(?:min-)?height:\s*(\d+)px/);
      if (heightMatch) {
        expect(Number(heightMatch[1])).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
