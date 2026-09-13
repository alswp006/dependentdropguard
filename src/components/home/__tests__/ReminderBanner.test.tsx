import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { mockTds } from '@/__tests__/__helpers__/mocks';
import type { AppSettings, MonthlyIncomeRecord } from '@/lib/types';

mockTds();

const SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../ReminderBanner.tsx',
);

async function loadModule() {
  return import('@/components/home/ReminderBanner');
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
    salaryIncome: 0,
    sideIncome: 0,
    otherIncome: 0,
    memo: '',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('shouldShowReminder', () => {
  it('AC-1: reminderEnabled true, 2026-08 기록 없음, dismissed null → true', async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    expect(shouldShowReminder(makeSettings(), [], now)).toBe(true);
  });

  it('AC-1: dismissedReminderMonth가 대상 월과 같으면 false', async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    expect(
      shouldShowReminder(makeSettings({ dismissedReminderMonth: '2026-08' }), [], now),
    ).toBe(false);
  });

  it('AC-1: 대상 월 기록이 있으면 false', async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    expect(shouldShowReminder(makeSettings(), [makeRecord('2026-08')], now)).toBe(false);
  });

  it('AC-1: reminderEnabled false면 false', async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    expect(shouldShowReminder(makeSettings({ reminderEnabled: false }), [], now)).toBe(false);
  });

  it('AC-2: now가 2026-10-01이고 dismissed가 2026-08이면 대상 월은 2026-09라 true', async () => {
    const { shouldShowReminder } = await loadModule();
    const now = new Date('2026-10-01T09:00:00+09:00');
    expect(
      shouldShowReminder(makeSettings({ dismissedReminderMonth: '2026-08' }), [], now),
    ).toBe(true);
  });
});

describe('ReminderBanner', () => {
  it('AC-3: month=2026-08을 렌더하면 8월이 들어간 문구가 보인다', async () => {
    const { ReminderBanner } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    render(
      <ReminderBanner month="2026-08" now={now} onRecord={() => {}} onDismiss={() => {}} />,
    );

    expect(screen.getByText('8월 소득을 아직 입력하지 않았어요')).toBeInTheDocument();
  });

  it('AC-3: 입력하기를 클릭하면 onRecord가 1회 호출된다', async () => {
    const { ReminderBanner } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    const onRecord = vi.fn();
    render(
      <ReminderBanner month="2026-08" now={now} onRecord={onRecord} onDismiss={() => {}} />,
    );

    screen.getByText('입력하기').click();
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it('AC-3: 닫기를 클릭하면 onDismiss가 1회 호출된다', async () => {
    const { ReminderBanner } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    const onDismiss = vi.fn();
    render(
      <ReminderBanner month="2026-08" now={now} onRecord={() => {}} onDismiss={onDismiss} />,
    );

    screen.getByText('닫기').click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('AC-4: 두 버튼 모두 size=medium(TDS 기본값 이상)을 사용해 44px 이상을 보장하고, 축소 size가 없다', () => {
    const source = readFileSync(SOURCE_PATH, 'utf-8');
    const sizeMatches = source.match(/size="[a-z]+"/g) ?? [];
    expect(sizeMatches.length).toBeGreaterThanOrEqual(2);
    expect(sizeMatches.every((match) => match === 'size="medium"')).toBe(true);
  });

  it('AC-4: 배너가 Card(reminder-banner)로 감싸진다', async () => {
    const { ReminderBanner } = await loadModule();
    const now = new Date('2026-09-14T09:00:00+09:00');
    render(
      <ReminderBanner month="2026-08" now={now} onRecord={() => {}} onDismiss={() => {}} />,
    );

    expect(screen.getByTestId('reminder-banner')).toBeInTheDocument();
  });
});
