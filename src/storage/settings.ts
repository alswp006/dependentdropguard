import type { AppSettings, StorageResult } from '@/lib/types';
import { readJson, writeJson } from './safeStorage';

const KEY = 'ddg:settings:v1';

const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  reminderEnabled: true,
  dismissedReminderMonth: null,
};

function isAppSettings(value: unknown): value is AppSettings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.reminderEnabled === 'boolean' &&
    (v.dismissedReminderMonth === null || typeof v.dismissedReminderMonth === 'string')
  );
}

export function getSettings(): AppSettings {
  return readJson<AppSettings>(KEY, isAppSettings, DEFAULT_SETTINGS);
}

export function saveSettings(patch: Partial<Pick<AppSettings, 'reminderEnabled' | 'dismissedReminderMonth'>>): StorageResult<AppSettings> {
  const current = getSettings();
  const next: AppSettings = { ...current, ...patch, version: 1 };
  const result = writeJson(KEY, next);
  if (!result.ok) return result;
  return { ok: true, data: next };
}
