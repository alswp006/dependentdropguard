# TASK — DependentDropGuard (피부양자 지킴이)

## 시작 전 공통 규칙

**SPEC에서 서로 맞지 않는 부분은 아래처럼 정했습니다. 모든 패킷이 이대로 따릅니다.**
- **F4-AC4 버튼 문구**: 오타 "시시뮬레이션 해보기" 대신 **"시뮬레이션 해보기"**를 씁니다. 같은 AC의 Outgoing 문구와 맞춘 것입니다.
- **F4-AC4 SAFE 보험료**: 본문의 "84,780원" 대신 참고 계산값 **"97,610원"**을 테스트 기대값으로 씁니다.
- **F8-AC8 검사 범위**: `TossPurchase`와 `IAP.` 검사에서 템플릿 래퍼를 **정의한 파일은 뺍니다**. 검사하는 것은 앱 코드의 import와 JSX 사용입니다. 템플릿 래퍼 코드는 고치지 않습니다.
- **SPEC에 없어서 이번에 정한 것** (구현 후 PO 확인 필요)
  - `/profile` edit 모드의 Top 제목은 "사업자등록 여부"입니다(설정 행 라벨을 그대로 씀).
  - F5-AC5: 저장하기 전에 그 해 기록이 0건이면(이전 진단 없음) 상태 변화 다이얼로그를 띄우지 않습니다.
  - `findDropMonth`: 미입력 달은 항목별 `Math.floor(입력 달 합계 / n)`으로 채웁니다.

**템플릿 컴포넌트 사용**
- ScreenScaffold, SubmitFooter, Card, SummaryHero, Sparkline, MiniBar, FloatingTabBar, AdSlot, TossRewardAd는 **이미 있는 경로와 props를 먼저 읽고** 그대로 import합니다. 새로 만들지 않습니다.
- TossRewardAd의 콜백 이름(보상 완료, 로드 실패, 닫기)은 템플릿 소스에서 확인한 이름을 씁니다.

**Route State 수신 패턴 (모든 페이지에 적용)**
```ts
const state = (useLocation().state as RouteState['/record'] | undefined) ?? null;
const { month, from, futureRejected } = parseRecordState(state, new Date()); // 런타임 검증 후 사용
// 금지: const { month } = useLocation().state as RouteState['/record'];
```
- 보내는 쪽은 `navigate('/record', { state: { month, from: 'home' } satisfies RouteState['/record'] })`처럼 `satisfies`로 타입을 맞춥니다.

---

## Epic 1. TypeScript 타입 (런타임 코드 없음)

**Risk**
- **복잡도**: 낮음
- **위험 요소**: 엔티티나 RouteState의 필드 이름이 SPEC과 달라지면 이후 패킷 전체가 어긋납니다. `src/types/navigation.ts`(SPEC)와 `src/lib/types.ts`(규칙) 두 곳에 타입이 따로 생길 수도 있습니다.
- **대응**: 타입은 `src/lib/types.ts` 한 곳에만 정의하고 `navigation.ts`는 re-export만 합니다. 이 태스크를 가장 먼저 끝내서 이후 패킷이 컴파일 단계에서 계약을 확인하게 합니다.

### Task 1.1 엔티티 타입 + RouteState 정의
- **Description**: SPEC Data Models의 타입을 **글자 그대로** `src/lib/types.ts`에 옮기고, 라우트별 state 타입과 `RouteState` 맵을 정의합니다.
  - 옮길 타입: StorageError, StorageResult, UserProfile, MonthlyIncomeRecord, RecordsStore, AppSettings, ReportUnlock, RuleSet, DiagnosisStatus, DropReason, AnnualSummary, DiagnosisResult, PremiumEstimate
  - RouteState 맵:
    ```ts
    export type HomeState = { savedMonth: string } | null;
    export type ProfileState = { mode: 'onboarding' | 'edit' } | null;
    export type RecordState = { month: string; from: 'home' | 'history' } | null;
    export type HistoryState = { savedMonth: string } | null;
    export type ReportState = { year: number } | null;
    export type SimulateState = { year: number } | null;
    export type RouteState = {
      '/': HomeState; '/profile': ProfileState; '/record': RecordState;
      '/history': HistoryState; '/report': ReportState; '/simulate': SimulateState;
      '/settings': undefined;
    };
    ```
  - `src/types/navigation.ts`는 위 7개 타입을 re-export만 합니다.
- **DoD**
  - `npx tsc --noEmit`이 통과합니다.
  - 두 파일에 `function`, `const`, `class` 선언이 0개입니다(타입과 인터페이스만 있음).
  - `import type { RouteState } from '@/types/navigation'`와 `'src/lib/types'` 양쪽 import가 모두 컴파일됩니다.
- **Covers**: F1-AC1~AC8의 타입 기반. 직접 검증은 Epic 2에서 합니다.
- **Files**: `src/lib/types.ts`, `src/types/navigation.ts`
- **Depends on**: 없음

---

## Epic 2. Data Layer (규칙, 포맷, 저장소, 계산, 상태)

> API Routes는 **해당 없음**입니다. SPEC §8에 따라 외부 API와 서버가 없고 localStorage만 씁니다.

**Risk**
- **복잡도**: 중간
- **위험 요소**
  - 정수 연산(bp, 10원 절사)에서 부동소수점이 섞이면 AC 기대값(122,230원 등)과 1~10원씩 어긋날 수 있습니다.
  - 템플릿 localStorage 헬퍼가 `console.error`를 호출하거나 예외를 삼키면 F1-AC7·AC8(에러 매핑, console.error 0회)을 못 맞춥니다.
  - QuotaExceeded가 난 뒤 메모리 상태와 저장소가 달라질 수 있습니다.
  - 테스트 시각을 고정하지 않으면 "이번 달" 관련 테스트가 날짜에 따라 실패합니다.
- **대응**
  - 순수 함수(rules, format, diagnosis)를 저장소와 UI보다 먼저 만들고 AC 표 그대로 단위 테스트합니다.
  - 저장소는 "기존 값 읽기 → 새 값 계산 → setItem 1회" 순서라서 setItem이 실패하면 아무것도 바뀌지 않습니다.
  - 모든 날짜 함수는 `now: Date`를 인자로 받고, 테스트는 `vi.setSystemTime`으로 시각을 고정합니다.

### Task 2.1 판정 규칙 상수 + 표시 포맷 유틸
- **Description**: 판정 상수, 표시 문구, 날짜와 금액 포맷 함수를 만듭니다.
  - `src/domain/rules.ts`: SPEC §5의 `RULES`, 상태 라벨 맵(`STATUS_LABEL`), 사유 문구 맵(`REASON_TEXT`), `DISCLAIMER_TEXT`
  - `buildRuleDescriptions(rules): string[]`: 6개 문구를 `RULES` 값으로 만듭니다. 비율은 `bp/100`을 소수 2자리로 표시합니다(719 → "7.19%").
  - `src/utils/format.ts`
    - `formatWon`, `formatMonthLabel(month, now)`
    - `formatYearMonth(month)`: 항상 "2026년 12월" 형식
    - `toMonthKey(date)`, `prevMonthKey(now)`, `isValidMonthKey`
    - `selectableMonths(now)`: 이번 달부터 전년도 1월까지 내림차순
    - `formatAmountInput(raw)`: 숫자만 남기고 콤마를 붙임
    - `parseAmountInput(display)`: 콤마 제거, 빈 문자열은 `null`
- **DoD** (`src/utils/__tests__/format.test.ts`, `src/domain/__tests__/rules.test.ts`)
  - `formatWon(20400000) === '20,400,000원'`
  - 기준 시각 2026-09-14에서 `formatMonthLabel('2026-08') === '8월'`, `formatMonthLabel('2025-12') === '2025년 12월'`
  - `prevMonthKey(new Date('2027-01-05T09:00:00+09:00')) === '2026-12'`
  - `selectableMonths(2026-09-14)`는 길이 21, `[0] === '2026-09'`, `[20] === '2025-01'`
  - `isValidMonthKey('2026-13') === false`, `isValidMonthKey('2026-01') === true`
  - `formatAmountInput('12a3') === '123'`, `formatAmountInput('1000000') === '1,000,000'`
  - `buildRuleDescriptions(RULES)`는 F7-AC4의 6개 문구와 순서까지 정확히 같습니다.
  - rules.ts에 `20,000,000`, `5,000,000`, `7.19` 같은 표시용 숫자 리터럴이 없고, 문구 숫자는 모두 `RULES`에서 만듭니다.
- **Covers**: F7-AC4(문구 생성), F2-AC7(포맷), F5-AC6(대상 월 계산), F7-AC8(DISCLAIMER_TEXT 상수)
- **Files**: `src/domain/rules.ts`, `src/utils/format.ts`, `src/utils/__tests__/format.test.ts`, `src/domain/__tests__/rules.test.ts`
- **Depends on**: Task 1.1

### Task 2.2 안전 저장소 코어 + 프로필, 설정, 리포트 열람, 전체 삭제
- **Description**: 예외를 밖으로 던지지 않는 저장소 기반과 작은 엔티티 저장 함수를 만듭니다.
  - `src/storage/safeStorage.ts`
    - `readJson<T>(key, validate, fallback)`: 파싱이나 스키마 검증에 실패하면 fallback을 반환합니다.
    - `writeJson(key, value): StorageResult<null>`: `name === 'QuotaExceededError'` 또는 `code === 22`이면 `STORAGE_FULL`, 그 밖의 예외는 `STORAGE_UNAVAILABLE`을 반환합니다.
    - `removeKeys(keys)`
    - try/catch만 쓰고 `console.*`는 호출하지 않습니다.
    - 템플릿 localStorage 헬퍼가 이 요건을 만족하면 그 위에 얇게 감싸고, 아니면 `window.localStorage`를 직접 씁니다.
  - `profile.ts`: `getProfile`, `saveProfile`(createdAt 유지, updatedAt 갱신)
  - `settings.ts`: `getSettings`, `saveSettings(patch)`
  - `reportUnlock.ts`: `getReportUnlock`, `saveReportUnlock`
  - `clearAll.ts`: `clearAllData`가 `ddg:*` 4개 키를 지웁니다.
