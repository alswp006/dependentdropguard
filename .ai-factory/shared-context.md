# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 라우팅 상태 및 페이지 전환. 모든 페이지와 0006 파서에서 필요 (구현: 패킷 0001) */
export type RouteState = { page: 'profile' | 'record' | 'home' | 'report' | 'history' | 'simulate' | 'settings'; params?: Record<string, string> };

/** 사업자 등록 여부. 0003(프로필 저장), 0005(판정), 0010(상태 변화), 0018(설정)에서 공유 (구현: 패킷 0001) */
export type EntrepreneurStatus = 'registered' | 'not_registered';

/** 보험 자격 상태. 0009(다이얼로그), 0012(대시보드), 0013(리포트)에서 표시 (구현: 패킷 0001) */
export type InsuranceStatus = 'covered' | 'not_covered' | 'voluntary';

/** 월별 소득 기록. 0004(CRUD), 0005(진단), 0010(폼), 0014(목록)에서 다룸 (구현: 패킷 0001) */
export type MonthRecord = { month: string; amountKrw: number; recorded: boolean; recordedDate?: string };

/** 진단 결과. 0005에서 반환, 0012(홈), 0013(리포트)에서 표시 (구현: 패킷 0001) */
export type DiagnosisResult = { status: InsuranceStatus; monthlyPremium: number; estimatedYearlyIncome: number; coverageMonths: number };

/** 판정 기준값 상수. 0005(진단), 0020(검수)에서 참조 (구현: 패킷 0002) */
export type JUDGMENT_RULESFn = () => { monthlyMinimum: number; coverageThreshold: number; premiumRate: number };

/** 원화 포맷. 0012(홈), 0014(히스토리), 0018(설정)에서 표시용 (구현: 패킷 0002) */
export type formatCurrencyFn = (amount: number, opts?: { decimals?: number }) => string;

/** 소득 → 지위·보험료 계산. 0012(대시보드), 0013(리포트)에 핵심 (구현: 패킷 0005) */
export type diagnoseFn = (records: MonthRecord[], entrepreneurStatus: EntrepreneurStatus) => DiagnosisResult;

/** 지역가입자 전환 시뮬레이션. 0016(SimulatePage)에서만 사용 (구현: 패킷 0005) */
export type simulateFn = (currentResult: DiagnosisResult, newStatus: EntrepreneurStatus) => DiagnosisResult;

/** 월 기록 저장. 0010(RecordPage)에서 폼 제출 (구현: 패킷 0004) */
export type saveMonthRecordFn = (month: string, amountKrw: number) => Promise<void>;

/** 연도별 기록 조회. 0005(진단), 0012(홈), 0014(히스토리)에 입력 (구현: 패킷 0004) */
export type getMonthRecordsFn = (year?: number) => Promise<MonthRecord[]>;

/** 전체 소득 기록 삭제. 0018(SettingsPage) 삭제 버튼 (구현: 패킷 0004) */
export type deleteAllRecordsFn = () => Promise<void>;

/** 중앙 상태 저장소. 0007~0018(모든 페이지·컴포넌트) Provider로 감싸짐 (구현: 패킷 0006) */
export type AppDataContext = { entrepreneurStatus: EntrepreneurStatus; records: MonthRecord[]; diagnosis: DiagnosisResult | null; setEntrepreneurStatus: (s: EntrepreneurStatus) => Promise<void>; addRecord: (m: string, a: number) => Promise<void>; refreshDiagnosis: () => Promise<void> };

/** AppDataContext 훅. 모든 페이지·컴포넌트에서 상태 접근 (구현: 패킷 0006) */
export type useAppDataFn = () => AppDataContext;

/** URL → RouteState 파싱. 0019(App.tsx 라우팅)에서 필수 (구현: 패킷 0006) */
export type parseRouteStateFn = (url: string) => RouteState;

/** 소득 입력 검증. 0010(RecordPage 폼)에서 제출 전 호출 (구현: 패킷 0006) */
export type validateRecordFn = (amountKrw: number) => { valid: boolean; error?: string };

