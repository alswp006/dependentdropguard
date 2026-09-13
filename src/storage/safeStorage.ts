import type { StorageResult } from '@/lib/types';

function isQuotaExceeded(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'QuotaExceededError' || err.code === 22;
  }
  return (
    typeof err === 'object' &&
    err !== null &&
    ('code' in err) &&
    (err as { code?: number }).code === 22
  );
}

export function readJson<T>(key: string, validate: (value: unknown) => value is T, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): StorageResult<null> {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true, data: null };
  } catch (err) {
    if (isQuotaExceeded(err)) {
      return { ok: false, error: 'STORAGE_FULL' };
    }
    return { ok: false, error: 'STORAGE_UNAVAILABLE' };
  }
}

export function removeKeys(keys: string[]): void {
  try {
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // no-op: storage unavailable
  }
}