- **DoD** (`src/storage/__tests__/core.test.ts`)
  - 빈 localStorage에서 `getProfile() === null`
  - 빈 localStorage에서 `getSettings()`는 `{ version:1, reminderEnabled:true, dismissedReminderMonth:null }`와 deepEqual
  - 빈 localStorage에서 `getReportUnlock() === null`
  - `localStorage['ddg:settings:v1'] = '"abc"'`이면 `getSettings()`는 기본값이고, `console.error` spy 호출은 0회입니다.
  - `setItem`이 `new DOMException('', 'QuotaExceededError')`를 던지면 `saveSettings({reminderEnabled:false})`는 `{ok:false, error:'STORAGE_FULL'}`입니다. 일반 `Error`를 던지면 `STORAGE_UNAVAILABLE`입니다.
  - `saveReportUnlock('2026-09')` 후 `getReportUnlock()`은 `{version:1, unlockedMonth:'2026-09'}`입니다.
  - 4개 키를 모두 넣은 뒤 `clearAllData()`를 호출하면 `{ok:true}`이고 4개 모두 `getItem === null`입니다. `removeItem`이 throw하면 `{ok:false, error:'STORAGE_UNAVAILABLE'}`입니다.
- **Covers**: F1-AC6(profile/settings/unlock), F1-AC7(settings 손상), F1-AC8(에러 매핑), F7-AC3(clearAllData)
- **Files**: `src/storage/safeStorage.ts`, `src/storage/profile.ts`, `src/storage/settings.ts`, `src/storage/reportUnlock.ts`, `src/storage/clearAll.ts`, `src/storage/__tests__/core.test.ts`
- **Depends on**: Task 1.1

### Task 2.3 월별 소득 기록 저장소 (CRUD + 검증)
- **Description**: `src/storage/records.ts`에 `getRecords`, `getRecord`, `upsertRecord`, `deleteRecord`를 만듭니다.
  - upsert는 month 기준으로 1건만 남기고, month 오름차순으로 정렬합니다.
  - 입력 검증에 실패하면 `INVALID_INPUT`을 반환하고 setItem을 호출하지 않습니다.
    - month가 정규식을 통과하지 못함
    - 금액이 정수가 아니거나 0 미만이거나 1,000,000,000 초과
    - memo가 30자 초과
  - 저장된 JSON이 손상됐거나 `'null'`이거나 items가 배열이 아니면 `[]`를 반환합니다.
- **DoD** (`src/storage/__tests__/records.test.ts`)
  - F1-AC1: 저장 후 길이 1, `[0].sideIncome === 200000`, `JSON.parse(localStorage['ddg:records:v1']).version === 1`
  - F1-AC2: 길이 2, 순서 `['2026-01','2026-08']`, `getRecord('2026-08').sideIncome === 300000`
  - F1-AC6: 빈 저장소에서 `getRecords()`는 `[]`
  - F1-AC7
    - `'{broken'`이나 `'null'`이 저장돼 있으면 `[]`를 반환하고 console.error는 0회입니다.
    - month `'2026-13'`, `salaryIncome:-1`, `1000000001`, `1.5`, memo 31자는 각각 `{ok:false, error:'INVALID_INPUT'}`이고 setItem spy 호출은 0회입니다.
  - F1-AC8: Quota mock에서 `2026-02` upsert는 `STORAGE_FULL`이고, mock 해제 후 `getRecords().length === 1`입니다.
  - `deleteRecord('2026-08')` 후 `getRecord('2026-08') === null`입니다.
- **Covers**: F1-AC1, F1-AC2, F1-AC6(records), F1-AC7, F1-AC8
- **Files**: `src/storage/records.ts`, `src/storage/__tests__/records.test.ts`
- **Depends on**: Task 2.2

### Task 2.4 진단 코어: summarizeYear, diagnose, estimatePremium
- **Description**: `src/domain/diagnosis.ts`에 SPEC §5 계산식을 정수 연산으로 구현합니다.
  - `summarizeYear`: 해당 연도 기록이 0건이면 `null`을 반환합니다.
  - `diagnose`: reasons에 해당 사유를 모두 넣습니다.
    - WARNING 임계값: `Math.floor(limit × warningRatioBp / 10000)`
    - `totalRatioPercent`: `Math.floor(totalAnnual × 100 / totalIncomeLimit)` (상한 제한 없음)
  - `estimatePremium`: 10원 절사
  - `emptySummary(year)`: 모든 값이 0인 요약. 시뮬레이션 빈 상태에서 씁니다.
- **DoD** (`src/domain/__tests__/diagnosis.test.ts`)
  - F1-AC3 표 5행이 `totalAnnual`부터 `totalRatioPercent`까지 모든 열에서 일치합니다(`it.each`).
  - summary를 직접 만든 `totalAnnual=20,000,000`, `sideAnnual=2,000,000`, 미등록 조합은 `WARNING`입니다.
  - F1-AC4: `estimatePremium(20400000)`, `estimatePremium(18000000)`, `estimatePremium(0)`이 SPEC 객체와 deepEqual입니다.
  - `estimatePremium(14400000).totalMonthly === 97610`입니다(F4-AC4 기대값).
  - `summarizeYear([], 2026) === null`
  - 함수 본문에 `toFixed`, `parseFloat`, `Math.round`가 없습니다(정수 연산만 사용).
- **Covers**: F1-AC3, F1-AC4, F1-AC6(summarizeYear)
- **Files**: `src/domain/diagnosis.ts`, `src/domain/__tests__/diagnosis.test.ts`
- **Depends on**: Task 1.1, Task 2.1

### Task 2.5 진단 확장: findDropMonth, maxSafeSideMonthly
- **Description**: `diagnosis.ts`에 두 함수를 추가합니다.
  - `findDropMonth`
    - 1~12월을 차례로 누적합니다. 입력된 달은 실제값, 미입력 달은 항목별 `Math.floor(해당 연도 입력 합계 / n)`을 씁니다.
    - 누적 total이나 누적 side가 DROP 조건(사업자 여부별 side 기준)을 처음 넘는 달을 `'YYYY-MM'`으로 반환합니다.
    - 12월까지 넘지 않거나 기록이 없으면 `null`입니다.
  - `maxSafeSideMonthly`
    - 사업자 등록: 0
    - 미등록: `Math.floor(max(0, min(limit − salary − other, sideLimit)) / 12)`
- **DoD**
  - F1-AC5
    - salary 1,500,000, side 200,000 × 3개월 → `'2026-12'`
    - salary 1,000,000, side 200,000 → `null`
    - `maxSafeSideMonthly(12000000,0,false) === 416666`
    - `maxSafeSideMonthly(20400000,0,false) === 0`
    - `maxSafeSideMonthly(12000000,0,true) === 0`
  - `maxSafeSideMonthly(15600000,0,false) === 366666`입니다(F6-AC6).
  - 사업자 등록이고 `2026-02`에만 side 10,000(1월 side 0)이면 `findDropMonth === '2026-02'`입니다.
  - 기록이 빈 배열이면 `null`입니다.
- **Covers**: F1-AC5, F6-AC4(계산), F6-AC6(계산)
- **Files**: `src/domain/diagnosis.ts`, `src/domain/__tests__/diagnosis.extra.test.ts`
- **Depends on**: Task 2.4

### Task 2.6 시뮬레이션 계산 + 상태 악화 판정
- **Description**: 시뮬레이션과 상태 변화 판정에 쓰는 순수 함수를 만듭니다.
  - `src/domain/simulation.ts`
    - `simulateScenario({ salaryMonthly, sideMonthly, otherMonthly, hasBusinessRegistration, year })`
      - 반환: `{ summary, diagnosis, premiumMonthly, premiumAnnual }`
      - 월값 × 12로 연 환산합니다. premium은 DROP일 때만 `estimatePremium` 값이고, 아니면 0입니다.
    - `baseMonthlyFromSummary(summary | null)`: `Math.floor(annual / 12)` × 3개 항목. null이면 모두 0입니다.
    - `computeNetGain(base, sim)`: 반환은 아래 3가지 중 하나입니다.
      - `{ kind:'NO_INCREASE' }`
      - `{ kind:'GAIN'|'LOSS', sideDeltaAnnual, premiumDeltaAnnual, net }`
  - `src/domain/status.ts`: `isWorse(prev, next)`. 심각도는 SAFE < WARNING < DROP입니다.
- **DoD** (`src/domain/__tests__/simulation.test.ts`)
  - base salary 1,000,000 / side 200,000, sim side 500,000(미등록)이면
    - sim diagnosis는 DROP, `summary.totalAnnual === 18000000`, `premiumMonthly === 122020`
    - netGain은 `{kind:'GAIN', sideDeltaAnnual:3600000, premiumDeltaAnnual:1464240, net:2135760}`
  - base 1,300,000/300,000, sim side 400,000이면 `{kind:'LOSS', sideDeltaAnnual:1200000, premiumDeltaAnnual:1659480, net:-459480}`
  - sim side ≤ base side이면 `kind === 'NO_INCREASE'`
  - `isWorse('SAFE','WARNING') === true`, `isWorse('WARNING','SAFE') === false`, `isWorse('DROP','DROP') === false`
- **Covers**: F6-AC2(계산), F6-AC6(계산), F5-AC5(판정)
- **Files**: `src/domain/simulation.ts`, `src/domain/status.ts`, `src/domain/__tests__/simulation.test.ts`
- **Depends on**: Task 2.4

### Task 2.7 폼 검증 + Route State 런타임 파서
- **Description**: 입력 폼 검증 함수와, 화면에 들어온 route state를 런타임에 검사하는 파서를 만듭니다.
  - `src/domain/validation.ts`의 `validateRecordForm(form)`
    - 콤마를 제거하고, 빈 문자열은 0으로 봅니다.
    - 금액 3개가 모두 빈 문자열이면 `errors.form = '금액을 1개 이상 입력해주세요 (소득이 없으면 0 입력)'`
    - 1,000,000,000을 넘으면 해당 필드 에러 `'월 소득은 10억원 이하로 입력해주세요'`
  - `src/lib/routeState.ts`: 모든 파서는 `unknown`을 받아 **null, undefined, 잘못된 타입에서 크래시 없이** 기본값을 돌려줍니다.
    - `parseSavedMonth(raw): string | null`
    - `parseProfileMode(raw, hasProfile): 'onboarding' | 'edit'`
    - `parseRecordState(raw, now): { month, from, futureRejected }`
      - 미래 달이면 이번 달로 바꾸고 `futureRejected=true`
      - 형식이 틀리거나 범위 밖이면 이번 달로 바꾸고 `futureRejected=false`
      - from 기본값은 `'home'`
    - `parseYear(raw, now): number`: `typeof year === 'number'`이고 올해 또는 전년도일 때만 그 값, 아니면 올해
