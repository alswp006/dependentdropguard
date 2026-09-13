import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { buildRuleDescriptions, RULES } from "@/domain/rules";
import type { RuleSet } from "@/lib/types";

/**
 * Packet 0017: SettingsPage 부품 — 계산 기준 BottomSheet (RulesSheet)
 *
 * Props: { open, onClose, rules? }
 * - buildRuleDescriptions(rules ?? RULES)가 반환하는 6개 문구를 ListRow 6행으로 렌더
 * - 하단에 DISCLAIMER_TEXT 표시
 * - open=false면 아무 행도 렌더하지 않음
 * - BottomSheet가 닫힐 때(onClose 트리거) props.onClose가 호출됨
 *
 * @toss/tds-mobile은 jsdom에서 충돌하므로 로컬 mock을 쓴다. 공용 mockTds()의 BottomSheet
 * stand-in은 onClose를 전달만 받고 트리거 UI가 없어 AC-4(닫기 트리거) 검증이 불가능하므로,
 * 여기서는 onClose를 호출하는 닫기 버튼을 가진 BottomSheet mock을 직접 정의한다
 * (testing.md "Legacy direct mocks" 패턴).
 */

vi.mock("@toss/tds-mobile", () => ({
  BottomSheet: Object.assign(
    ({ children, open, onClose }: any) =>
      open
        ? React.createElement(
            "div",
            { role: "dialog" },
            React.createElement("button", { onClick: onClose, "aria-label": "닫기" }, "닫기"),
            children,
          )
        : null,
    {
      Header: ({ children }: any) => React.createElement("div", null, children),
    },
  ),

  ListRow: Object.assign(
    ({ children, ...props }: any) =>
      React.createElement("div", { role: "listitem", ...props }, children),
    {
      Texts: ({ top, bottom }: any) =>
        React.createElement(
          React.Fragment,
          null,
          React.createElement("span", { "data-slot": "top" }, top),
          bottom ? React.createElement("span", { "data-slot": "bottom" }, bottom) : null,
        ),
    },
  ),

  Paragraph: {
    Text: ({ children, typography, ...props }: any) =>
      React.createElement("span", { "data-typography": typography, ...props }, children),
  },

  Spacing: ({ size }: any) => React.createElement("div", { "data-spacing": size }),
}));

describe("Packet 0017: RulesSheet", () => {
  it("AC-1: open=true면 ListRow 텍스트 6개가 buildRuleDescriptions(RULES)와 순서까지 같다", async () => {
    const { RulesSheet } = await import("@/components/settings/RulesSheet");

    render(
      React.createElement(RulesSheet, {
        open: true,
        onClose: vi.fn(),
      }),
    );

    const rows = screen.getAllByRole("listitem");
    const expected = buildRuleDescriptions(RULES);
    expect(rows).toHaveLength(6);
    rows.forEach((row, i) => {
      expect(within(row).getByText(expected[i])).toBeInTheDocument();
    });
  });

  it("AC-2: rules prop으로 healthRateBp 800을 넘기면 buildRuleDescriptions(customRules) 문구가 그대로 보인다", async () => {
    const { RulesSheet } = await import("@/components/settings/RulesSheet");
    const customRules: RuleSet = { ...RULES, healthRateBp: 800 };

    render(
      React.createElement(RulesSheet, {
        open: true,
        onClose: vi.fn(),
        rules: customRules,
      }),
    );

    const rows = screen.getAllByRole("listitem");
    const expected = buildRuleDescriptions(customRules);
    const defaultExpected = buildRuleDescriptions(RULES);
    expect(rows).toHaveLength(6);
    rows.forEach((row, i) => {
      expect(within(row).getByText(expected[i])).toBeInTheDocument();
    });
    // 바뀐 healthRateBp 값이 기본 RULES 문구와는 달라야 한다 (하드코딩 아님을 확인)
    expect(expected).not.toEqual(defaultExpected);
  });

  it("AC-3: open=false면 규칙 문구가 DOM에 0개 보인다", async () => {
    const { RulesSheet } = await import("@/components/settings/RulesSheet");

    render(
      React.createElement(RulesSheet, {
        open: false,
        onClose: vi.fn(),
      }),
    );

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    buildRuleDescriptions(RULES).forEach((desc) => {
      expect(screen.queryByText(desc)).toBeNull();
    });
  });

  it("AC-4: BottomSheet onClose 트리거 시 onClose가 1회 호출된다", async () => {
    const { RulesSheet } = await import("@/components/settings/RulesSheet");
    const onClose = vi.fn();

    render(
      React.createElement(RulesSheet, {
        open: true,
        onClose,
      }),
    );

    screen.getByRole("button", { name: "닫기" }).click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("AC-5: 하단에 DISCLAIMER_TEXT가 표시된다", async () => {
    const { RulesSheet } = await import("@/components/settings/RulesSheet");
    const { DISCLAIMER_TEXT } = await import("@/domain/rules");

    render(
      React.createElement(RulesSheet, {
        open: true,
        onClose: vi.fn(),
      }),
    );

    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });
});
