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
// Domain types — add your app-specific types here
export {};

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
  hooks/
  lib/
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
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
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