- **DoD** (`src/lib/__tests__/routeState.test.ts`, `src/domain/__tests__/validation.test.ts`)
  - `validateRecordForm({salary:'',side:'1,000,000,001',other:'',memo:''})`는 `errors.side === '월 소득은 10억원 이하로 입력해주세요'`
  - 금액 3개가 모두 `''`이면 `errors.form`이 위 문구와 정확히 같습니다.
  - `{salary:'0',side:'',other:'',memo:''}`는 `ok:true`, value 금액은 모두 0입니다.
  - `parseRecordState({month:'2026-10',from:'home'})`는 `{month:'2026-09', from:'home', futureRejected:true}`
  - `parseRecordState({month:'2026-13',from:'home'})`는 `{month:'2026-09', futureRejected:false}`
  - `parseRecordState(null)`과 `parseRecordState(undefined)`는 `{month:'2026-09', from:'home', futureRejected:false}`
  - `parseYear(null)`, `parseYear({year:1999})`, `parseYear({year:'2026'})`는 모두 2026, `parseYear({year:2025})`는 2025
  - `parseProfileMode(null, false) === 'onboarding'`, `parseProfileMode(null, true) === 'edit'`
- **Covers**: F2-AC4(검증), F2-AC5(검증), F2-AC6(월 state), F4-AC8(year 파싱)
- **Files**: `src/domain/validation.ts`, `src/lib/routeState.ts`, `src/lib/__tests__/routeState.test.ts`, `src/domain/__tests__/validation.test.ts`
- **Depends on**: Task 2.1

### Task 2.8 앱 상태 관리 (AppDataContext)
- **Description**: 화면들이 공유할 앱 데이터 컨텍스트를 만듭니다.
  - `AppDataProvider`: `useState` 초기화 함수에서 profile, records, settings, reportUnlock을 **동기로** 읽습니다. 로딩 상태는 없습니다.
  - 액션: `saveProfile`, `upsertRecord`, `deleteRecord`, `saveSettings`, `unlockReport`, `clearAll`
    - 저장소 함수를 호출해 `ok`일 때만 state를 갱신하고, 결과 `StorageResult`를 그대로 반환합니다.
  - 셀렉터 훅 `useYearDiagnosis(year)`: `{ summary, diagnosis } | null`을 반환합니다. 프로필이 없으면 `hasBusinessRegistration:false`로 계산합니다.
- **DoD** (`src/state/__tests__/AppDataContext.test.tsx`)
  - 빈 저장소에서 `profile === null`, `records` 길이 0
  - `upsertRecord`가 성공하면 같은 렌더 사이클 뒤 `records` 길이가 1입니다.
  - `upsertRecord`가 STORAGE_FULL을 반환하도록 mock하면 records가 바뀌지 않고 반환값은 `{ok:false, error:'STORAGE_FULL'}`입니다.
  - `ddg:records:v1='null'`이어도 Provider가 에러 없이 렌더링되고 console.error는 0회입니다.
  - `useYearDiagnosis(2026)`은 F1-AC3 1행 데이터에서 `diagnosis.status === 'SAFE'`입니다.
- **Covers**: F3-AC7(손상 데이터 방어 기반), F1-AC6(초기 상태)
- **Files**: `src/state/AppDataContext.tsx`, `src/state/useYearDiagnosis.ts`, `src/state/__tests__/AppDataContext.test.tsx`
- **Depends on**: Task 2.2, Task 2.3, Task 2.4

### Task 2.9 페이지 테스트 하네스 + 템플릿 컴포넌트 mock
- **Description**: 페이지 테스트에서 공통으로 쓰는 도구를 만듭니다.
  - `renderWithApp(ui, { path, state, routes? })`: MemoryRouter의 `initialEntries: [{ pathname, state }]`와 AppDataProvider로 감쌉니다.
  - `mockNavigate`: `vi.mock('react-router-dom')`로 `useNavigate`를 부분 mock합니다.
  - `setupTestClock()`: `vi.setSystemTime(new Date('2026-09-14T09:00:00+09:00'))`
  - `seedRecords(rows)`, `seedProfile(bool)`
  - `mockTossRewardAd`: 템플릿 TossRewardAd props를 확인한 뒤 보상 완료, 로드 실패, 닫기 콜백을 테스트에서 직접 발생시키는 컨트롤러를 노출합니다.
  - `mockAdSlot`
- **DoD**
  - 하네스로 `<div>hi</div>`를 `/record`와 `state={month:'2026-08',from:'home'}`로 렌더링하면 `useLocation().state.month === '2026-08'`임을 확인하는 셀프 테스트가 통과합니다.
  - `new Date()`는 2026-09-14를 반환합니다.
  - `mockTossRewardAd.fireRewarded()`, `fireLoadError()`, `fireClose()`를 부르면 해당 콜백 prop이 1회씩 호출됩니다.
  - `npx tsc --noEmit`이 통과합니다.
- **Covers**: F4-AC1, F4-AC6, F4-AC7, F8-AC2의 테스트 기반(직접 검증은 Epic 3·4)
- **Files**: `src/test/renderWithApp.tsx`, `src/test/mocks.tsx`, `src/test/__tests__/harness.test.tsx`
- **Depends on**: Task 2.8

---

## Epic 3. Core UI Pages (한 태스크에 한 페이지 또는 한 페이지의 한 부분)

**Risk**
- **복잡도**: 높음
- **위험 요소**
  - TDS 컴포넌트에 인라인 여백을 넣으면 검수에서 반려됩니다.
  - state 없이 직접 들어오면(`/record`, `/report`, `/history` 새로고침) 크래시할 수 있습니다.
  - Record, Home, Report, Simulate는 기능이 많아 10분 안에 끝내기 어렵습니다.
  - CountUp 애니메이션 때문에 최종 값 테스트가 불안정할 수 있습니다.
  - TossRewardAd 콜백 이름을 추측하면 틀릴 수 있습니다.
- **대응**
  - 공용 표시 컴포넌트(3.0)를 먼저 만듭니다.
  - 큰 페이지는 기본 화면 → 부가 기능(시트, 다이얼로그, 광고) 순서로 나눕니다.
  - 모든 수신 화면은 Task 2.7 파서를 거치고, "state 없이 직접 진입" 추가 AC(RS-*)를 DoD에 넣습니다.
  - CountUp은 fake timer로 끝까지 진행시키거나 템플릿의 reduced-motion 경로로 최종 값을 확인합니다.
  - 탭바는 Epic 4 레이아웃에서 한 번만 붙이고, 각 페이지는 하단 `Spacing`만 둡니다.

### Task 3.0 공용 표시 컴포넌트
- **Description**: 여러 화면에서 쓰는 작은 컴포넌트 3개를 만듭니다.
  - `StatusBadge({ status })`: TDS Badge에 `STATUS_LABEL` 텍스트를 넣습니다. 색은 TDS Badge prop만 씁니다.
  - `AmountTextField`
    - TDS TextField에 `inputMode="numeric"`, 기본 `enterKeyHint="next"`
    - onChange에서 `formatAmountInput`으로 표시값을 만들고, placeholder는 "0"
    - 에러 문구는 TDS TextField의 에러 prop으로 표시합니다(설치된 버전의 타입 정의 확인).
    - `onEnter`와 forwardRef를 지원합니다.
  - `DisclaimerText`: `<Paragraph.Text>{DISCLAIMER_TEXT}</Paragraph.Text>`
- **DoD**
  - `AmountTextField`에 "12a3"을 입력하면 input value는 "123", "1000000"이면 "1,000,000"입니다.
  - input에 `inputmode="numeric"`, `enterkeyhint="next"` 속성이 있습니다.
  - Enter를 누르면 `onEnter`가 1회 호출됩니다.
  - `StatusBadge status="DROP"`의 텍스트는 "탈락 위험"입니다.
  - 세 파일에 `style={{`로 padding이나 margin을 넣은 곳이 0건, HEX 문자열이 0건입니다.
- **Covers**: F2-AC7(입력 포맷, 키보드 속성), F7-AC8(면책 컴포넌트)
- **Files**: `src/components/StatusBadge.tsx`, `src/components/AmountTextField.tsx`, `src/components/DisclaimerText.tsx`, `src/components/__tests__/shared.test.tsx`
- **Depends on**: Task 2.1

### Task 3.1 ProfilePage — 온보딩과 수정 (`/profile`)
- **Description**: 사업자등록 여부를 받는 화면입니다.
  - 모드: `parseProfileMode(state, !!profile)`
    - onboarding: Top "시작하기 전에", 버튼 "시작하기"
    - edit: Top "사업자등록 여부", 버튼 "저장하기"
  - 선택형 ListRow 2개(`biz-option-yes`, `biz-option-no`)
    - 선택된 행은 `aria-checked="true"`와 체크 Asset을 표시합니다.
    - edit 모드에서는 기존 값을 미리 선택합니다.
  - SubmitFooter 버튼은 선택 전 `disabled`입니다.
  - 저장 성공: onboarding은 `navigate('/', {replace:true})`, edit은 `navigate('/settings', {replace:true})`
  - 저장 실패: Toast "저장 공간이 부족해 저장하지 못했어요"(STORAGE_FULL) 또는 "저장하지 못했어요. 다시 시도해주세요"(그 밖의 실패)
  - `DisclaimerText`를 1회 표시합니다.
- **DoD**
  - F2-AC1: 프로필이 없고 state가 `{mode:'onboarding'}`이면 제목 "시작하기 전에", 버튼 `disabled`입니다. `biz-option-no` → "시작하기"를 탭하면 `getProfile().hasBusinessRegistration === false`이고 `mockNavigate('/', {replace:true})`가 호출됩니다.
  - F7-AC2: 프로필이 false이고 `{mode:'edit'}`이면 `biz-option-no`는 `aria-checked="true"`, 버튼은 "저장하기"입니다. `biz-option-yes` → 저장하면 `hasBusinessRegistration === true`이고 `mockNavigate('/settings', {replace:true})`가 호출됩니다.
  - F7-AC7: 프로필이 없고 `{mode:'edit'}`이면 "저장하기"가 `disabled`입니다.
  - F7-AC8: `DISCLAIMER_TEXT` 텍스트 노드가 정확히 1개이고, 화면 안에 `a[href^="http"]`가 0개입니다.
  - **RS-PROFILE**: state 없이(null/undefined) 직접 들어와도 크래시하지 않습니다. 프로필이 없으면 onboarding UI, 있으면 edit UI가 렌더링되고 console.error는 0회입니다.
