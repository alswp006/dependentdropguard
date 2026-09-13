import type { StorageResult, UserProfile } from '@/lib/types';
import { readJson, writeJson } from './safeStorage';

const KEY = 'ddg:profile:v1';

function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.hasBusinessRegistration === 'boolean' &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string'
  );
}

function isUserProfileOrNull(value: unknown): value is UserProfile | null {
  return value === null || isUserProfile(value);
}

export function getProfile(): UserProfile | null {
  return readJson<UserProfile | null>(KEY, isUserProfileOrNull, null);
}

export function saveProfile(patch: { hasBusinessRegistration: boolean }): StorageResult<UserProfile> {
  const existing = getProfile();
  const now = new Date().toISOString();
  const next: UserProfile = {
    version: 1,
    hasBusinessRegistration: patch.hasBusinessRegistration,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const result = writeJson(KEY, next);
  if (!result.ok) return result;
  return { ok: true, data: next };
}
