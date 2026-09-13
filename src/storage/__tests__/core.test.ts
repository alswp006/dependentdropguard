import { describe, it, expect, vi, afterEach } from 'vitest';
import { getProfile, saveProfile } from '@/storage/profile';
import { getSettings, saveSettings } from '@/storage/settings';
import { getReportUnlock, saveReportUnlock } from '@/storage/reportUnlock';

describe('storage core', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC-1: returns defaults on empty localStorage', () => {
    expect(getProfile()).toBeNull();
    expect(getReportUnlock()).toBeNull();
    expect(getSettings()).toEqual({
      version: 1,
      reminderEnabled: true,
      dismissedReminderMonth: null,
    });
  });

  it('AC-2: falls back to defaults on malformed settings, no console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('ddg:settings:v1', '"abc"');

    expect(getSettings()).toEqual({
      version: 1,
      reminderEnabled: true,
      dismissedReminderMonth: null,
    });
    expect(errorSpy).toHaveBeenCalledTimes(0);
  });

  it('AC-3: maps QuotaExceededError / code 22 to STORAGE_FULL, other errors to STORAGE_UNAVAILABLE', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    setItemSpy.mockImplementationOnce(() => {
      throw new DOMException('', 'QuotaExceededError');
    });
    expect(saveSettings({ reminderEnabled: false })).toEqual({ ok: false, error: 'STORAGE_FULL' });

    setItemSpy.mockImplementationOnce(() => {
      const err = new Error('quota') as Error & { code: number };
      err.code = 22;
      throw err;
    });
    expect(saveSettings({ reminderEnabled: false })).toEqual({ ok: false, error: 'STORAGE_FULL' });

    setItemSpy.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(saveSettings({ reminderEnabled: false })).toEqual({ ok: false, error: 'STORAGE_UNAVAILABLE' });
  });

  it('AC-4: saveProfile keeps createdAt across saves, only updatedAt changes', () => {
    const first = saveProfile({ hasBusinessRegistration: true });
    expect(first.ok).toBe(true);
    const createdAt = first.ok ? first.data.createdAt : '';

    const second = saveProfile({ hasBusinessRegistration: true });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.createdAt).toBe(createdAt);
    }

    const stored = getProfile();
    expect(stored?.createdAt).toBe(createdAt);
  });

  it('AC-5: saveReportUnlock persists unlockedMonth', () => {
    saveReportUnlock('2026-09');
    expect(getReportUnlock()).toEqual({ version: 1, unlockedMonth: '2026-09' });
  });
});