- **Covers**: F2-AC1, F7-AC2, F7-AC7, F7-AC8
- **Files**: `src/pages/ProfilePage.tsx`, `src/pages/__tests__/ProfilePage.test.tsx`
- **Depends on**: Task 3.0, Task 2.7, Task 2.9

### Task 3.2 RecordPage — 입력 폼과 저장 (`/record`)
- **Description**: 월 소득 입력 화면의 기본 흐름입니다.
  - 월 결정: `parseRecordState(state, now)`. `futureRejected`이면 마운트 시 Toast "미래 달은 입력할 수 없어요"를 1회 띄웁니다.
  - 기존 기록이 있으면
    - 값을 콤마 포맷으로 채웁니다(0은 "0").
    - Top은 `"{formatMonthLabel} 소득 수정"`, 없으면 `"… 소득 입력"`입니다.
  - 필드
    - `AmountTextField` 3개: `input-salary`, `input-side`, `input-other`. Enter를 누르면 다음 필드로 포커스를 옮깁니다.
    - 메모 TextField(`input-memo`): `maxLength={30}`, `enterKeyHint="done"`
  - "저장하기"를 누르면 `validateRecordForm`으로 검증합니다.
    - 실패: 필드 에러, 또는 폼 에러 Paragraph.Text를 표시합니다.
    - 성공: `upsertRecord`를 호출합니다.
      - 성공하면 `navigate(from==='history'?'/history':'/', {replace:true, state:{savedMonth} satisfies RouteState['/']})`
      - 실패하면 Toast("저장 공간이 부족해 저장하지 못했어요" 또는 일반 실패 문구)를 띄우고 화면에 머뭅니다.
- **DoD**
  - F2-AC2: 입력 후 저장하면 `getRecord('2026-08')`이 `{salaryIncome:1000000, sideIncome:200000, otherIncome:0, memo:'스마트스토어'}`와 일치하고, `mockNavigate('/', {replace:true, state:{savedMonth:'2026-08'}})`가 호출됩니다.
  - F2-AC3: from history로 들어오면 제목 "8월 소득 수정", 값은 "1,000,000", "200,000", "0"입니다. 저장하면 `mockNavigate('/history', {replace:true, state:{savedMonth:'2026-08'}})`가 호출됩니다.
  - F2-AC4: side "1000000001"을 저장하면 에러 문구가 표시되고 `getRecord('2026-09') === null`입니다.
  - F2-AC5
    - 금액이 모두 빈 값이면 폼 에러 문구가 표시되고 저장 호출은 0회입니다.
    - salary "0"만 입력하면 금액 3개 모두 0으로 저장됩니다.
  - F2-AC6
    - STORAGE_FULL mock이면 Toast "저장 공간이 부족해 저장하지 못했어요"가 뜨고 navigate는 0회입니다.
    - `{month:'2026-10'}`로 들어오면 제목에 "9월"이 들어가고 Toast "미래 달은 입력할 수 없어요"가 뜹니다.
    - `{month:'2026-13'}`로 들어오면 "9월"이고 Toast는 없습니다.
  - F2-AC7
    - 금액 input 3개는 `inputmode="numeric"`, `enterkeyhint="next"`이고, 메모는 `maxlength="30"`, `enterkeyhint="done"`입니다.
    - `input-other`에서 Enter를 누르면 `document.activeElement`가 `input-memo`이고, "저장하기" 버튼은 DOM에 남아 있습니다.
  - **RS-RECORD**: state 없이 직접 들어오면 크래시 없이 "9월 소득 입력" 화면이 보이고, 저장하면 `/`로 이동합니다.
- **Covers**: F2-AC2, F2-AC3, F2-AC4, F2-AC5, F2-AC6, F2-AC7
- **Files**: `src/pages/RecordPage.tsx`, `src/pages/__tests__/RecordPage.form.test.tsx`
- **Depends on**: Task 3.0, Task 2.7, Task 2.9

### Task 3.3 RecordPage — 월 선택 BottomSheet와 중복 저장 방지
- **Description**: RecordPage에 월 선택과 저장 중 상태를 추가합니다.
  - `month-picker` ListRow를 탭하면 TDS BottomSheet가 열립니다.
    - `selectableMonths(now)` 21개를 ListRow로 표시하고, 라벨은 `formatMonthLabel`입니다.
    - 기록이 있는 달에만 보조 문구 "입력됨"을 붙입니다.
    - 행을 탭하면 시트를 닫고 선택 월을 바꾼 뒤 해당 기록 값으로 폼을 다시 채웁니다(기록이 없으면 빈 값).
  - 저장 중 상태
    - `useRef` 플래그로 중복 저장을 막고, 버튼에 `loading`과 `disabled`를 켭니다.
- **DoD**
  - F2-AC8: `month-picker`를 탭하면 시트 안 ListRow가 21개입니다.
    - 첫 행 텍스트 "9월", 마지막 행 "2025년 1월"
    - "입력됨"을 포함한 행은 "8월" 1개뿐입니다.
  - "8월"을 탭하면 시트가 닫히고(`queryByRole('dialog')`가 null) `input-salary` 값이 저장된 값입니다.
  - "저장하기"를 동기로 2회 연속 클릭하면 `upsertRecord` spy 호출은 1회입니다.
  - 저장 진행 중 버튼은 `disabled` 속성을 가집니다.
- **Covers**: F2-AC8
- **Files**: `src/pages/RecordPage.tsx`, `src/pages/record/MonthPickerSheet.tsx`, `src/pages/__tests__/RecordPage.picker.test.tsx`
- **Depends on**: Task 3.2

### Task 3.4 RecordPage — 자격 상태 변화 AlertDialog
- **Description**: 저장으로 자격 상태가 나빠지면 알려줍니다.
  - 저장하기 **직전**에 저장 월이 속한 해의 진단(prev)을 구합니다. 기록이 0건이면 prev는 없습니다.
  - 저장이 성공하면 같은 해의 진단(next)을 다시 구합니다.
  - `prev && isWorse(prev.status, next.status)`이면 이동을 멈추고 AlertDialog를 띄웁니다.
    - 제목 "자격 상태가 바뀌었어요"
    - 본문 `"${STATUS_LABEL[prev]} → ${STATUS_LABEL[next]}"`
    - 버튼 "확인"
  - "확인"을 누르면 원래 목적지로 `navigate(..., {replace:true, state:{savedMonth}})`합니다.
  - 그 밖의 경우에는 바로 이동합니다.
- **DoD**
  - F5-AC5: SAFE 2개월이 있는 상태에서 `2026-03`에 1,000,000/700,000을 저장하면
    - 다이얼로그 제목과 본문 "안전 → 주의"가 표시되고, 이 시점 navigate 호출은 0회입니다.
    - "확인"을 탭하면 `mockNavigate('/', {replace:true, state:{savedMonth:'2026-03'}})`가 1회 호출됩니다.
  - WARNING → SAFE로 바뀌는 저장은 다이얼로그 없이 navigate가 즉시 1회 호출됩니다.
  - 그 해 첫 기록 저장은 다이얼로그 없이 이동합니다.
- **Covers**: F5-AC5
- **Files**: `src/pages/RecordPage.tsx`, `src/pages/__tests__/RecordPage.statusDialog.test.tsx`
- **Depends on**: Task 3.2, Task 2.6

### Task 3.5 HomePage — 진단 대시보드와 빈 상태 (`/`)
- **Description**: 홈 진단 화면의 본문입니다.
  - 프로필이 없으면 `<Navigate to="/profile" replace state={{mode:'onboarding'} satisfies RouteState['/profile']} />`
  - ScreenScaffold(Top "피부양자 지킴이")
  - `useYearDiagnosis(올해)`로 진단합니다.
  - 올해 기록이 있을 때
    - `status-hero`: SummaryHero(value=totalAnnual, 포맷 `formatWon`, 보조 문구 `"{n}개월 입력 기준 연 환산"`)와 StatusBadge
    - `threshold-minibar`: `aria-valuenow = min(100, totalRatioPercent)`. 템플릿 MiniBar가 aria 속성을 받지 못하면 `role="progressbar"`인 레이아웃 전용 div로 감쌉니다(padding/margin 없음).
    - `margin-card` 문구
      - DROP: "기준을 {over}원 초과했어요"와 사유 문구 전부
      - DROP이 아니고 사업자 등록: "사업자등록 상태에서는 부업 소득이 생기면 자격이 유지되지 않아요"
      - 그 밖: "기준까지 연 {margin}원 여유가 있어요"
    - Button `display="block"` 2개
      - "상세 리포트 보기" → `/report {year}`
      - "이번 달 소득 입력" → `/record {month: 이번 달, from:'home'}`
    - 면책 문구
  - 올해 기록이 없을 때: Asset.ContentIcon, "아직 입력된 소득이 없어요", Button "소득 입력하기"
- **DoD**
  - F3-AC1: Badge "안전", 최종 값 "14,400,000원", "3개월 입력 기준 연 환산", `aria-valuenow="72"`, "기준까지 연 2,600,000원 여유가 있어요"
  - F3-AC2: "탈락 위험", "20,400,000원", `aria-valuenow="100"`, "기준을 400,000원 초과했어요", "연간 합산 소득이 2,000만원을 넘어요"
  - F3-AC3
    - 1,200,000/250,000이면 "주의", "17,400,000원", "기준까지 연 2,000,000원 여유가 있어요"
    - 사업자 등록 1,000,000/0이면 "안전"과 사업자 문구
  - F3-AC4
    - `compareDocumentPosition`으로 순서 hero → minibar → margin-card → 버튼 2개 → 면책 문구를 확인합니다.
    - 두 Button 모두 `display="block"`입니다.
    - `mockNavigate('/report', {state:{year:2026}})`와 `mockNavigate('/record', {state:{month:'2026-09', from:'home'}})`를 확인합니다.
  - F3-AC5: 기록이 `2025-12`뿐이면 hero, minibar, margin-card testid가 모두 null이고, 빈 상태 문구와 버튼이 있으며, 버튼을 누르면 `/record {month:'2026-09', from:'home'}`입니다.
  - F3-AC7: `ddg:records:v1='null'`이면 빈 상태가 표시되고 console.error는 0회입니다.
  - F2-AC1(홈 쪽): 프로필이 없으면 `/profile`로 replace되고 "시작하기 전에"가 렌더링됩니다(테스트 routes에 ProfilePage 포함).
  - **RS-HOME**: state가 null이거나 `{savedMonth: 123}`처럼 잘못돼도 크래시와 Toast 없이 렌더링됩니다.
