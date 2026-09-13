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
    TossPurchase.tsx
    TossRewardAd.tsx
  domain/
    __tests__/
    rules.ts
  hooks/
  lib/
    contract.ts
    storage.ts
    types.ts
    utils.ts
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
  types/
    navigation.ts
  utils/
    __tests__/
    format.ts
  vite-env.d.ts

### Exports (src/lib/)
- contract.ts: export type RouteState =; export type EntrepreneurStatus = 'registered' | 'not_registered'; export type InsuranceStatus = 'covered' | 'not_covered' | 'voluntary'; export type MonthRecord =; export type DiagnosisResult =; export type JUDGMENT_RULESFn = () =>; export type formatCurrencyFn = (amount: number, opts?:; export type diagnoseFn = (records: MonthRecord[], entrepreneurStatus: EntrepreneurStatus) => DiagnosisResult
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type StorageError = 'STORAGE_FULL' | 'STORAGE_UNAVAILABLE' | 'INVALID_INPUT'; export type StorageResult<T> = |; export interface UserProfile; export interface MonthlyIncomeRecord; export interface RecordsStore; export interface AppSettings; export interface ReportUnlock; export interface RuleSet
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

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
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입 + RouteState 계약 정의 (files: src/lib/types.ts, src/types/navigation.ts)
- 0002: 판정 규칙 상수 + 표시 포맷 유틸 (files: src/domain/rules.ts, src/utils/format.ts, src/utils/__tests__/format.test.ts, src/domain/__tests__/rules.test.ts)
- 0003: 안전 저장소 코어 + 프로필·설정·리포트 열람 저장 (files: src/storage/safeStorage.ts, src/storage/profile.ts, src/storage/settings.ts, src/storage/reportUnlock.ts, src/storage/__tests__/core.test.ts)
- 0004: 월별 소득 기록 저장소(CRUD+검증) + 전체 삭제 (files: src/storage/records.ts, src/storage/clearAll.ts, src/storage/__tests__/records.test.ts)

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/domain/rules.ts
export const RULES: RuleSet = {
export const STATUS_LABEL: Record<DiagnosisStatus, string> = {
export const DISCLAIMER_TEXT =
export const REASON_TEXT: Record<DropReason, string> = {
export const JUDGMENT_RULES: JUDGMENT_RULESFn = () => ({
export function buildRuleDescriptions(rules: RuleSet): string[] {

// src/lib/contract.ts
export type RouteState = { page: 'profile' | 'record' | 'home' | 'report' | 'history' | 'simulate' | 'settings'; params?: Record<string, string> };
export type EntrepreneurStatus = 'registered' | 'not_registered';
export type InsuranceStatus = 'covered' | 'not_covered' | 'voluntary';
export type MonthRecord = { month: string; amountKrw: number; recorded: boolean; recordedDate?: string };
export type DiagnosisResult = { status: InsuranceStatus; monthly

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(12), testing(1), ui(3)

Key lessons (verify against actual code before applying):
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)