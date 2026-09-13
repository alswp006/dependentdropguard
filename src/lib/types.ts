// Domain types — SPEC Data Models

// ============ Common Storage Result ============
export type StorageError = 'STORAGE_FULL' | 'STORAGE_UNAVAILABLE' | 'INVALID_INPUT';
export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: StorageError };

// ============ User Profile ============
export interface UserProfile {
  version: 1;
  hasBusinessRegistration: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ============ Monthly Income Record ============
export interface MonthlyIncomeRecord {
  month: string; // 'YYYY-MM'
  salaryIncome: number; // 본업 소득(원)
  sideIncome: number; // 부업·프리랜서 소득(원)
  otherIncome: number; // 기타 소득(원)
  memo: string; // 0~30자
  updatedAt: string; // ISO 8601
}

export interface RecordsStore {
  version: 1;
  items: MonthlyIncomeRecord[]; // month 오름차순 정렬
}

// ============ App Settings ============
export interface AppSettings {
  version: 1;
  reminderEnabled: boolean;
  dismissedReminderMonth: string | null; // 'YYYY-MM'
}

// ============ Report Unlock ============
export interface ReportUnlock {
  version: 1;
  unlockedMonth: string; // 'YYYY-MM'
}

// ============ Rules & Constants ============
export interface RuleSet {
  year: number;
  totalIncomeLimit: number; // 20_000_000
  sideIncomeLimitUnregistered: number; // 5_000_000
  sideIncomeLimitRegistered: number; // 0
  warningRatioBp: number; // 8000 (80%)
  healthRateBp: number; // 719 (7.19%)
  ltcRatioBp: number; // 1314 (13.14%)
}

// ============ Diagnosis Result Types ============
export type DiagnosisStatus = 'SAFE' | 'WARNING' | 'DROP';
export type DropReason = 'TOTAL_INCOME' | 'SIDE_INCOME_UNREGISTERED' | 'SIDE_INCOME_REGISTERED';

export interface AnnualSummary {
  year: number;
  recordedMonths: number; // 1~12
  actualTotal: number; // 입력된 달 실제 합계
  salaryAnnual: number; // 연 환산
  sideAnnual: number;
  otherAnnual: number;
  totalAnnual: number;
}

export interface PremiumEstimate {
  monthlyBase: number;
  healthMonthly: number;
  ltcMonthly: number;
  totalMonthly: number;
  totalAnnual: number;
}

export interface DiagnosisResult {
  year: number;
  status: DiagnosisStatus;
  reasons: DropReason[];
  summary: AnnualSummary;
  marginToDrop: number;
  overAmount: number;
  totalRatioPercent: number;
}