- **Covers**: F3-AC1, F3-AC2, F3-AC3, F3-AC4, F3-AC5, F3-AC7, F2-AC1
- **Files**: `src/pages/HomePage.tsx`, `src/pages/__tests__/HomePage.diagnosis.test.tsx`
- **Depends on**: Task 3.0, Task 2.8, Task 2.9, Task 3.1

### Task 3.6 HomePage — 리마인더 배너, 저장 Toast, 배너 광고
- **Description**: 홈에 부가 요소 3가지를 붙입니다.
  - **리마인더 배너**
    - 표시 조건: `settings.reminderEnabled && profile && !getRecord(prevMonthKey(now)) && dismissedReminderMonth !== target`
    - 위치: hero 위에 `reminder-banner` Card
    - 문구: `"{formatMonthLabel(target)} 소득을 아직 입력하지 않았어요"`
    - "입력하기" → `/record {month:target, from:'home'}`
    - "닫기" → `saveSettings({dismissedReminderMonth:target})`
  - **저장 Toast**
    - `parseSavedMonth(state)`가 있으면 Toast `"{formatMonthLabel} 소득을 저장했어요"`를 1회 띄우고, 곧바로 `navigate('/', {replace:true, state:null})`합니다.
    - StrictMode에서 두 번 뜨지 않도록 ref로 막습니다.
  - **배너 광고**
    - `VITE_TOSS_AD_GROUP_ID`가 truthy일 때만 버튼 아래에 `<div data-testid="home-ad-slot"><AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} /></div>`를 둡니다.
    - 마지막 콘텐츠 아래에 하단 `Spacing`을 둡니다.
- **DoD**
  - F5-AC6
    - 조건이 맞으면 "8월 소득을 아직 입력하지 않았어요"가 표시됩니다.
    - "입력하기"를 누르면 `mockNavigate('/record', {state:{month:'2026-08', from:'home'}})`가 호출됩니다.
    - "닫기"를 누르면 `getSettings().dismissedReminderMonth === '2026-08'`이고 배너 testid가 null입니다.
    - `reminderEnabled:false`이면 배너가 null입니다.
    - 시각을 2027-01-05로 두면 "2026년 12월 소득을 아직 입력하지 않았어요"입니다.
  - F3-AC6: `{savedMonth:'2025-12'}`로 들어오면 "2025년 12월 소득을 저장했어요" Toast가 1개 뜨고, `mockNavigate('/', {replace:true, state:null})`가 호출되며, rerender 후에도 Toast 호출은 누적 1회입니다.
  - F2-AC2(홈 쪽): `{savedMonth:'2026-08'}`로 들어오면 "8월 소득을 저장했어요"가 표시됩니다.
  - F3-AC8
    - env가 `''`이면 `home-ad-slot`이 null이고 AC-4 요소는 모두 존재하며 console.error는 0회입니다.
    - env가 있으면 `home-ad-slot`이 두 번째 Button 뒤, 면책 문구 앞에 있습니다.
  - 배너의 두 Button은 TDS Button이고 size prop이 44px 미만 규격(tiny 등)이 아닙니다.
- **Covers**: F5-AC6, F3-AC6, F3-AC8, F2-AC2
- **Files**: `src/pages/HomePage.tsx`, `src/pages/home/ReminderBanner.tsx`, `src/pages/__tests__/HomePage.extras.test.tsx`
- **Depends on**: Task 3.5

### Task 3.7 HistoryPage — 연도 탭, 목록, 누적, 추이 (`/history`)
- **Description**: 월별 소득 추적 화면의 본문입니다.
  - ScreenScaffold(Top "월별 소득 추적")
  - TDS Tab "{올해}년", "{전년도}년". 기본은 올해입니다.
  - `ytd-card`: t3 강조 텍스트
    - 올해: "올해 누적 {합계}"
    - 전년도: "{year}년 누적 {합계}"
  - Sparkline
    - 그 해 기록이 2건 이상이면 월 오름차순 합계 배열을 `income-sparkline`에 넣습니다.
    - 1건 이하면 "2개월 이상 입력하면 추이를 볼 수 있어요"를 표시합니다(0건일 때는 빈 상태 문구와 함께 표시).
  - `month-row`
    - 올해는 이번 달부터 1월까지, 전년도는 12월부터 1월까지 내림차순입니다.
    - 기록이 있으면 합계 금액, 없으면 "미입력"을 표시합니다.
    - 직전 달 기록이 있으면 증감 `"+x원"` 또는 `"-x원"`을 붙입니다.
    - 행을 탭하면 `/record {month, from:'history'}`로 이동합니다.
  - 빈 상태: 그 해 기록이 0건이면 Asset.ContentIcon과 "이 해에 입력된 소득이 없어요"
  - 저장 Toast: `savedMonth` state가 있으면 Toast "{월라벨} 소득을 저장했어요"를 1회 띄우고 `navigate('/history', {replace:true, state:null})`합니다.
  - 목록 끝에 하단 `Spacing`을 둡니다.
- **DoD**
  - F5-AC1
    - `month-row`는 9개이고 첫 행 "9월", 마지막 행 "1월"입니다.
    - "3월" 행은 "1,400,000원"과 "+200,000원", "2월" 행은 "1,200,000원"과 "+200,000원"입니다.
    - "1월" 행에는 "+"나 "-" 증감 텍스트가 없습니다.
    - "4월"~"9월" 행은 "미입력"입니다.
    - `ytd-card`에 "올해 누적 3,600,000원"이 있습니다.
  - F5-AC2
    - Sparkline mock이 받은 data가 `[1000000,1200000,1400000]`입니다.
    - 기록이 1건이면 `income-sparkline`이 null이고 대체 문구가 표시됩니다.
  - F5-AC3(페이지 쪽)
    - "3월" 행을 탭하면 `mockNavigate('/record', {state:{month:'2026-03', from:'history'}})`가 호출됩니다.
    - `{savedMonth:'2026-03'}`로 들어오면 Toast "3월 소득을 저장했어요"가 뜹니다.
  - F5-AC7
    - "2025년" 탭을 누르면 빈 상태 문구가 표시되고, `month-row` 12개가 "12월"~"1월"이며 모두 "미입력"입니다.
    - "2025년 누적 0원"이고 `income-sparkline`은 null입니다.
    - 마지막 `month-row` 뒤에 Spacing 요소가 있습니다.
  - **RS-HISTORY**: state 없이 직접 들어오면 크래시와 Toast 없이 목록이 렌더링됩니다.
- **Covers**: F5-AC1, F5-AC2, F5-AC3, F5-AC7
- **Files**: `src/pages/HistoryPage.tsx`, `src/pages/__tests__/HistoryPage.list.test.tsx`
- **Depends on**: Task 2.8, Task 2.9, Task 2.1

### Task 3.8 HistoryPage — 삭제 흐름과 배너 광고
- **Description**: 기록 삭제와 배너 광고를 추가합니다.
  - 기록이 있는 행 오른쪽에 TDS Button "삭제"(`delete-button`). 탭 이벤트가 행 탭으로 전파되지 않게 막습니다.
  - AlertDialog
    - 제목 "{월라벨} 소득 기록을 삭제할까요?"
    - 버튼 "취소"와 "삭제"
  - 삭제 성공: Toast "{월라벨} 기록을 삭제했어요"
  - 삭제 실패: Toast "삭제하지 못했어요. 다시 시도해주세요"
  - 목록 뒤에 `history-ad-slot` 래퍼 + AdSlot을 둡니다(env가 있을 때만).
- **DoD**
  - F5-AC4
    - "3월" 삭제 버튼을 누르면 다이얼로그 제목이 표시되고, 이때 `mockNavigate` 호출은 0회입니다(전파 차단).
    - "삭제"를 누르면 `getRecord('2026-03') === null`, Toast가 뜨고, "3월" 행은 "미입력"입니다.
    - "취소"를 누르면 `getRecords().length === 3`입니다.
  - F5-AC8: `deleteRecord` mock이 실패를 반환하면 Toast "삭제하지 못했어요. 다시 시도해주세요"가 뜨고 "3월" 행은 "1,400,000원"입니다.
  - "삭제" 버튼은 TDS Button이고 44×44px 미만 size를 쓰지 않습니다.
  - `history-ad-slot`은 마지막 `month-row` 뒤에 위치합니다.
- **Covers**: F5-AC4, F5-AC8
- **Files**: `src/pages/HistoryPage.tsx`, `src/pages/__tests__/HistoryPage.delete.test.tsx`
- **Depends on**: Task 3.7

### Task 3.9 ReportPage — 리포트 본문과 빈 상태 (`/report`)
- **Description**: 상세 리포트의 **열린 상태 본문**을 `ReportBody` 컴포넌트로 만듭니다. 이 태스크에서는 광고 게이트 없이 본문을 바로 보여줍니다.
  - 연도: `parseYear(state, now)`
  - `criteria-card` 2개
    - [0] "연간 합산 소득", "{total} / 기준 {limit}", Badge "초과" 또는 "충족"
    - [1] "부업 소득 (사업자 미등록|사업자 등록)", "{side} / 기준 {sideLimit}", Badge
  - `premium-card`
    - 제목: DROP이면 "예상 월 보험료", 아니면 "탈락 시 예상 월 보험료(현재 소득 기준)"
    - t2 강조: totalMonthly
    - ListRow 3개: "건강보험료 x원", "장기요양보험료 x원", "연간 x원"
  - `drop-month-card`
    - findDropMonth 결과가 있으면 "{formatYearMonth}에 기준을 넘을 것으로 예상돼요"
    - 없으면 "올해 안에는 기준을 넘지 않을 것으로 보여요"
  - `income-breakdown`: MiniBar 3개. 라벨은 "본업 n%", "부업 n%", "기타 n%"이고 n은 `Math.round(항목 × 100 / totalAnnual)`, totalAnnual이 0이면 0입니다.
  - Button `display="block"` "시뮬레이션 해보기" → `/simulate {year}`
  - 면책 문구와 "재산·자동차분은 제외하고 소득분만 반영한 추정치예요"
  - 빈 상태: 그 해 기록이 0건이면 Asset.ContentIcon, "소득을 입력하면 리포트를 볼 수 있어요", "소득 입력하기" → `/record {month: 이번 달, from:'home'}`
  - 배너 AdSlot은 넣지 않습니다.
