import { describe, it, expect } from 'vitest';
import { upsertRecord, getRecords, getRecord, deleteRecord } from '@/storage/records';
import { clearAllData } from '@/storage/clearAll';

describe('records storage', () => {
  it('AC-1: upsertRecord persists a record with version 1', () => {
    upsertRecord({ month: '2026-08', salaryIncome: 0, sideIncome: 200000, otherIncome: 0, memo: '' });

    expect(getRecords()).toHaveLength(1);
    expect(getRecords()[0].sideIncome).toBe(200000);
    expect(JSON.parse(localStorage.getItem('ddg:records:v1')!).version).toBe(1);
  });

  it('AC-2: upsertRecord keeps one record per month, sorted ascending, and updates in place', () => {
    upsertRecord({ month: '2026-08', salaryIncome: 0, sideIncome: 200000, otherIncome: 0, memo: '' });
    upsertRecord({ month: '2026-01', salaryIncome: 0, sideIncome: 0, otherIncome: 0, memo: '' });
    upsertRecord({ month: '2026-08', salaryIncome: 0, sideIncome: 300000, otherIncome: 0, memo: '' });

    expect(getRecords().map((r) => r.month)).toEqual(['2026-01', '2026-08']);
    expect(getRecord('2026-08')?.sideIncome).toBe(300000);
  });

  it('AC-3: rejects invalid input without writing to storage', () => {
    expect(
      upsertRecord({ month: '2026-13', salaryIncome: 0, sideIncome: 0, otherIncome: 0, memo: '' })
    ).toEqual({ ok: false, error: 'INVALID_INPUT' });
    expect(
      upsertRecord({ month: '2026-08', salaryIncome: 0, sideIncome: -1, otherIncome: 0, memo: '' })
    ).toEqual({ ok: false, error: 'INVALID_INPUT' });
    expect(
      upsertRecord({ month: '2026-08', salaryIncome: 0, sideIncome: 0, otherIncome: 0, memo: 'x'.repeat(31) })
    ).toEqual({ ok: false, error: 'INVALID_INPUT' });
    expect(getRecords()).toHaveLength(0);
  });

  it('AC-4: returns [] for corrupted storage without throwing', () => {
    localStorage.setItem('ddg:records:v1', '{broken');
    expect(getRecords()).toEqual([]);
  });

  it('deleteRecord removes the target month only', () => {
    upsertRecord({ month: '2026-01', salaryIncome: 0, sideIncome: 0, otherIncome: 0, memo: '' });
    upsertRecord({ month: '2026-08', salaryIncome: 0, sideIncome: 0, otherIncome: 0, memo: '' });

    expect(deleteRecord('2026-08')).toEqual({ ok: true, data: null });
    expect(getRecord('2026-08')).toBeNull();
    expect(getRecords().map((r) => r.month)).toEqual(['2026-01']);
  });

  it('AC-5: clearAllData removes all ddg:* keys', () => {
    upsertRecord({ month: '2026-01', salaryIncome: 0, sideIncome: 0, otherIncome: 0, memo: '' });
    localStorage.setItem('ddg:profile:v1', 'x');
    localStorage.setItem('ddg:settings:v1', 'x');
    localStorage.setItem('ddg:reports:v1', 'x');

    expect(clearAllData()).toEqual({ ok: true, data: null });
    expect(localStorage.getItem('ddg:records:v1')).toBeNull();
    expect(localStorage.getItem('ddg:profile:v1')).toBeNull();
    expect(localStorage.getItem('ddg:settings:v1')).toBeNull();
    expect(localStorage.getItem('ddg:reports:v1')).toBeNull();
  });
});