```

## ⏳ 시간 예약으로 미뤄진 화면 — 자리 페이지로만 존재한다(실패가 아니라 미룸)
다음 화면 패킷은 시간 예약으로 미뤄져 이 밤에는 만들어지지 않는다. 스캐폴드(배선 선행)가 이 화면들을
**"준비 중" 자리 페이지로 이미 import·라우트해 두었다** — 컴파일된다:
- 0018 "SettingsPage — 사업자 행·리마인더·전체 삭제·면책 (/settings)" (src/pages/Settings.tsx, src/pages/__tests__/Settings.test.tsx)
- **Route·import는 그대로 두어라.** 지우지도 말고 새로 채우지도 마라 — 자리 페이지(첫 줄 `@ai-factory:placeholder`)는 그 화면 패킷의 몫이다.
- 존재하는(실속) 화면만 배선·연결하고, 테스트·검증 범위도 실속 화면으로 좁혀라 — 자리 페이지의 내용·동작을 검증하는 테스트는 게이트에서 막힌다.

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TabLayout.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
    home/
    record/
    settings/
    simulate/
  domain/
    __tests__/
    diagnosis.ts
    rules.ts
    simulation.ts
  hooks/
  lib/
    __tests__/
    contract.ts
    routeState.ts
    storage.ts
    types.ts
    utils.ts
    validation.ts
  main.tsx
  pages/
    History.tsx
    Home.tsx
    Profile.tsx
    Record.tsx
    Report.tsx
    Settings.tsx
    Simulate.tsx
    __TdsGallery.tsx
    __tests__/
  state/
    AppDataContext.tsx
  storage/
    __tests__/
    clearAll.ts
    profile.ts
    records.ts
    reportUnlock.ts
    safeStorage.ts
    settings.ts
  styles/
    globals.css
    reward-ad.css
  test/
    renderWithProviders.tsx
  types/
    navigation.ts
  utils/
    __tests__/
    format.ts
  vite-env.d.ts

### Exports (src/lib/)
- contract.ts: export type RouteState =; export type EntrepreneurStatus = 'registered' | 'not_registered'; export type InsuranceStatus = 'covered' | 'not_covered' | 'voluntary'; export type MonthRecord =; export type DiagnosisResult =; export type JUDGMENT_RULESFn = () =>; export type formatCurrencyFn = (amount: number, opts?:; export type diagnoseFn = (records: MonthRecord[], entrepreneurStatus: EntrepreneurStatus) => DiagnosisResult
- routeState.ts: export function parseRouteState(url: string): RouteState; export function prevMonthKey(now: Date): string; export function parseHomeState(state: unknown):; export function parseProfileState(state: unknown):; export interface ParsedRecordState; export function parseRecordState(state: unknown, now: Date = new Date()): ParsedRecordState; export function parseYearState(state: unknown): number
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type StorageError = 'STORAGE_FULL' | 'STORAGE_UNAVAILABLE' | 'INVALID_INPUT'; export type StorageResult<T> = |; export interface UserProfile; export interface MonthlyIncomeRecord; export interface RecordsStore; export interface AppSettings; export interface ReportUnlock; export interface RuleSet
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string
- validation.ts: export function validateAmount(raw: string): string | null; export function validateMemo(memo: string): string | null; export function validateRecord(amountKrw: number):

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TabLayout.tsx: TabLayout
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
- home/ReminderBanner.tsx: shouldShowReminder, ReminderBanner
- record/MonthPickerSheet.tsx: MonthPickerSheet
- record/StatusChangeDialog.tsx: StatusChangeDialog
- settings/RulesSheet.tsx: RulesSheet
- simulate/CompareCard.tsx: CompareCard

### Module Dependencies (import graph)
  lib/routeState.ts → imports: types/navigation, lib/contract
  pages/History.tsx → imports: components/ScreenScaffold, components/Sparkline, components/AdSlot, components/StateView, domain/diagnosis, utils/format, lib/routeState, state/AppDataContext, types/navigation
  pages/Home.tsx → imports: components/ScreenScaffold, components/SummaryHero, components/Card, components/CountUp, components/MiniBar, components/AdSlot, components/StateView, components/home/ReminderBanner, domain/diagnosis, domain/rules, utils/format, lib/routeState, state/AppDataContext, types/navigation, lib/types
  pages/Profile.tsx → imports: components/ScreenScaffold, components/BottomCTA, components/Card, state/AppDataContext, lib/routeState, domain/rules
  pages/Record.tsx → imports: components/ScreenScaffold, components/BottomCTA, components/record/MonthPickerSheet, components/record/StatusChangeDialog, state/AppDataContext, lib/routeState, domain/diagnosis, domain/rules, lib/validation, utils/format, storage/records, types/navigation, lib/types
  pages/Simulate.tsx → imports: components/ScreenScaffold, components/AdSlot, components/simulate/CompareCard, domain/diagnosis, domain/simulation, domain/rules, lib/validation, utils/format, lib/routeState, state/AppDataContext
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입 + RouteState 계약 정의 (files: src/lib/types.ts, src/types/navigation.ts)
- 0002: 판정 규칙 상수 + 표시 포맷 유틸 (files: src/domain/rules.ts, src/utils/format.ts, src/utils/__tests__/format.test.ts, src/domain/__tests__/rules.test.ts)
- 0003: 안전 저장소 코어 + 프로필·설정·리포트 열람 저장 (files: src/storage/safeStorage.ts, src/storage/profile.ts, src/storage/settings.ts, src/storage/reportUnlock.ts, src/storage/__tests__/core.test.ts)
- 0004: 월별 소득 기록 저장소(CRUD+검증) + 전체 삭제 (files: src/storage/records.ts, src/storage/clearAll.ts, src/storage/__tests__/records.test.ts)
- 0005: 진단 엔진: 연 환산·판정·보험료·시뮬레이션 순수 함수 (files: src/domain/diagnosis.ts, src/domain/simulation.ts, src/domain/__tests__/diagnosis.test.ts, src/domain/__tests__/simulation.test.ts)
- 0006: 폼 검증 + Route State 파서 + AppDataContext + 테스트 하네스 (files: src/lib/validation.ts, src/lib/routeState.ts, src/state/AppDataContext.tsx, src/test/renderWithProviders.tsx, src/lib/__tests__/dataLayer.test.tsx)
- 0008: RecordPage 부품 — 월 선택 BottomSheet (files: src/components/record/MonthPickerSheet.tsx, src/components/record/__tests__/MonthPickerSheet.test.tsx)
- 0009: RecordPage 부품 — 자격 상태 변화 AlertDialog (files: src/components/record/StatusChangeDialog.tsx, src/components/record/__tests__/StatusChangeDialog.test.tsx)
- 0011: HomePage 부품 — 월간 입력 리마인더 배너 (files: src/components/home/ReminderBanner.tsx, src/components/home/__tests__/ReminderBanner.test.tsx)
- 0015: SimulatePage 부품 — 현재/시뮬레이션 비교 카드 (files: src/components/simulate/CompareCard.tsx, src/components/simulate/__tests__/CompareCard.test.tsx)
- 0017: SettingsPage 부품 — 계산 기준 BottomSheet (files: src/components/settings/RulesSheet.tsx, src/components/settings/__tests__/RulesSheet.test.tsx)
- 0007: ProfilePage — 사업자등록 여부 온보딩/수정 (/profile) (files: src/pages/Profile.tsx, src/pages/__tests__/Profile.test.tsx)
- 0010: RecordPage — 월 소득 입력 폼·저장·상태 변화 연결 (/record) (files: src/pages/Record.tsx, src/pages/__tests__/Record.test.tsx)
- 0012: HomePage — 진단 대시보드·빈 상태·저장 Toast·배너 광고 (/) (files: src/pages/Home.tsx, src/pages/__tests__/Home.test.tsx)
- 0014: HistoryPage — 연도 탭·월별 목록·누적·추이·삭제 (/history) (files: src/pages/History.tsx, src/pages/__tests__/History.test.tsx)
- 0016: SimulatePage — 지역가입자 전환 시뮬레이션 (/simulate) (files: src/pages/Simulate.tsx, src/pages/__tests__/Simulate.test.tsx)
- 0019: 라우팅 연결 + 탭바 레이아웃 + Provider 배선 (App.tsx) (files: src/App.tsx, src/components/TabLayout.tsx, src/__tests__/routes.test.tsx)