- **DoD**
  - F4-AC3
    - criteria[0]에 "20,400,000원 / 기준 20,000,000원"과 "초과"
    - criteria[1]에 "부업 소득 (사업자 미등록)", "2,400,000원 / 기준 5,000,000원", "충족"
    - premium은 "예상 월 보험료", "138,290원", "건강보험료 122,230원", "장기요양보험료 16,060원", "연간 1,659,480원"
    - drop-month는 "2026년 12월에 기준을 넘을 것으로 예상돼요"
  - F4-AC4
    - criteria-card 2개, premium-card 1개, drop-month-card 1개, MiniBar 3개입니다.
    - 라벨은 "본업 88%", "부업 12%", "기타 0%"입니다.
    - SAFE 데이터면 제목 "탈락 시 예상 월 보험료(현재 소득 기준)", "97,610원", "올해 안에는 기준을 넘지 않을 것으로 보여요"입니다.
    - "시뮬레이션 해보기"를 누르면 `mockNavigate('/simulate', {state:{year:2026}})`가 호출됩니다.
  - F4-AC5: 기록이 0건이면 빈 상태 문구와 버튼이 있고 `report-gate`는 null입니다.
  - F4-AC8: state가 null, `{year:1999}`, `{year:'2026'}`인 3가지 경우 모두 "탈락 위험" 기준 본문이 렌더링되고 console.error는 0회입니다.
  - F7-AC8: 본문에 `DISCLAIMER_TEXT`가 1회 있고 외부 링크는 0개입니다.
  - **RS-REPORT**: state 없이 직접 들어와도 크래시하지 않습니다(F4-AC8과 같은 테스트로 확인).
  - `ReportPage.tsx`에 AdSlot import가 0건입니다.
- **Covers**: F4-AC3, F4-AC4, F4-AC5, F4-AC8, F7-AC8
- **Files**: `src/pages/ReportPage.tsx`, `src/pages/report/ReportBody.tsx`, `src/pages/__tests__/ReportPage.body.test.tsx`
- **Depends on**: Task 2.5, Task 2.7, Task 2.8, Task 2.9, Task 3.0

