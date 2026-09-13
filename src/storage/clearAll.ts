import type { StorageResult } from '@/lib/types';
import { removeKeys } from './safeStorage';

const KEYS = ['ddg:records:v1', 'ddg:settings:v1', 'ddg:profile:v1', 'ddg:reports:v1'];

export function clearAllData(): StorageResult<null> {
  return removeKeys(KEYS);
}
