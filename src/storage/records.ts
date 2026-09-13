import type { MonthlyIncomeRecord, RecordsStore, StorageResult } from '@/lib/types';
import { readJson, writeJson } from './safeStorage';

const KEY = 'ddg:records:v1';
const MAX_AMOUNT = 1_000_000_000;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const EMPTY_STORE: RecordsStore = { version: 1, items: [] };

function isMonthlyIncomeRecord(value: unknown): value is MonthlyIncomeRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.month === 'string' &&
    typeof v.salaryIncome === 'number' &&
    typeof v.sideIncome === 'number' &&
    typeof v.otherIncome === 'number' &&
    typeof v.memo === 'string' &&
    typeof v.updatedAt === 'string'
  );
}

function isRecordsStore(value: unknown): value is RecordsStore {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.version === 1 && Array.isArray(v.items) && v.items.every(isMonthlyIncomeRecord);
}

function loadStore(): RecordsStore {
  return readJson<RecordsStore>(KEY, isRecordsStore, EMPTY_STORE);
}

export interface UpsertRecordInput {
  month: string;
  salaryIncome: number;
  sideIncome: number;
  otherIncome: number;
  memo: string;
}

function isValidAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0 && amount <= MAX_AMOUNT;
}

function isValidInput(input: UpsertRecordInput): boolean {
  return (
    typeof input.month === 'string' &&
    MONTH_RE.test(input.month) &&
    isValidAmount(input.salaryIncome) &&
    isValidAmount(input.sideIncome) &&
    isValidAmount(input.otherIncome) &&
    typeof input.memo === 'string' &&
    input.memo.length <= 30
  );
}

export function getRecords(): MonthlyIncomeRecord[] {
  return loadStore().items;
}

export function getRecord(month: string): MonthlyIncomeRecord | null {
  return loadStore().items.find((record) => record.month === month) ?? null;
}

export function upsertRecord(input: UpsertRecordInput): StorageResult<null> {
  if (!isValidInput(input)) {
    return { ok: false, error: 'INVALID_INPUT' };
  }

  const record: MonthlyIncomeRecord = {
    month: input.month,
    salaryIncome: input.salaryIncome,
    sideIncome: input.sideIncome,
    otherIncome: input.otherIncome,
    memo: input.memo,
    updatedAt: new Date().toISOString(),
  };

  const items = loadStore().items.filter((r) => r.month !== input.month);
  items.push(record);
  items.sort((a, b) => a.month.localeCompare(b.month));

  return writeJson(KEY, { version: 1, items });
}

export function deleteRecord(month: string): StorageResult<null> {
  const items = loadStore().items.filter((r) => r.month !== month);
  return writeJson(KEY, { version: 1, items });
}