### Task 3.10 ReportPage — 보상형 광고 게이트
- **Description**: 리포트 본문 앞에 광고 게이트를 붙입니다.
  - 기록이 있고 `reportUnlock?.unlockedMonth !== 이번 달`이면 잠금 화면을 보여줍니다.
    - `report-gate` Card: StatusBadge, 잠긴 ListRow 3개("기준별 판정", "예상 건강보험료", "탈락 예상 시점")
    - `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 감싼 Button `display="block"` "광고 보고 상세 리포트 열기"
  - 콜백 처리(콜백 이름은 템플릿 소스 기준)
    - 보상 완료: `unlockReport(이번 달)` 후 본문 표시
    - 로드 실패: Toast "광고를 불러오지 못했어요. 리포트를 바로 보여드릴게요"를 띄우고 **세션 한정** state로 본문을 표시합니다. 열람 상태는 저장하지 않습니다.
    - 보상 전 닫기: Toast "광고를 끝까지 보면 리포트가 열려요"를 띄우고 잠금을 유지합니다.
  - 광고 로딩 중에는 Button을 `loading`·`disabled`로 두고, ref 가드로 연속 탭해도 표시 요청이 1회만 가게 합니다.
  - 이번 달에 이미 열었으면 TossRewardAd를 렌더링하지 않습니다.
- **DoD**
  - F4-AC1
    - 잠금 화면에 Badge "탈락 위험", ListRow 3개 문구, 버튼이 있고 `premium-card`는 null입니다.
    - `fireRewarded()` 후 `getReportUnlock()`은 `{version:1, unlockedMonth:'2026-09'}`이고, gate는 null, `criteria-card`와 `premium-card`가 존재합니다.
    - 버튼을 2회 연속 탭해도 광고 show spy는 1회이고, 로딩 중 버튼은 `disabled`입니다.
  - F4-AC2
    - `unlockedMonth:'2026-09'`이면 TossRewardAd mock 렌더링이 0회이고 본문이 표시됩니다.
    - `'2026-08'`이면 gate가 표시됩니다.
  - F4-AC6
    - `fireLoadError()` 후 Toast 문구가 뜨고 본문이 렌더링되며 `getReportUnlock() === null`, console.error는 0회입니다.
    - 다시 마운트하면 gate가 표시됩니다.
  - F4-AC7: `fireClose()` 후 Toast "광고를 끝까지 보면 리포트가 열려요"가 뜨고, gate는 존재하며 `getReportUnlock() === null`입니다.
  - 소스의 `slotId=` 값이 `{import.meta.env.VITE_TOSS_AD_SLOT_ID}` 외에 0건입니다.
- **Covers**: F4-AC1, F4-AC2, F4-AC6, F4-AC7
- **Files**: `src/pages/ReportPage.tsx`, `src/pages/report/ReportGate.tsx`, `src/pages/__tests__/ReportPage.gate.test.tsx`
- **Depends on**: Task 3.9

### Task 3.11 SimulatePage — 입력, Chip, 비교 카드 (`/simulate`)
- **Description**: 시뮬레이션 화면의 입력과 비교 카드입니다.
  - 연도: `parseYear(state, now)`
  - 기준값: `baseMonthlyFromSummary(summary)`
  - 초기 입력
    - 기록이 있으면 base 값을 콤마 포맷으로 채웁니다.
    - 기록이 없으면 빈 값으로 두고 Paragraph.Text "입력된 소득이 없어 직접 입력한 금액으로 계산해요"를 표시합니다.
  - 입력 요소
    - `AmountTextField` `sim-salary`, `sim-side`
    - Chip "+50만원", "+100만원", "+200만원": `sim-side` 현재값에 더합니다.
    - Switch 행 `sim-biz-switch` "사업자등록 있음": 초기값은 `profile?.hasBusinessRegistration ?? false`이고, **저장하지 않습니다**.
  - 계산
    - 입력이 바뀔 때마다 `simulateScenario`로 즉시 다시 계산합니다.
    - 검증 실패(10억 초과)면 필드 에러를 띄우고 `lastValid` state를 유지합니다.
  - `compare-card` 2개(grid 2열, flex/grid CSS만 사용)
    - 제목 "현재" 또는 "시뮬레이션", StatusBadge, t3 "연 {x}원"
    - 보조 문구: DROP이 아니면 "보험료 0원 (피부양자 유지)", DROP이면 "월 예상 보험료 {x}원"
- **DoD**
  - F6-AC1: `sim-salary` "1,000,000", `sim-side` "200,000", switch는 `aria-checked="false"`입니다. card[0]에 "현재", "안전", "연 14,400,000원", "보험료 0원 (피부양자 유지)"가 있습니다.
  - F6-AC2: side "500000"을 입력하면 card[1]에 "시뮬레이션", "탈락 위험", "연 18,000,000원", "월 예상 보험료 122,020원"이 있습니다.
  - F6-AC3: "+50만원"을 누르면 "700,000", 이어서 "+200만원"을 누르면 "2,700,000"이고 card[1]은 "탈락 위험"입니다.
  - F6-AC5: AC-2 상태에서 "1000000001"을 입력하면 에러 문구가 뜨고 card[1]은 "연 18,000,000원"을 유지합니다.
  - F6-AC7: 기록이 0건이고 state가 null이면 안내 문구가 뜨고, input 값은 `''`, placeholder는 "0"입니다. card[0]은 "안전", "연 0원"이고, salary "1000000"을 입력하면 card[1]은 "안전", "연 12,000,000원"입니다.
  - **RS-SIMULATE**: state가 null, `{year:'x'}`, undefined이면 모두 크래시 없이 2026 기준으로 렌더링됩니다.
- **Covers**: F6-AC1, F6-AC2, F6-AC3, F6-AC5, F6-AC7
- **Files**: `src/pages/SimulatePage.tsx`, `src/pages/simulate/CompareCard.tsx`, `src/pages/simulate/simulate.css`, `src/pages/__tests__/SimulatePage.inputs.test.tsx`
- **Depends on**: Task 2.6, Task 2.7, Task 3.0, Task 2.9

### Task 3.12 SimulatePage — 최대 안전 금액, 순증가, 배너 광고
- **Description**: 결과 해석 문구와 광고를 추가합니다.
  - `max-safe-side`(Paragraph.Text)
    - 스위치 on: "사업자등록 시 부업 소득이 있으면 자격이 유지되지 않아요"
    - `(salary + other) × 12 > totalIncomeLimit`: "본업·기타 소득만으로 기준을 넘어요"
    - 그 밖: "부업은 월 {maxSafeSideMonthly}원까지 피부양자 유지가 가능해요"
  - `net-gain-value`(`computeNetGain` 결과)
    - NO_INCREASE: "부업 소득을 늘려 비교해보세요"
    - GAIN: "부업으로 연 {Δ}원 더 벌면 보험료 연 {p}원을 내고 실제로 {net}원이 늘어요"
    - LOSS: "부업으로 연 {Δ}원 더 벌어도 보험료 연 {p}원 때문에 오히려 연 {|net|}원 손해예요"
  - 배치: 비교 카드 뒤에 `simulate-ad-slot` 래퍼 + AdSlot(env가 있을 때), 그 아래 하단 `Spacing`
- **DoD**
  - F6-AC4
    - AC-1 상태에서 "부업은 월 416,666원까지 피부양자 유지가 가능해요"입니다.
    - switch를 on으로 바꾸면 사업자 문구가 표시되고 card[1]은 "탈락 위험"이며, `getProfile().hasBusinessRegistration === false`로 그대로입니다.
    - salary "1,700,000", side "0", switch off이면 "본업·기타 소득만으로 기준을 넘어요"입니다.
  - F6-AC2(문구): `net-gain-value`는 "부업으로 연 3,600,000원 더 벌면 보험료 연 1,464,240원을 내고 실제로 2,135,760원이 늘어요"입니다.
  - F6-AC6
    - card[1]은 "탈락 위험", "연 20,400,000원", "월 예상 보험료 138,290원"입니다.
    - LOSS 문구 "…오히려 연 459,480원 손해예요"가 정확히 일치합니다.
    - `max-safe-side`는 "…월 366,666원까지…"입니다.
    - side를 "300000"으로 되돌리면 "부업 소득을 늘려 비교해보세요"입니다.
  - F6-AC8
    - `compare-card`가 정확히 2개이고, 부모 요소 CSS가 `display:grid; grid-template-columns: 1fr 1fr`입니다.
    - DOM 순서는 입력(`sim-side`) → card[0] → card[1] → `max-safe-side` → `net-gain-value` → `simulate-ad-slot`입니다.
    - `sim-salary`와 `sim-side` 사이에 AdSlot이 없습니다.
- **Covers**: F6-AC4, F6-AC6, F6-AC8, F6-AC2
- **Files**: `src/pages/SimulatePage.tsx`, `src/pages/__tests__/SimulatePage.results.test.tsx`
- **Depends on**: Task 3.11, Task 2.5

### Task 3.13 SettingsPage — 사업자 행, 리마인더 스위치, 면책 문구 (`/settings`)
- **Description**: 설정 화면의 기본 행입니다.
  - ScreenScaffold(Top "설정"). `location.state`는 읽지 않습니다.
  - `row-biz` "사업자등록 여부"
    - 오른쪽 텍스트: 있음, 없음, 미설정
    - 탭하면 `navigate('/profile', {state:{mode:'edit'} satisfies RouteState['/profile']})`
  - `reminder-switch` 행 "월간 입력 리마인더"
    - 탭하면 낙관적으로 먼저 토글하고 `saveSettings`를 호출합니다.
    - 실패하면 이전 값으로 되돌리고 Toast를 띄웁니다.
      - STORAGE_FULL: "저장 공간이 부족해 설정을 저장하지 못했어요"
      - 그 밖: "설정을 저장하지 못했어요. 다시 시도해주세요"
  - `DisclaimerText`
- **DoD**
  - F7-AC1: 기본값에서 스위치를 탭하면 `aria-checked="false"`이고 `getSettings().reminderEnabled === false`입니다.
  - F7-AC2(설정 쪽)
    - 프로필이 false이면 `row-biz`에 "없음"이 있고, 탭하면 `mockNavigate('/profile', {state:{mode:'edit'}})`가 호출됩니다.
    - 프로필이 true인 상태로 렌더링하면 "있음"입니다.
  - F7-AC6: STORAGE_FULL mock에서 스위치를 탭하면 결국 `aria-checked="true"`로 돌아가고 Toast 문구가 정확히 일치합니다.
  - F7-AC7: 프로필이 없으면 "미설정"이고, 탭하면 edit 모드로 navigate가 호출됩니다.
  - F7-AC8: `DISCLAIMER_TEXT`가 1회 있고 `a[href^="http"]`는 0개입니다.
  - **RS-SETTINGS**: `state={foo:1}` 같은 임의 state로 들어와도 크래시 없이 렌더링됩니다.
- **Covers**: F7-AC1, F7-AC2, F7-AC6, F7-AC7, F7-AC8
- **Files**: `src/pages/SettingsPage.tsx`, `src/pages/__tests__/SettingsPage.rows.test.tsx`
- **Depends on**: Task 2.8, Task 2.9, Task 3.0

### Task 3.14 SettingsPage — 계산 기준 BottomSheet와 전체 삭제
- **Description**: 설정 화면에 기준 보기와 데이터 삭제를 추가합니다.
  - `row-rules` "계산 기준 보기": 탭하면 BottomSheet에 `buildRuleDescriptions(RULES)`를 ListRow 6개로 표시합니다.
  - `row-reset` "모든 데이터 삭제": 탭하면 AlertDialog를 띄웁니다.
    - 제목 "모든 데이터를 삭제할까요?"
    - 본문 "입력한 소득 기록과 설정이 모두 지워지고 되돌릴 수 없어요"
    - 버튼 "취소"와 "삭제"
  - "삭제"를 누르면 `clearAll()`을 호출합니다.
    - 성공: `navigate('/profile', {replace:true, state:{mode:'onboarding'}})`
    - 실패: Toast "삭제하지 못했어요. 다시 시도해주세요"를 띄우고 화면에 머뭅니다.
- **DoD**
  - F7-AC4: 시트 안 ListRow가 6개이고 텍스트가 F7-AC4 목록과 순서까지 같습니다. `SettingsPage.tsx`에 "20,000,000"과 "7.19" 리터럴이 0건입니다.
  - F7-AC3
    - 다이얼로그 제목, 본문, 버튼 문구가 일치합니다.
    - "삭제"를 누르면 4개 키가 모두 `getItem === null`이고 `mockNavigate('/profile', {replace:true, state:{mode:'onboarding'}})`가 호출됩니다.
  - F7-AC5: `clearAllData` 실패 mock에서 Toast 문구가 뜨고, navigate는 0회이며, `getRecords().length`는 이전과 같습니다.
- **Covers**: F7-AC3, F7-AC4, F7-AC5
- **Files**: `src/pages/SettingsPage.tsx`, `src/pages/settings/RulesSheet.tsx`, `src/pages/__tests__/SettingsPage.actions.test.tsx`
- **Depends on**: Task 3.13, Task 2.1

---

## Epic 4. Integration + Polish

**Risk**
- **복잡도**: 중간
- **위험 요소**
  - 탭바 숨김 경로를 빠뜨리면 SubmitFooter와 탭바가 겹칩니다.
  - 여러 화면을 오가는 흐름(저장 → 복귀 Toast, 프로필 수정 → 홈 Badge)은 페이지 단위 테스트로는 잡히지 않습니다.
  - 템플릿 파일 자체가 정적 검사(`.at(`, `IAP.`)에 걸릴 수 있습니다.
  - catch-all 라우트와 onboarding redirect가 서로 반복 이동할 수 있습니다.
- **대응**
  - 라우팅(4.1)을 가장 먼저 연결합니다.
  - 흐름 테스트(4.3)는 실제 `App` 라우트 트리로 돌립니다.
  - 정적 검사(4.2)는 템플릿 래퍼 정의 파일만 명시적으로 빼고, 그 밖의 위반은 출력에 파일:줄로 보여줍니다.
  - 마지막 점검(4.4)에서 광고, 여백, 터치 영역을 한 번에 확인합니다.

### Task 4.1 라우팅 연결 + 탭바 레이아웃 + catch-all
- **Description**: 앱 전체 라우트를 연결합니다.
  - `App.tsx`: `AppDataProvider`로 감싸고 BrowserRouter 아래에 SPEC §7의 8개 라우트를 둡니다(`*`는 `<Navigate to="/" replace />`).
  - `AppLayout`
    - `useLocation().pathname`이 `/profile`, `/record`, `/report`가 **아닐 때만** `FloatingTabBar`를 렌더링합니다.
    - 탭은 홈 `/`, 기록 `/history`, 시뮬레이션 `/simulate`, 설정 `/settings` 4개이고, 템플릿 FloatingTabBar props 형식을 따릅니다.
  - 템플릿의 기존 예시 라우트는 제거합니다.
- **DoD** (`src/__tests__/routing.test.tsx`, MemoryRouter + App 라우트 트리)
  - F8-AC3: 프로필이 있으면 `/does-not-exist`로 들어가도 `status-hero` 또는 "아직 입력된 소득이 없어요"가 표시되고, "404"나 "Not Found" 텍스트는 0건입니다.
  - 프로필이 없으면 `/unknown` → `/` → `/profile`로 이동해 "시작하기 전에"가 렌더링됩니다(무한 이동 없음, 렌더 5회 이내).
  - F2-AC1(전체 흐름): 프로필이 없으면 `/` → 온보딩 → "없어요" → "시작하기" → 홈 빈 상태가 렌더링됩니다.
  - 탭바 표시
    - `/`, `/history`, `/simulate`, `/settings`에서는 FloatingTabBar가 존재하고 탭 라벨 4개가 있습니다.
    - `/profile`, `/record`, `/report`에서는 FloatingTabBar가 없습니다.
  - `npm run build`가 성공합니다.
- **Covers**: F8-AC3, F2-AC1
- **Files**: `src/App.tsx`, `src/components/AppLayout.tsx`, `src/__tests__/routing.test.tsx`
- **Depends on**: Task 3.1~3.14 전체

### Task 4.2 정적 검수 스크립트 (`check-compliance`)
- **Description**: `scripts/check-compliance.mjs`를 Node 표준 모듈(fs, path)만으로 작성합니다.
  - 공통
    - `src/**`를 재귀 탐색하고, `__tests__`, `*.test.*`, `src/test/`는 제외합니다.
    - 위반이 있으면 `파일:줄: 규칙명`을 출력하고 `process.exit(1)`합니다.
    - `package.json`에 `"check:compliance": "node scripts/check-compliance.mjs"`를 추가합니다.
  - 규칙
    - **AC-1 외부 이탈**: `window\.open\(`, `window\.location\.href\s*=`, `location\.assign\(`, `location\.replace\(`, `href=["']https?://`
    - **AC-4 HEX 색상**: `.css`는 선언 값의 `#[0-9a-fA-F]{3,8}\b`, `.ts(x)`는 `color|background|border|fill|stroke` 키 뒤의 HEX
    - **AC-5 외부 로깅, 금지 UI 라이브러리**
      - package.json의 dependencies와 devDependencies에서 `react-ga`, `react-ga4`, `@amplitude/`, `mixpanel-browser`, `firebase`, `@sentry/`, `@mui/`, `antd`, `@chakra-ui/`
      - src에서 `gtag(`, `amplitude.`, `mixpanel.`
    - **AC-6 설치 유도 문구**: `src/**/*.{ts,tsx}`와 `index.html`에서 "앱을 설치", "설치하세요", "다운로드", "앱스토어", "플레이스토어"
    - **AC-7 호환성**: `.at(`, `structuredClone(`, `.replaceAll(`, `Object.hasOwn(`, `.findLast(`, `.toSorted(`, `Array.fromAsync(`
    - **AC-8 수익화 API 오용**
      - `grantPromotionReward`, `TossPurchase`, `IAP.`: 템플릿 래퍼 **정의 파일**은 `EXCLUDE_TEMPLATE_WRAPPERS` 배열로 명시해 제외합니다.
      - `adGroupId=`와 `slotId=` 뒤가 각각 `{import.meta.env.VITE_TOSS_AD_GROUP_ID}`, `{import.meta.env.VITE_TOSS_AD_SLOT_ID}`가 아니면 위반입니다.
  - 템플릿 파일에서 위반이 나오면 래퍼의 인터페이스는 바꾸지 말고 해당 줄만 호환 코드로 고칩니다.
- **DoD**
  - 현재 코드베이스에서 `npm run check:compliance`의 exit code가 0입니다.
  - 위반 fixture로 확인하는 `scripts/__tests__/check-compliance.test.mjs`(vitest)가 통과합니다. 임시 디렉터리에 아래 파일을 만들고 `SRC_DIR` 환경변수로 지정해 실행하면 각각 exit code 1입니다.
    - `window.open(` 한 줄
    - `color: '#fff'`
    - `"antd"` 의존성
    - "앱스토어" 문자열
    - `.at(`
    - `adGroupId="abc"`
  - `npm run build`가 성공합니다.
- **Covers**: F8-AC1, F8-AC4, F8-AC5, F8-AC6, F8-AC7, F8-AC8
- **Files**: `scripts/check-compliance.mjs`, `scripts/__tests__/check-compliance.test.mjs`, `package.json`
- **Depends on**: Task 4.1

### Task 4.3 라우트 순회 콘솔 에러 테스트 + 화면 간 흐름 테스트
- **Description**: 실제 App 라우트 트리로 전체 경로를 돌고, 화면을 오가는 흐름을 검증합니다.
  - `src/__tests__/compliance.test.tsx`
    - `console.error`를 spy하고 AdSlot과 TossRewardAd를 mock합니다.
    - 두 조건 (a) 빈 localStorage, (b) F1-AC3 1행 데이터 + 미등록 프로필 각각에서 `/`, `/profile`, `/record`, `/history`, `/report`, `/simulate`, `/settings`, `/unknown`을 **state 없이** 렌더링합니다.
  - `src/__tests__/flows.test.tsx`: 화면 간 흐름 3가지를 확인합니다.
- **DoD**
  - F8-AC2: 두 조건 × 8개 경로 = 16회 렌더링 모두에서 `console.error` 호출이 0회이고, 에러 없이 끝납니다.
  - F5-AC3(전체 흐름)
    - `/history` "3월" 탭 → `/record`에서 side "500000" → 저장
    - `/history`로 돌아와 Toast "3월 소득을 저장했어요"가 뜨고 "3월" 행은 "1,500,000원"입니다.
  - F7-AC1(홈 반영): `/settings`에서 리마인더를 끈 뒤 홈 탭으로 이동하면 `reminder-banner`가 null입니다(`2026-08` 기록 없음 조건).
  - F7-AC2(홈 반영)
    - `/settings` → `row-biz` → `biz-option-yes` → 저장하면 `/settings`의 `row-biz`가 "있음"입니다.
    - 홈 탭으로 이동하면 Badge "탈락 위험", 사유 "사업자등록 상태에서 부업 소득이 있어요"입니다.
  - F2-AC2(전체 흐름): `/` → "이번 달 소득 입력" → 저장하면 홈에 "9월 소득을 저장했어요"가 뜹니다.
- **Covers**: F8-AC2, F5-AC3, F7-AC1, F7-AC2, F2-AC2
- **Files**: `src/__tests__/compliance.test.tsx`, `src/__tests__/flows.test.tsx`
- **Depends on**: Task 4.1

### Task 4.4 광고 배치, 하단 여백, 터치 영역 최종 점검
- **Description**: 탭바가 있는 4개 화면을 마지막으로 점검합니다.
  - **광고 배치**: 광고가 결과 뒤에만 있는지 확인합니다.
    - Home: 버튼 뒤, 면책 문구 앞
    - History: 목록 뒤
    - Simulate: 결과 뒤
  - **하단 여백**: 마지막 콘텐츠 아래에 탭바를 피하는 `Spacing`이 있는지 확인합니다.
  - **터치 영역**: 누를 수 있는 요소가 TDS 기본 size(44px 이상)인지 확인합니다.
    - 대상: Button, Chip, 삭제 버튼, 배너 닫기
    - TDS Button/Chip의 `size` prop에서 44px 미만 규격을 쓰지 않습니다.
  - **여백 오버라이드 제거**: 모든 `src/pages/**`에서 TDS 컴포넌트에 `style`/`className`으로 padding·margin을 넣은 곳을 없앱니다.
  - 점검 결과를 테스트로 고정합니다.
- **DoD** (`src/__tests__/layout.test.tsx`)
  - F3-AC8: env가 있을 때 `home-ad-slot`이 두 번째 Button 뒤에 있고, 그 뒤에 Spacing 요소가 있습니다.
  - F3-AC4: 두 홈 Button의 `size`가 TDS 규격 중 44px 이상입니다(size prop snapshot 또는 mock 인자 확인).
  - F5-AC7: `/history` 2025년 탭에서 마지막 `month-row` 다음 형제 계열에 Spacing이 있고, 가상 스크롤 라이브러리 import가 0건입니다.
  - F6-AC8: Chip 3개의 size가 44px 이상 규격이고, `simulate-ad-slot`이 `net-gain-value` 뒤에 있습니다.
  - `grep -rnE "style=\{\{[^}]*(padding|margin)" src/pages src/components/StatusBadge.tsx src/components/AmountTextField.tsx`의 결과가 0건입니다.
  - `npm run check:compliance`와 `npm run build`가 모두 성공합니다.
- **Covers**: F3-AC4, F3-AC8, F5-AC7, F6-AC8
- **Files**: `src/pages/HomePage.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/SimulatePage.tsx`, `src/__tests__/layout.test.tsx`
- **Depends on**: Task 4.2, Task 4.3

---

## 추가 수용 기준 — Route State 방어

SPEC AC 외에 규칙에 따라 추가한 기준이며, 모두 커버됩니다.

| ID | 화면 | 기준 | 담당 |
|---|---|---|---|
| RS-HOME | `/` | state 없이, 또는 잘못된 savedMonth로 들어와도 크래시와 Toast 없이 렌더링 | 3.5, 4.3 |
| RS-PROFILE | `/profile` | state 없이 들어오면 프로필 유무에 따라 onboarding/edit로 렌더링 | 3.1, 4.3 |
| RS-RECORD | `/record` | state 없이 들어오면 이번 달 입력 화면, 저장 후 `/`로 이동 | 3.2, 4.3 |
| RS-HISTORY | `/history` | state 없이 들어오면 Toast 없이 목록 렌더링 | 3.7, 4.3 |
| RS-REPORT | `/report` | state 없이 들어오면 올해 기준으로 렌더링 | 3.9, 4.3 |
| RS-SIMULATE | `/simulate` | state가 없거나 잘못돼도 올해 기준으로 렌더링 | 3.11, 4.3 |
| RS-SETTINGS | `/settings` | 임의 state를 무시하고 렌더링 | 3.13 |

---

## AC Coverage
- **SPEC의 전체 AC**: 64개 (F1~F8 × 8)
- **태스크가 커버하는 AC**: 64개
  - **F1** (8/8)
    - AC1: 2.3
    - AC2: 2.3
    - AC3: 2.4
    - AC4: 2.4
    - AC5: 2.5
    - AC6: 2.2, 2.3, 2.4, 2.8
    - AC7: 2.2, 2.3
    - AC8: 2.2, 2.3
  - **F2** (8/8)
    - AC1: 3.1, 3.5, 4.1
    - AC2: 3.2, 3.6, 4.3
    - AC3: 3.2
    - AC4: 2.7, 3.2
    - AC5: 2.7, 3.2
    - AC6: 2.7, 3.2
    - AC7: 2.1, 3.0, 3.2
    - AC8: 3.3
  - **F3** (8/8)
    - AC1: 3.5
    - AC2: 3.5
    - AC3: 3.5
    - AC4: 3.5, 4.4
    - AC5: 3.5
    - AC6: 3.6
    - AC7: 2.8, 3.5
    - AC8: 3.6, 4.4
  - **F4** (8/8)
    - AC1: 3.10
    - AC2: 3.10
    - AC3: 3.9
    - AC4: 3.9
    - AC5: 3.9
    - AC6: 3.10
    - AC7: 3.10
    - AC8: 2.7, 3.9
  - **F5** (8/8)
    - AC1: 3.7
    - AC2: 3.7
    - AC3: 3.7, 4.3
    - AC4: 3.8
    - AC5: 2.6, 3.4
    - AC6: 2.1, 3.6
    - AC7: 3.7, 4.4
    - AC8: 3.8
  - **F6** (8/8)
    - AC1: 3.11
    - AC2: 2.6, 3.11, 3.12
    - AC3: 3.11
    - AC4: 2.5, 3.12
    - AC5: 3.11
    - AC6: 2.5, 2.6, 3.12
    - AC7: 3.11
    - AC8: 3.12, 4.4
  - **F7** (8/8)
    - AC1: 3.13, 4.3
    - AC2: 3.1, 3.13, 4.3
    - AC3: 2.2, 3.14
    - AC4: 2.1, 3.14
    - AC5: 3.14
    - AC6: 3.13
    - AC7: 3.1, 3.13
    - AC8: 2.1, 3.0, 3.1, 3.9, 3.13
  - **F8** (8/8)
    - AC1: 4.2
    - AC2: 4.3
    - AC3: 4.1
    - AC4: 4.2
    - AC5: 4.2
    - AC6: 4.2
    - AC7: 4.2
    - AC8: 4.2
- **커버되지 않은 AC**: 0개
- **추가 Route State 기준**: RS-* 7개 모두 커버
- **전체 태스크 수**: 29개 (Epic 1: 1, Epic 2: 9, Epic 3: 15, Epic 4: 4)