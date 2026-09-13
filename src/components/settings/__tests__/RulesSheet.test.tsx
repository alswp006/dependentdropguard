import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RULES, buildRuleDescriptions } from '@/domain/rules';

// BottomSheet의 onClose 트리거를 검증하려면 mock이 onClose를 실제로 forward해야 한다.
// 공유 mockTds()의 BottomSheet 스텁은 onClose를 사용하지 않으므로(open 여부만 반영),
// 이 파일에 한해 onClose를 닫기 버튼으로 노출하는 최소 mock을 직접 둔다.
vi.mock('@toss/tds-mobile', () => ({
  BottomSheet: Object.assign(
    ({ children, open, onClose }: any) =>
      open
        ? React.createElement(
            'div',
            { role: 'dialog' },
            children,
            React.createElement('button', { onClick: onClose }, '닫기'),
          )
        : null,
    { Header: ({ children }: any) => React.createElement('div', null, children) },
  ),
  ListRow: Object.assign(
    ({ children }: any) => React.createElement('div', { role: 'listitem' }, children),
    {
      Texts: ({ top }: any) =>
        React.createElement('span', { 'data-slot': 'top' }, top),
    },
  ),
  Spacing: ({ size }: any) => React.createElement('div', { 'data-spacing': size }),
  Paragraph: {
    Text: ({ children, typography }: any) =>
      React.createElement('span', { 'data-typography': typography }, children),
  },
}));

async function loadComponent() {
  const mod = await import('@/components/settings/RulesSheet');
  return mod.RulesSheet;
}

describe('RulesSheet', () => {
  it('AC-1: open=true면 규칙 문구 6개가 buildRuleDescriptions(RULES)와 순서까지 같다', async () => {
    const RulesSheet = await loadComponent();
    render(<RulesSheet open onClose={() => {}} />);

    const tops = screen.getAllByText(/./, { selector: '[data-slot="top"]' }).map((el) => el.textContent);
    expect(tops).toEqual(buildRuleDescriptions(RULES));
    expect(tops).toHaveLength(6);
  });

  it('AC-2: rules prop으로 healthRateBp 800을 넘기면 해당 값으로 계산된 문구가 보인다', async () => {
    const RulesSheet = await loadComponent();
    const customRules = { ...RULES, healthRateBp: 800 };
    render(<RulesSheet open onClose={() => {}} rules={customRules} />);

    const expectedLine = buildRuleDescriptions(customRules).find((line) =>
      line.includes('건강보험료율'),
    );
    expect(expectedLine).toBeDefined();
    expect(screen.getByText(expectedLine!)).toBeInTheDocument();
  });

  it('AC-3: open=false면 규칙 문구가 DOM에 없다', async () => {
    const RulesSheet = await loadComponent();
    render(<RulesSheet open={false} onClose={() => {}} />);

    const tops = screen.queryAllByText(/./, { selector: '[data-slot="top"]' });
    expect(tops).toHaveLength(0);
  });

  it('AC-4: BottomSheet의 onClose 트리거 시 onClose가 1회 호출된다', async () => {
    const RulesSheet = await loadComponent();
    const onClose = vi.fn();
    render(<RulesSheet open onClose={onClose} />);

    screen.getByText('닫기').click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
