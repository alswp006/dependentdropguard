import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mockTds } from "@/__tests__/__helpers__/mocks";
import { STATUS_LABEL, REASON_TEXT } from "@/domain/rules";

mockTds();

// jsdom이 전역 URL을 덮어써 `new URL(relative, import.meta.url)`이 http://localhost로
// 풀린다 — path.resolve로 우회.
const SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../components/record/StatusChangeDialog.tsx",
);

// 동적 import — mockTds() 훅 이후에 로드되도록 각 테스트에서 개별 import
async function loadComponent() {
  const mod = await import("@/components/record/StatusChangeDialog");
  return mod.StatusChangeDialog;
}

describe("RecordPage 부품 — 자격 상태 변화 AlertDialog (StatusChangeDialog)", () => {
  it("AC-1[P0]: prev=SAFE, next=DROP, reasons=[TOTAL_INCOME]이면 상태 라벨과 사유 문구가 모두 보인다", async () => {
    const StatusChangeDialog = await loadComponent();
    render(
      React.createElement(StatusChangeDialog, {
        open: true,
        prev: "SAFE",
        next: "DROP",
        reasons: ["TOTAL_INCOME"],
        onClose: () => {},
        onViewReport: () => {},
      }),
    );

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(STATUS_LABEL.SAFE)).toBeInTheDocument();
    expect(within(dialog).getByText(STATUS_LABEL.DROP)).toBeInTheDocument();
    expect(within(dialog).getByText(REASON_TEXT.TOTAL_INCOME)).toBeInTheDocument();
  });

  it("AC-1[P0]: 사유가 여러 개(TOTAL_INCOME, SIDE_INCOME_REGISTERED)면 둘 다 렌더된다", async () => {
    const StatusChangeDialog = await loadComponent();
    render(
      React.createElement(StatusChangeDialog, {
        open: true,
        prev: "WARNING",
        next: "DROP",
        reasons: ["TOTAL_INCOME", "SIDE_INCOME_REGISTERED"],
        onClose: () => {},
        onViewReport: () => {},
      }),
    );

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(REASON_TEXT.TOTAL_INCOME)).toBeInTheDocument();
    expect(within(dialog).getByText(REASON_TEXT.SIDE_INCOME_REGISTERED)).toBeInTheDocument();
  });

  it("AC-2: '닫기' 버튼 클릭 시 onClose가 1회 호출되고 onViewReport는 호출되지 않는다", async () => {
    const StatusChangeDialog = await loadComponent();
    const onClose = vi.fn();
    const onViewReport = vi.fn();
    render(
      React.createElement(StatusChangeDialog, {
        open: true,
        prev: "SAFE",
        next: "DROP",
        reasons: ["TOTAL_INCOME"],
        onClose,
        onViewReport,
      }),
    );

    const dialog = screen.getByRole("alertdialog");
    // alertButton 슬롯은 단일 ReactNode다(TDS .d.ts) — 2버튼은 Fragment로 렌더되므로
    // 문서 순서상 첫 버튼이 컴포넌트가 직접 넣은 '닫기' AlertButton이다.
    const buttons = within(dialog).getAllByRole("button");
    const closeButton = buttons.find((btn) => btn.textContent === "닫기");
    expect(closeButton).toBeDefined();
    closeButton!.click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onViewReport).toHaveBeenCalledTimes(0);
  });

  it("AC-3: '리포트 보기' 버튼 클릭 시 onViewReport가 1회 호출된다", async () => {
    const StatusChangeDialog = await loadComponent();
    const onClose = vi.fn();
    const onViewReport = vi.fn();
    render(
      React.createElement(StatusChangeDialog, {
        open: true,
        prev: "SAFE",
        next: "DROP",
        reasons: ["TOTAL_INCOME"],
        onClose,
        onViewReport,
      }),
    );

    const dialog = screen.getByRole("alertdialog");
    const viewReportButton = within(dialog).getByText("리포트 보기");
    viewReportButton.click();

    expect(onViewReport).toHaveBeenCalledTimes(1);
  });

  it("AC-4: 컴포넌트 소스에 '취소' 문자열이 없고, open=false면 제목 텍스트가 DOM에 없다", async () => {
    const source = readFileSync(SOURCE_PATH, "utf-8");
    expect(source.includes("취소")).toBe(false);

    const StatusChangeDialog = await loadComponent();
    render(
      React.createElement(StatusChangeDialog, {
        open: false,
        prev: "SAFE",
        next: "DROP",
        reasons: ["TOTAL_INCOME"],
        onClose: () => {},
        onViewReport: () => {},
      }),
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByText(STATUS_LABEL.DROP)).not.toBeInTheDocument();
  });
});
