import type { ReportUnlock, StorageResult } from '@/lib/types';
import { readJson, writeJson } from './safeStorage';

const KEY = 'ddg:reportUnlock:v1';

function isReportUnlock(value: unknown): value is ReportUnlock {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.version === 1 && typeof v.unlockedMonth === 'string';
}

function isReportUnlockOrNull(value: unknown): value is ReportUnlock | null {
  return value === null || isReportUnlock(value);
}

export function getReportUnlock(): ReportUnlock | null {
  return readJson<ReportUnlock | null>(KEY, isReportUnlockOrNull, null);
}

export function saveReportUnlock(unlockedMonth: string): StorageResult<ReportUnlock> {
  const next: ReportUnlock = { version: 1, unlockedMonth };
  const result = writeJson(KEY, next);
  if (!result.ok) return result;
  return { ok: true, data: next };
}
