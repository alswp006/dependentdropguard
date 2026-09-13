# SPEC — DependentDropGuard (피부양자 지킴이)

## Common Principles

### 1. 제품 범위
- **한 줄 요약**: 본업과 부업 소득을 매달 입력하면 건강보험 피부양자 자격을 유지할 수 있는지 진단합니다. 탈락하면 내게 될 건강보험료도 추정해서 보여줍니다.
- **MVP 범위**: F1~F8에 적힌 기능만 만듭니다. 푸시 알림, 서버, 네이티브 모듈은 쓰지 않습니다.
  - PRD의 "매달 알림"은 **앱 안의 알림**으로 대신합니다. 홈 리마인더 배너와 상태 변화 다이얼로그가 이 역할을 합니다.
- **AI 사용 안 함**: 모든 진단과 계산은 `src/domain/rules.ts`의 고정 규칙으로 합니다. 생성형 AI 고지 의무가 없으므로 AI 고지 다이얼로그와 라벨은 만들지 않습니다.
- **수익화**: 광고만 씁니다.
  - 배너: `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />`
  - 보상형 광고: `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`
  - IAP(`TossPurchase`)와 `grantPromotionReward`는 **쓰지 않습니다**.
- **인증**: 토스 세션을 그대로 씁니다. 로그인 UI와 사용자 식별 기능은 없습니다. 데이터는 기기의 localStorage에만 저장합니다.

### 2. 기술 스택과 폴더 구조
- **스택**: Vite, React, TypeScript, `@toss/tds-mobile`, `react-router-dom`, localStorage(템플릿 헬퍼)
- **폴더 구조**:
  - `src/domain/rules.ts`: 판정 기준 상수
  - `src/domain/diagnosis.ts`: 순수 함수
  - `src/storage/*.ts`: 저장소
  - `src/utils/format.ts`: 표시 포맷
  - `src/pages/*.tsx`: 화면
- **템플릿이 제공하므로 다시 설계하지 않는 것**:
  - 광고/결제: AdSlot, TossRewardAd, TossPurchase
  - 레이아웃: ScreenScaffold, SubmitFooter, Card, SummaryHero(CountUp), Sparkline, MiniBar, FloatingTabBar
  - localStorage 헬퍼

### 3. UI 규칙 (TDS 검수 기준)
- **컴포넌트**: TDS 컴포넌트만 씁니다.
  - 기본: ListRow, Button, TextField, Paragraph.Text, Chip, Switch, AlertDialog, BottomSheet, Toast, Top, Tab
  - 보조: Badge, Spacing, Asset
- **여백**: TDS 컴포넌트에 인라인 style이나 className으로 padding/margin을 넣지 않습니다. 간격은 `<Spacing size={n} />`로만 조절합니다.
- **커스텀 CSS**: flex/grid 배치에만 씁니다. 색상은 `var(--tds-color-*)`만 쓰고 HEX는 금지합니다(다크모드 지원).
- **페이지 구조**: 모든 페이지는 `ScreenScaffold`로 감쌉니다. raw div로 골격을 만들지 않습니다.
- **주요 버튼**: 1차 액션은 `SubmitFooter`나 `Button display="block"`으로 만듭니다.
- **터치 영역**: 누를 수 있는 요소는 모두 44×44px 이상입니다.
- **하단 탭**: `FloatingTabBar`에 탭 4개를 둡니다.
  - 탭 구성: 홈 `/`, 기록 `/history`, 시뮬레이션 `/simulate`, 설정 `/settings`
  - 탭바를 숨기는 화면: `/profile`, `/record`, `/report`
- **금지 라이브러리**: shadcn/ui, MUI, Ant Design, Chakra UI

### 4. 날짜와 숫자 규칙
- **기준 시각**: 기기 로컬 시각(KST)의 `new Date()`를 씁니다. 테스트는 `vi.setSystemTime(new Date('2026-09-14T09:00:00+09:00'))`으로 고정합니다. 아래 AC의 "오늘"은 모두 **2026-09-14**입니다.
- **월 키**: `YYYY-MM` 형식이며 `^\d{4}-(0[1-9]|1[0-2])$`를 통과해야 합니다.
- **월 라벨** `formatMonthLabel(month)`: 올해면 `"8월"`, 다른 해면 `"2025년 12월"`로 표시합니다.
- **금액 표시** `formatWon(n)`: `n.toLocaleString('ko-KR') + '원'`. 예: `20400000` → `"20,400,000원"`
- **금액 계산**: 부동소수점 오차를 피하려고 **정수 연산**만 씁니다. 비율은 bp(1/10000) 단위 정수로 둡니다.

### 5. 판정 규칙 (`src/domain/rules.ts`)
아래 수치는 모두 가정값이며, 수치를 바꿔도 코드 한 곳만 고치면 되게 만듭니다. 검증이 필요한 항목은 Open Questions에 정리했습니다.

```ts
export interface RuleSet {
  year: number;                        // 2026
  totalIncomeLimit: number;            // 20_000_000 (연 합산 소득, "초과" 시 탈락)
  sideIncomeLimitUnregistered: number; // 5_000_000 (사업자 미등록 부업 소득, "초과" 시 탈락)
  sideIncomeLimitRegistered: number;   // 0 (사업자 등록 시 부업 소득 "초과" 시 탈락)
  warningRatioBp: number;              // 8000 (기준의 80% 이상이면 주의)
  healthRateBp: number;                // 719 (건강보험료율 7.19%)
  ltcRatioBp: number;                  // 1314 (장기요양보험료 = 건강보험료의 13.14%)
}
export const RULES: RuleSet = {
  year: 2026, totalIncomeLimit: 20_000_000, sideIncomeLimitUnregistered: 5_000_000,
  sideIncomeLimitRegistered: 0, warningRatioBp: 8000, healthRateBp: 719, ltcRatioBp: 1314,
};
```

**계산식**
- **연 환산**: 해당 연도에 입력한 달이 n개일 때 `projected = Math.floor(sum × 12 / n)`. 항목별(본업, 부업, 기타, 합계)로 따로 계산하고, 합계는 `Math.floor(총합 × 12 / n)`입니다.
- **상태 판정**:
  - `DROP`(탈락 위험) — 아래 중 하나라도 해당하면 DROP이고, 해당하는 사유를 모두 `reasons`에 넣습니다.
    - `total > totalIncomeLimit` → `TOTAL_INCOME`
    - 사업자 미등록이고 `side > 5,000,000` → `SIDE_INCOME_UNREGISTERED`
    - 사업자 등록이고 `side > 0` → `SIDE_INCOME_REGISTERED`
  - `WARNING`(주의) — DROP이 아니면서 아래 중 하나에 해당합니다.
    - `total ≥ 16,000,000`
    - 사업자 미등록이고 `side ≥ 4,000,000`
  - `SAFE`(안전) — 나머지 모든 경우
- **여유분** `marginToDrop`:
  - 사업자 미등록: `max(0, min(20,000,000 − total, 5,000,000 − side))`
  - 사업자 등록: `0`
- **초과분** `overAmount`: DROP일 때만 계산합니다(아니면 0). 초과한 기준들 중 가장 큰 초과액입니다.
  - 사업자 미등록: `max(total − 20,000,000, side − 5,000,000)`
  - 사업자 등록: `max(total − 20,000,000, side − 0)`
- **예상 보험료**: 소득분만 계산하고 재산·자동차분은 넣지 않습니다.
  - `monthlyBase = Math.floor(total / 12)`
  - `healthMonthly = Math.floor(monthlyBase × 719 / 10000 / 10) × 10`
  - `ltcMonthly = Math.floor(healthMonthly × 1314 / 10000 / 10) × 10`
  - `totalMonthly = healthMonthly + ltcMonthly`
  - `totalAnnual = totalMonthly × 12`
- **표시 문구**
  - 상태 라벨: SAFE `"안전"`, WARNING `"주의"`, DROP `"탈락 위험"`
  - 사유 문구:
    - `TOTAL_INCOME` → `"연간 합산 소득이 2,000만원을 넘어요"`
    - `SIDE_INCOME_UNREGISTERED` → `"부업 소득이 연 500만원을 넘어요 (사업자 미등록)"`
    - `SIDE_INCOME_REGISTERED` → `"사업자등록 상태에서 부업 소득이 있어요"`

### 6. 공통 면책 문구 (상수 `DISCLAIMER_TEXT`)
> "이 앱의 진단은 입력한 소득을 바탕으로 한 참고용 추정치이며, 실제 자격 판정과 보험료는 국민건강보험공단 기준에 따라 달라질 수 있어요."

### 7. 라우트 표

| Route | Page | 탭바 | 담당 기능 |
|---|---|---|---|
| `/` | HomePage | 표시 | F3, F5(배너) |
| `/profile` | ProfilePage | 숨김 | F2, F7 |
| `/record` | RecordPage | 숨김 | F2, F5(상태 변화 다이얼로그) |
| `/history` | HistoryPage | 표시 | F5 |
| `/report` | ReportPage | 숨김 | F4 |
| `/simulate` | SimulatePage | 표시 | F6 |
| `/settings` | SettingsPage | 표시 | F7 |
| `*` | `<Navigate to="/" replace />` | – | F8 |

### 8. API Contract
**외부 API 호출은 없습니다.** 데이터는 모두 localStorage에 저장하므로 CORS 설정이나 Railway 서버도 필요 없습니다.

---

## Data Models

### 공통 저장소 결과 타입
```ts
export type StorageError = 'STORAGE_FULL' | 'STORAGE_UNAVAILABLE' | 'INVALID_INPUT';
export type StorageResult<T> = { ok: true; data: T } | { ok: false; error: StorageError };
```
- `localStorage.setItem`에서 `QuotaExceededError`(`name === 'QuotaExceededError'` 또는 `code === 22`)가 나면 `STORAGE_FULL`을 반환합니다.
- 그 밖의 예외는 `STORAGE_UNAVAILABLE`을 반환합니다.
- 어떤 경우에도 예외를 밖으로 던지지 않고, `console.error`도 호출하지 않습니다.
- JSON 파싱에 실패하거나 스키마가 맞지 않으면 기본값을 반환합니다.

### UserProfile — 사용자 프로필
```ts
export interface UserProfile {
  version: 1;
  hasBusinessRegistration: boolean; // 부업 사업자등록 여부
  createdAt: string;                // ISO 8601
  updatedAt: string;                // ISO 8601
}
```
- **localStorage 키**: `ddg:profile:v1`
- **기본값**: `null`이며, 온보딩 전 상태를 뜻합니다.
- **크기**: 약 120B

### MonthlyIncomeRecord — 월별 소득 기록
```ts
export interface MonthlyIncomeRecord {
  month: string;         // 'YYYY-MM', 고유 키
  salaryIncome: number;  // 본업 소득(원), 정수 0 ≤ x ≤ 1_000_000_000
  sideIncome: number;    // 부업·프리랜서 소득(원), 정수 0 ≤ x ≤ 1_000_000_000
  otherIncome: number;   // 기타 소득(원), 정수 0 ≤ x ≤ 1_000_000_000
  memo: string;          // 0~30자
  updatedAt: string;     // ISO 8601
}
export interface RecordsStore { version: 1; items: MonthlyIncomeRecord[] } // month 오름차순 정렬
```
- **localStorage 키**: `ddg:records:v1`
- **기본값**: `{ version: 1, items: [] }`
- **제약**:
  - 같은 `month`는 1개만 저장합니다(upsert).
  - 입력할 수 있는 달은 **전년도 1월부터 이번 달까지**입니다. 2026-09 기준으로 `2025-01`~`2026-09`, 총 21개월입니다.
- **크기**: 1건에 약 200B입니다. 10년치 120건이면 약 24KB로, 5MB의 1% 미만입니다.

### AppSettings — 앱 설정
```ts
export interface AppSettings {
  version: 1;
  reminderEnabled: boolean;               // 기본 true
  dismissedReminderMonth: string | null;  // 배너를 닫은 대상 월 'YYYY-MM'
}
```
- **localStorage 키**: `ddg:settings:v1`
- **기본값**: `{ version: 1, reminderEnabled: true, dismissedReminderMonth: null }`
- **크기**: 약 90B

### ReportUnlock — 리포트 열람 상태
```ts
export interface ReportUnlock { version: 1; unlockedMonth: string } // 광고 시청 완료한 달 'YYYY-MM'
```
- **localStorage 키**: `ddg:reportUnlock:v1`
- **기본값**: `null`
- **크기**: 약 50B

### 계산 결과 타입 (저장하지 않음, 메모리에서만 사용)
```ts
export type DiagnosisStatus = 'SAFE' | 'WARNING' | 'DROP';
export type DropReason = 'TOTAL_INCOME' | 'SIDE_INCOME_UNREGISTERED' | 'SIDE_INCOME_REGISTERED';

export interface AnnualSummary {
  year: number;
  recordedMonths: number;     // 1~12
  actualTotal: number;        // 입력된 달 실제 합계
  salaryAnnual: number;       // 연 환산
  sideAnnual: number;
  otherAnnual: number;
  totalAnnual: number;
}
export interface DiagnosisResult {
  year: number;
  status: DiagnosisStatus;
  reasons: DropReason[];
  summary: AnnualSummary;
  marginToDrop: number;
  overAmount: number;
  totalRatioPercent: number;  // Math.floor(totalAnnual * 100 / totalIncomeLimit)
}
export interface PremiumEstimate {
  monthlyBase: number; healthMonthly: number; ltcMonthly: number; totalMonthly: number; totalAnnual: number;
}
```

### 전체 저장 용량
4개 키를 합쳐 최악의 경우에도 약 25KB이며, 5MB 한도에 한참 못 미칩니다.

---

## Screen Definitions

### S1. 홈 진단 — `/` (F3, F5)
- **TDS/템플릿 컴포넌트**
  - ScreenScaffold(Top 제목 "피부양자 지킴이")
  - SummaryHero(CountUp), TDS Badge
  - MiniBar(`data-testid="threshold-minibar"`)
  - Card(`data-testid="margin-card"`)
  - TDS Paragraph.Text(사유, 면책 문구)
  - TDS Button `display="block"`: "상세 리포트 보기", "이번 달 소득 입력"
  - 리마인더 배너 Card(`data-testid="reminder-banner"`)와 TDS Button "입력하기"·"닫기"
  - AdSlot(`data-testid="home-ad-slot"` 래퍼), TDS Toast, Asset.ContentIcon, FloatingTabBar
- **상태**
  - 로딩: 없음. localStorage를 `useState` 초기화 시점에 동기로 읽습니다.
  - 빈 상태: 올해 기록이 0건이면 Asset.ContentIcon, "아직 입력된 소득이 없어요", "소득 입력하기" 버튼을 보여줍니다.
  - 오류: 저장 데이터가 손상되면 빈 상태와 같이 처리합니다.
- **터치**: 모든 Button과 배너 닫기 버튼은 높이 44px 이상입니다.
- **레이아웃 계약** (위에서 아래 순서)
  - `reminder-banner`(조건부)
  - `status-hero`(SummaryHero: value=연 환산 합계, Badge=상태)
  - `threshold-minibar`
  - `margin-card`
  - Button 2개
  - `home-ad-slot`
  - 면책 문구
- **Navigation 계약**
  - Incoming: `location.state = { savedMonth: string } | null`
  - Outgoing:
    - 프로필이 없으면 `navigate('/profile', { replace: true, state: { mode: 'onboarding' } })`
    - "상세 리포트 보기" → `navigate('/report', { state: { year: number } })`
    - "이번 달 소득 입력"/"소득 입력하기" → `navigate('/record', { state: { month: string, from: 'home' } })`
    - 배너 "입력하기" → `navigate('/record', { state: { month: string, from: 'home' } })`

### S2. 프로필(온보딩/수정) — `/profile` (F2, F7)
- **TDS/템플릿 컴포넌트**
  - ScreenScaffold(Top)
  - TDS Paragraph.Text(질문 "부업 사업자등록이 있나요?", 면책 문구)
  - 선택형 TDS ListRow 2개: `data-testid="biz-option-yes"` "있어요", `data-testid="biz-option-no"` "없어요". 선택된 항목은 `aria-checked="true"`와 체크 Asset으로 표시합니다.
  - SubmitFooter(TDS Button "시작하기" 또는 "저장하기"), TDS Toast
- **상태**
  - 로딩: 없음
  - 빈 상태: 선택 전에는 SubmitFooter 버튼이 `disabled`입니다.
  - 오류: 저장에 실패하면 Toast를 띄웁니다.
- **터치**: ListRow 높이 56px 이상, SubmitFooter 버튼 높이 56px 이상
- **Navigation 계약**
  - Incoming: `location.state = { mode: 'onboarding' | 'edit' } | null`. null이면 프로필이 없을 때 onboarding, 있을 때 edit으로 봅니다.
  - Outgoing:
    - onboarding 저장 → `navigate('/', { replace: true })`
    - edit 저장 → `navigate('/settings', { replace: true })`

### S3. 월 소득 입력 — `/record` (F2, F5)
- **TDS/템플릿 컴포넌트**
  - ScreenScaffold(Top 제목 `"{월라벨} 소득 입력"`, 기존 기록이 있으면 `"{월라벨} 소득 수정"`)
  - 월 선택 TDS ListRow(`data-testid="month-picker"`)와 TDS BottomSheet(월 목록 ListRow 21개)
  - TDS TextField 4개:
    - `data-testid="input-salary"` "본업 소득"
    - `data-testid="input-side"` "부업·프리랜서 소득"
    - `data-testid="input-other"` "기타 소득 (이자·배당·연금 등)"
    - `data-testid="input-memo"` "메모 (선택)"
  - SubmitFooter(TDS Button "저장하기"), TDS AlertDialog(상태 변화 알림), TDS Toast
- **상태**
  - 로딩: 저장 중에는 버튼에 `loading`이 켜지고 `disabled`가 됩니다.
  - 빈 상태: 새 기록이면 필드가 비어 있고 placeholder로 "0"을 보여줍니다.
  - 오류: 필드별 TextField 에러 문구, 저장 실패 Toast
- **키보드**
  - 금액 필드: `inputMode="numeric"`, `enterKeyHint="next"`
  - 메모 필드: `enterKeyHint="done"`
  - 입력하는 동안 SubmitFooter는 DOM에 남아 있고 키보드 위에 표시됩니다(템플릿 SubmitFooter 동작).
- **터치**: TextField와 ListRow는 높이 48px 이상입니다.
- **Navigation 계약**
  - Incoming: `location.state = { month: string; from: 'home' | 'history' } | null`. null이면 `{ month: 이번 달, from: 'home' }`으로 봅니다.
  - Outgoing: 저장 성공 시 `navigate(from === 'history' ? '/history' : '/', { replace: true, state: { savedMonth: string } })`

### S4. 월별 추적 — `/history` (F5)
- **TDS/템플릿 컴포넌트**
  - ScreenScaffold(Top "월별 소득 추적")
  - TDS Tab: `"2026년"`, `"2025년"`
  - Card(`data-testid="ytd-card"`): 올해 누적 금액을 t3로 강조
  - Sparkline(`data-testid="income-sparkline"`)
  - TDS ListRow(`data-testid="month-row"`): 오른쪽에 TDS Button "삭제"(`data-testid="delete-button"`)
  - TDS AlertDialog, TDS Toast, Asset.ContentIcon, AdSlot(`data-testid="history-ad-slot"`), FloatingTabBar
- **상태**
  - 로딩: 없음
  - 빈 상태: 선택한 해의 기록이 0건이면 Asset.ContentIcon과 "이 해에 입력된 소득이 없어요"를 보여주고, 모든 행을 "미입력"으로 표시합니다.
  - 오류: 삭제에 실패하면 Toast를 띄웁니다.
- **스크롤**: 행은 최대 12개이므로 가상 스크롤 없이 페이지 전체를 스크롤합니다. 마지막 행 아래에 FloatingTabBar를 피하는 하단 Spacing을 둡니다.
- **터치**: ListRow 높이 56px 이상, "삭제" 버튼 44×44px 이상
- **Navigation 계약**
  - Incoming: `location.state = { savedMonth: string } | null`
  - Outgoing: 행 탭 → `navigate('/record', { state: { month: string, from: 'history' } })`

### S5. 상세 리포트 — `/report` (F4)
- **TDS/템플릿 컴포넌트**
  - ScreenScaffold(Top "상세 리포트")
  - 잠금 상태: Card(`data-testid="report-gate"`: 상태 Badge와 잠긴 항목 ListRow 3개)와 TossRewardAd로 감싼 TDS Button `display="block"` "광고 보고 상세 리포트 열기"
  - 열린 상태:
    - Card(`data-testid="criteria-card"`) 2개
    - Card(`data-testid="premium-card"`): 월 보험료 t2 강조와 ListRow 3개
    - Card(`data-testid="drop-month-card"`)
    - Card(`data-testid="income-breakdown"`): MiniBar 3개
    - TDS Button `display="block"` "시뮬레이션 해보기"
    - TDS Paragraph.Text 면책 문구와 "재산·자동차분은 제외하고 소득분만 반영한 추정치예요"
  - 공통: TDS Toast, Asset.ContentIcon
- **상태**
  - 로딩: 광고를 불러오는 동안 Button에 `loading`이 켜지고 `disabled`가 됩니다.
  - 빈 상태: 기록이 0건이면 Asset.ContentIcon, "소득을 입력하면 리포트를 볼 수 있어요", "소득 입력하기" 버튼을 보여줍니다.
  - 오류: 광고 로드 실패와 중도 종료는 Toast로 알립니다.
- **광고 배치**: 배너 AdSlot은 넣지 않습니다(보상형 광고와 겹치지 않게).
- **Navigation 계약**
  - Incoming: `location.state = { year: number } | null`. null이거나 `year`가 2025·2026이 아니면 2026으로 봅니다.
  - Outgoing:
    - "시뮬레이션 해보기" → `navigate('/simulate', { state: { year: number } })`
    - "소득 입력하기" → `navigate('/record', { state: { month: string, from: 'home' } })`

### S6. 지역가입자 전환 시뮬레이션 — `/simulate` (F6)
- **TDS/템플릿 컴포넌트**
  - ScreenScaffold(Top "전환 시뮬레이션")
  - TDS TextField 2개: `data-testid="sim-salary"`, `data-testid="sim-side"`
  - TDS Chip 3개: `"+50만원"`, `"+100만원"`, `"+200만원"`
  - TDS Switch(`data-testid="sim-biz-switch"`) "사업자등록 있음"
  - Card(`data-testid="compare-card"`) 2개: [0] 현재, [1] 시뮬레이션
  - Paragraph.Text(`data-testid="max-safe-side"`), Paragraph.Text(`data-testid="net-gain-value"`)
  - AdSlot(`data-testid="simulate-ad-slot"`), FloatingTabBar
- **상태**
  - 로딩: 없음
  - 빈 상태: 기록이 0건이면 안내 문구를 보여주고 현재값을 0으로 둡니다.
  - 오류: TextField 에러 문구를 띄우고, 결과 카드는 마지막 유효값을 유지합니다.
- **키보드**: `inputMode="numeric"`. 결과는 입력할 때마다 즉시 다시 계산하므로 제출 버튼이 없습니다.
- **터치**: Chip 높이 44px 이상, Switch 행 높이 56px 이상
- **레이아웃 계약** (위에서 아래 순서): 입력 영역, `compare-card` 2개(가로 2열 grid), `max-safe-side`, `net-gain-value`, `simulate-ad-slot`
- **Navigation 계약**
  - Incoming: `location.state = { year: number } | null`. 유효하지 않으면 2026으로 봅니다.
  - Outgoing: 없음(탭바만 사용)

### S7. 설정 — `/settings` (F7)
- **TDS/템플릿 컴포넌트**
  - ScreenScaffold(Top "설정")
  - TDS ListRow(`data-testid="row-biz"`): "사업자등록 여부", 오른쪽에 "있음"/"없음"/"미설정"
  - TDS ListRow와 TDS Switch(`data-testid="reminder-switch"`) "월간 입력 리마인더"
  - TDS ListRow(`data-testid="row-rules"`) "계산 기준 보기"와 TDS BottomSheet
  - TDS ListRow(`data-testid="row-reset"`) "모든 데이터 삭제"와 TDS AlertDialog
  - TDS Paragraph.Text 면책 문구, TDS Toast, FloatingTabBar
- **상태**
  - 로딩: 없음
  - 빈 상태: 프로필이 없으면 "미설정"으로 표시합니다.
  - 오류: 저장이나 삭제에 실패하면 Toast를 띄웁니다.
- **터치**: 모든 ListRow 높이 56px 이상
- **Navigation 계약**
  - Incoming: 없음(`location.state` 무시)
  - Outgoing:
    - "사업자등록 여부" → `navigate('/profile', { state: { mode: 'edit' } })`
    - 데이터 삭제 완료 → `navigate('/profile', { replace: true, state: { mode: 'onboarding' } })`

### Navigation 타입 정의 (`src/types/navigation.ts` — 보내는 쪽과 받는 쪽 모두 이 타입 사용)
```ts
export type HomeState = { savedMonth: string } | null;
export type ProfileState = { mode: 'onboarding' | 'edit' } | null;
export type RecordState = { month: string; from: 'home' | 'history' } | null;
export type HistoryState = { savedMonth: string } | null;
export type ReportState = { year: number } | null;
export type SimulateState = { year: number } | null;
```

---

## Feature List

### F1. 소득 데이터 저장소와 판정 규칙 엔진
- **설명**: 프로필, 월별 소득 기록, 설정, 리포트 열람 상태를 localStorage에 안전하게 읽고 씁니다. 입력된 월별 소득을 연 환산해 피부양자 상태(SAFE/WARNING/DROP), 여유분·초과분, 탈락 시 예상 건강보험료, 탈락 예상 월을 계산하는 순수 함수를 제공합니다. 모든 화면이 이 모듈만 사용합니다.
- **Data**: UserProfile, MonthlyIncomeRecord(RecordsStore), AppSettings, ReportUnlock, RuleSet, AnnualSummary, DiagnosisResult, PremiumEstimate
- **API**: 없음(외부 API 미사용). 내부 모듈 시그니처는 다음과 같습니다.
  ```ts
  // src/storage/
  getProfile(): UserProfile | null
  saveProfile(input: { hasBusinessRegistration: boolean }): StorageResult<UserProfile>
  getRecords(): MonthlyIncomeRecord[]
  getRecord(month: string): MonthlyIncomeRecord | null
  upsertRecord(input: Omit<MonthlyIncomeRecord, 'updatedAt'>): StorageResult<MonthlyIncomeRecord>
  deleteRecord(month: string): StorageResult<null>
  getSettings(): AppSettings
  saveSettings(patch: Partial<Omit<AppSettings, 'version'>>): StorageResult<AppSettings>
  getReportUnlock(): ReportUnlock | null
  saveReportUnlock(month: string): StorageResult<ReportUnlock>
  clearAllData(): StorageResult<null>   // ddg:* 4개 키 제거
  // src/domain/diagnosis.ts
  summarizeYear(records: MonthlyIncomeRecord[], year: number): AnnualSummary | null
  diagnose(summary: AnnualSummary, profile: Pick<UserProfile,'hasBusinessRegistration'>, rules?: RuleSet): DiagnosisResult
  estimatePremium(totalAnnual: number, rules?: RuleSet): PremiumEstimate
  findDropMonth(records: MonthlyIncomeRecord[], year: number, profile: Pick<UserProfile,'hasBusinessRegistration'>, rules?: RuleSet): string | null
  maxSafeSideMonthly(salaryAnnual: number, otherAnnual: number, hasBusinessRegistration: boolean, rules?: RuleSet): number
  ```
- **Requirements**

- AC-1 [E][P0]: Scenario: 새 월 기록 저장
  - Given `ddg:records:v1` 키가 없을 때
  - When `upsertRecord({ month: '2026-08', salaryIncome: 1000000, sideIncome: 200000, otherIncome: 0, memo: '스마트스토어' })`를 호출하면
  - Then `{ ok: true }`를 반환하고 `getRecords()`의 길이는 1, `[0].sideIncome === 200000`입니다.
  - And `JSON.parse(localStorage['ddg:records:v1']).version === 1`입니다.

- AC-2 [E][P0]: Scenario: 같은 달 덮어쓰기와 정렬
  - Given `2026-08`(side 200000)과 `2026-01` 기록이 저장돼 있을 때
  - When `upsertRecord({ month: '2026-08', salaryIncome: 1000000, sideIncome: 300000, otherIncome: 0, memo: '' })`를 호출하면
  - Then `getRecords()`의 길이는 2이고, month 순서는 `['2026-01', '2026-08']`이며, `getRecord('2026-08').sideIncome === 300000`입니다.

- AC-3 [U][P0]: Scenario: 연 환산과 상태 판정 표
  - Given 사업자 미등록 프로필과, 아래 각 행의 월 소득이 `2026-01`~`2026-03` 3개월 동일하게 저장돼 있을 때
  - When `diagnose(summarizeYear(records, 2026), profile)`를 호출하면
  - Then 결과는 아래 표와 같습니다.

    | salary/월 | side/월 | 사업자 | totalAnnual | sideAnnual | status | reasons | marginToDrop | overAmount | totalRatioPercent |
    |---|---|---|---|---|---|---|---|---|---|
    | 1,000,000 | 200,000 | 미등록 | 14,400,000 | 2,400,000 | SAFE | [] | 2,600,000 | 0 | 72 |
    | 1,200,000 | 250,000 | 미등록 | 17,400,000 | 3,000,000 | WARNING | [] | 2,000,000 | 0 | 87 |
    | 1,500,000 | 200,000 | 미등록 | 20,400,000 | 2,400,000 | DROP | ['TOTAL_INCOME'] | 0 | 400,000 | 102 |
    | 500,000 | 450,000 | 미등록 | 11,400,000 | 5,400,000 | DROP | ['SIDE_INCOME_UNREGISTERED'] | 0 | 400,000 | 57 |
    | 1,000,000 | 10,000 | 등록 | 12,120,000 | 120,000 | DROP | ['SIDE_INCOME_REGISTERED'] | 0 | 120,000 | 60 |

  - And `totalAnnual`이 정확히 20,000,000(월 합계 1,666,666.67원 대신 `summary`를 직접 구성해 테스트)이고 side가 2,000,000이면 status는 `WARNING`입니다. 기준은 "초과"이기 때문입니다.

- AC-4 [U][P0]: Scenario: 예상 보험료 정수 계산
  - Given RULES(healthRateBp 719, ltcRatioBp 1314)일 때
  - When `estimatePremium(20400000)`을 호출하면
  - Then `{ monthlyBase: 1700000, healthMonthly: 122230, ltcMonthly: 16060, totalMonthly: 138290, totalAnnual: 1659480 }`를 반환합니다.
  - And `estimatePremium(18000000)`은 `{ monthlyBase: 1500000, healthMonthly: 107850, ltcMonthly: 14170, totalMonthly: 122020, totalAnnual: 1464240 }`를 반환합니다.
  - And `estimatePremium(0)`은 모든 필드가 0입니다.

- AC-5 [U][P0]: Scenario: 탈락 예상 월과 부업 최대 안전 금액
  - Given 사업자 미등록이고 `2026-01`~`2026-03`에 salary 1,500,000, side 200,000이 저장돼 있을 때
  - When `findDropMonth(records, 2026, profile)`을 호출하면
  - Then `'2026-12'`를 반환합니다. 미입력 달은 월평균 1,700,000원으로 누적해 12월 누적 20,400,000원이 20,000,000원을 넘기 때문입니다.
  - And salary 1,000,000, side 200,000 데이터로 호출하면 `null`을 반환합니다.
  - And `maxSafeSideMonthly(12000000, 0, false) === 416666`, `maxSafeSideMonthly(20400000, 0, false) === 0`, `maxSafeSideMonthly(12000000, 0, true) === 0`입니다.

- AC-6 [S][P1]: Scenario: 데이터가 없는 첫 실행
  - Given localStorage가 비어 있을 때
  - When `getProfile()`, `getRecords()`, `getSettings()`, `getReportUnlock()`, `summarizeYear([], 2026)`을 호출하면
  - Then 반환값은 순서대로 `null`, `[]`, `{ version: 1, reminderEnabled: true, dismissedReminderMonth: null }`, `null`, `null`입니다.

- AC-7 [W][P1]: Scenario: 손상된 JSON 방어
  - Given `localStorage['ddg:records:v1'] = '{broken'`, `localStorage['ddg:settings:v1'] = '"abc"'`일 때
  - When `getRecords()`와 `getSettings()`를 호출하면
  - Then 예외 없이 `[]`와 기본 설정을 반환하고, `console.error` 스파이 호출 횟수는 0입니다.
  - And `upsertRecord({ month: '2026-13', ... })`나 `salaryIncome: -1`, `1000000001`, `1.5`, `memo` 31자 입력은 `{ ok: false, error: 'INVALID_INPUT' }`를 반환하고 저장하지 않습니다.

- AC-8 [W][P1]: Scenario: 저장 공간 부족
  - Given `2026-01` 기록 1건이 저장돼 있고 `localStorage.setItem`이 `DOMException('', 'QuotaExceededError')`를 던지도록 mock했을 때
  - When `upsertRecord({ month: '2026-02', salaryIncome: 1000000, sideIncome: 0, otherIncome: 0, memo: '' })`를 호출하면
  - Then `{ ok: false, error: 'STORAGE_FULL' }`을 반환합니다.
  - And mock을 해제한 뒤 `getRecords()`의 길이는 1로, 기존 데이터가 그대로 남아 있습니다.

---

### F2. 온보딩 프로필과 월 소득 입력 (본업·부업 합산)
- **설명**: 첫 실행 때 부업 사업자등록 여부를 한 번 받아 판정 기준을 정합니다. 이후 사용자는 월 단위로 본업, 부업·프리랜서, 기타 소득과 메모를 입력하거나 수정합니다. 입력값은 천 단위 콤마로 표시하고, 검증을 통과한 값만 F1 저장소에 저장합니다.
- **Data**: UserProfile, MonthlyIncomeRecord
- **API**: 없음
- **내부 함수**:
  ```ts
  validateRecordForm(form: { salary: string; side: string; other: string; memo: string })
    : { ok: true; value: { salaryIncome: number; sideIncome: number; otherIncome: number; memo: string } }
    | { ok: false; errors: Partial<Record<'salary' | 'side' | 'other' | 'form', string>> }
  ```
  콤마를 제거하고, 빈 문자열은 0으로 봅니다.
- **Screens**: S2 `/profile`, S3 `/record`
- **Requirements**

- AC-1 [E][P0]: Scenario: 첫 실행 온보딩
  - Given `ddg:profile:v1`이 없을 때
  - When `/`에 진입하면
  - Then `/profile`로 replace 이동하고, Top 제목 "시작하기 전에"와 SubmitFooter 버튼 "시작하기"(`disabled`)가 표시됩니다.
  - When `biz-option-no`를 탭하고 "시작하기"를 탭하면
  - Then `getProfile().hasBusinessRegistration === false`이고 `navigate('/', { replace: true })`가 호출됩니다.

- AC-2 [E][P0]: Scenario: 월 소득 저장 성공
  - Given 프로필이 있고 `/record`에 `state = { month: '2026-08', from: 'home' }`으로 진입했을 때
  - When `input-salary`에 "1000000", `input-side`에 "200000", `input-memo`에 "스마트스토어"를 입력하고(`input-other`는 비움) "저장하기"를 탭하면
  - Then `getRecord('2026-08')`은 `{ salaryIncome: 1000000, sideIncome: 200000, otherIncome: 0, memo: '스마트스토어' }`와 일치합니다.
  - And `navigate('/', { replace: true, state: { savedMonth: '2026-08' } })`가 호출되고, 홈에 Toast "8월 소득을 저장했어요"가 표시됩니다.

- AC-3 [E][P1]: Scenario: 기존 기록 불러와 수정
  - Given `2026-08`에 salary 1,000,000, side 200,000, other 0이 저장돼 있을 때
  - When `/record`에 `state = { month: '2026-08', from: 'history' }`로 진입하면
  - Then Top 제목은 "8월 소득 수정"이고, `input-salary` 값은 "1,000,000", `input-side` 값은 "200,000", `input-other` 값은 "0"입니다.
  - And 저장하면 `navigate('/history', { replace: true, state: { savedMonth: '2026-08' } })`가 호출됩니다.

- AC-4 [W][P1]: Scenario: 금액 상한 초과
  - Given `/record`(month `2026-09`)에 있을 때
  - When `input-side`에 "1000000001"을 입력하고 "저장하기"를 탭하면
  - Then `input-side` 아래에 에러 "월 소득은 10억원 이하로 입력해주세요"가 표시되고, `getRecord('2026-09') === null`입니다.

- AC-5 [W][P1]: Scenario: 금액 모두 비움
  - Given `/record`(month `2026-09`)에서 금액 필드 3개가 모두 빈 문자열일 때
  - When "저장하기"를 탭하면
  - Then 폼 에러 "금액을 1개 이상 입력해주세요 (소득이 없으면 0 입력)"이 표시되고 저장하지 않습니다.
  - And `input-salary`에 "0"만 입력하고 저장하면 `{ salaryIncome: 0, sideIncome: 0, otherIncome: 0 }`으로 저장됩니다.

- AC-6 [W][P1]: Scenario: 저장 실패와 잘못된 월 state
  - Given `upsertRecord`가 `{ ok: false, error: 'STORAGE_FULL' }`을 반환하도록 mock했을 때
  - When 유효한 값으로 "저장하기"를 탭하면
  - Then Toast "저장 공간이 부족해 저장하지 못했어요"가 표시되고 화면은 `/record`에 머뭅니다.
  - And `state = { month: '2026-10', from: 'home' }`(미래 달)이나 `{ month: '2026-13', from: 'home' }`으로 진입하면 선택 월은 `2026-09`로 바뀌고, 미래 달이면 Toast "미래 달은 입력할 수 없어요"가 표시됩니다.

- AC-7 [U][P1]: Scenario: 모바일 키보드와 입력 포맷
  - Given `/record` 화면일 때
  - Then 금액 TextField 3개는 `inputMode="numeric"`, `enterKeyHint="next"`이고, 메모 TextField는 `maxLength={30}`, `enterKeyHint="done"`입니다.
  - When `input-salary`에 "1000000"을 입력하면 표시값은 "1,000,000"입니다. "12a3"을 입력하면 숫자가 아닌 문자가 제거되어 "123"이 됩니다.
  - When `input-other`에서 Enter를 누르면 포커스가 `input-memo`로 이동하고, 이 동안 SubmitFooter "저장하기" 버튼은 DOM에 남아 있습니다.

- AC-8 [S][P1]: Scenario: 월 선택 BottomSheet와 저장 중 상태
  - Given 오늘이 2026-09-14이고 `2026-08` 기록만 있을 때
  - When `month-picker`를 탭하면
  - Then BottomSheet에 ListRow 21개가 `2026-09`부터 `2025-01`까지 내림차순으로 표시되고, "8월" 행에만 보조 문구 "입력됨"이 붙습니다.
  - When "8월"을 탭하면 BottomSheet가 닫히고 해당 기록 값이 채워집니다.
  - And 저장이 진행되는 동안 "저장하기" 버튼은 `loading`·`disabled`이며, 연속 2회 탭해도 `upsertRecord` 호출은 1회입니다.

---

### F3. 피부양자 자격 진단 홈 대시보드
- **설명**: 올해 입력한 소득을 연 환산해 피부양자 자격 상태(안전/주의/탈락 위험)를 홈에 바로 보여줍니다. 연 환산 합산 소득은 CountUp 히어로로, 기준 대비 비율은 MiniBar로 시각화하고, 기준까지 남은 여유분이나 초과분을 Card로 안내합니다. 상세 리포트와 이번 달 입력으로 가는 1차 액션을 제공합니다.
- **Data**: UserProfile, MonthlyIncomeRecord(읽기 전용), DiagnosisResult
- **API**: 없음
- **Screens**: S1 `/`
- **Requirements**

- AC-1 [U][P0]: Scenario: 안전 상태 진단 표시
  - Given 사업자 미등록이고 `2026-01`~`2026-03`에 salary 1,000,000, side 200,000이 저장돼 있을 때
  - When `/`를 렌더링하면
  - Then `status-hero`의 Badge 텍스트는 "안전", CountUp 최종 값은 "14,400,000원", 보조 문구는 "3개월 입력 기준 연 환산"입니다.
  - And `threshold-minibar`는 `aria-valuenow="72"`이고, `margin-card`에 "기준까지 연 2,600,000원 여유가 있어요"가 표시됩니다.

- AC-2 [U][P0]: Scenario: 탈락 위험 상태 표시
  - Given 사업자 미등록이고 `2026-01`~`2026-03`에 salary 1,500,000, side 200,000이 저장돼 있을 때
  - When `/`를 렌더링하면
  - Then Badge는 "탈락 위험", CountUp 최종 값은 "20,400,000원", `threshold-minibar`는 `aria-valuenow="100"`(최대 100으로 제한)입니다.
  - And `margin-card`에 "기준을 400,000원 초과했어요"와 사유 "연간 합산 소득이 2,000만원을 넘어요"가 표시됩니다.

- AC-3 [U][P1]: Scenario: 주의 상태와 사업자 등록 문구
  - Given 사업자 미등록이고 3개월 모두 salary 1,200,000, side 250,000일 때
  - Then Badge는 "주의", CountUp 값은 "17,400,000원", `margin-card`는 "기준까지 연 2,000,000원 여유가 있어요"입니다.
  - And 사업자 등록이고 side 0(salary 1,000,000)일 때 Badge는 "안전"이고, `margin-card`는 "사업자등록 상태에서는 부업 소득이 생기면 자격이 유지되지 않아요"입니다.

- AC-4 [U][P0]: Scenario: 홈 레이아웃 계약과 이동
  - Given AC-1 데이터일 때
  - Then DOM 순서는 `status-hero`(SummaryHero) → `threshold-minibar` → `margin-card`(Card 1개) → Button 2개 → `home-ad-slot` → 면책 문구이고, 전체가 ScreenScaffold 안에 있습니다.
  - And "상세 리포트 보기"와 "이번 달 소득 입력"은 `display="block"` TDS Button이며 높이는 44px 이상입니다.
  - When "상세 리포트 보기"를 탭하면 `navigate('/report', { state: { year: 2026 } })`가 호출됩니다.
  - When "이번 달 소득 입력"을 탭하면 `navigate('/record', { state: { month: '2026-09', from: 'home' } })`가 호출됩니다.

- AC-5 [S][P1]: Scenario: 올해 기록이 없을 때 빈 상태
  - Given 프로필은 있고 기록은 `2025-12` 1건뿐일 때
  - When `/`를 렌더링하면
  - Then `status-hero`, `threshold-minibar`, `margin-card`는 렌더링되지 않고, Asset.ContentIcon, "아직 입력된 소득이 없어요", Button "소득 입력하기"가 표시됩니다.
  - When "소득 입력하기"를 탭하면 `navigate('/record', { state: { month: '2026-09', from: 'home' } })`가 호출됩니다.

- AC-6 [E][P1]: Scenario: 저장 후 복귀 Toast 1회
  - Given `/`에 `state = { savedMonth: '2025-12' }`로 진입했을 때
  - Then Toast "2025년 12월 소득을 저장했어요"가 1회 표시됩니다.
  - And 곧바로 `navigate('/', { replace: true, state: null })`가 호출되어, 다시 렌더링해도 Toast가 또 뜨지 않습니다.

- AC-7 [W][P1]: Scenario: 손상된 데이터에서도 크래시 없음
  - Given `ddg:profile:v1`은 유효하고 `ddg:records:v1 = 'null'`일 때
  - When `/`를 렌더링하면
  - Then AC-5의 빈 상태가 표시되고, `console.error` 호출 횟수는 0이며, ErrorBoundary 화면은 나타나지 않습니다.

- AC-8 [W][P1]: Scenario: 광고 ID 미설정
  - Given `import.meta.env.VITE_TOSS_AD_GROUP_ID`가 빈 문자열일 때
  - When `/`를 렌더링하면
  - Then AdSlot은 렌더링되지 않고(`home-ad-slot` 없음), 나머지 AC-4 요소는 모두 표시되며, `console.error` 호출 횟수는 0입니다.
  - And ID가 있을 때 AdSlot은 `margin-card`와 Button 뒤에만 오고, 다른 콘텐츠나 FloatingTabBar와 겹치지 않도록 마지막 콘텐츠 아래에 하단 Spacing이 있습니다.

---

### F4. 보상형 광고 게이트 상세 리포트 (탈락 시 예상 건강보험료)
- **설명**: 기준별 판정 상세, 탈락 시(또는 현재) 예상 월·연 건강보험료, 탈락 예상 시점, 소득 구성 비중을 담은 상세 리포트를 제공합니다. 한 달에 한 번 TossRewardAd 보상형 광고를 끝까지 보면 리포트가 열리고, 그달 안에는 광고 없이 다시 볼 수 있습니다.
- **Data**: MonthlyIncomeRecord, UserProfile(읽기), ReportUnlock(읽기/쓰기), DiagnosisResult, PremiumEstimate
- **API**: 없음
- **Screens**: S5 `/report`
- **Requirements**

- AC-1 [E][P0]: Scenario: 광고 시청 후 리포트 열림
  - Given AC-2(F3) 데이터가 있고 `ddg:reportUnlock:v1`이 없을 때
  - When `/report`에 `state = { year: 2026 }`으로 진입하면
  - Then `report-gate` Card에 Badge "탈락 위험"과 잠긴 ListRow 3개("기준별 판정", "예상 건강보험료", "탈락 예상 시점"), 그리고 TossRewardAd로 감싼 Button "광고 보고 상세 리포트 열기"가 표시되고, `premium-card`는 DOM에 없습니다.
  - When Button을 탭하고 TossRewardAd의 보상 완료 콜백이 호출되면
  - Then `getReportUnlock()`은 `{ version: 1, unlockedMonth: '2026-09' }`이고, `report-gate`가 사라지며 `criteria-card`와 `premium-card`가 렌더링됩니다.
  - And 광고를 불러오는 동안 Button은 `loading`·`disabled`이며, 연속 탭해도 광고 표시 요청은 1회입니다.

- AC-2 [S][P0]: Scenario: 이번 달 열람 상태 유지
  - Given `ddg:reportUnlock:v1 = { version: 1, unlockedMonth: '2026-09' }`일 때
  - When `/report`에 진입하면
  - Then TossRewardAd를 렌더링하지 않고 리포트 본문이 바로 표시됩니다.
  - And `unlockedMonth`가 `'2026-08'`이면 AC-1의 잠금 화면이 다시 표시됩니다.

- AC-3 [U][P0]: Scenario: 탈락 위험 리포트 내용
  - Given AC-2(F3) 데이터(salary 1,500,000, side 200,000 × 3개월, 사업자 미등록)이고 리포트가 열린 상태일 때
  - Then `criteria-card[0]`에 "연간 합산 소득", "20,400,000원 / 기준 20,000,000원", Badge "초과"가 표시됩니다.
  - And `criteria-card[1]`에 "부업 소득 (사업자 미등록)", "2,400,000원 / 기준 5,000,000원", Badge "충족"이 표시됩니다.
  - And `premium-card` 제목은 "예상 월 보험료"이고, t2로 강조한 값은 "138,290원", ListRow 3개는 "건강보험료 122,230원", "장기요양보험료 16,060원", "연간 1,659,480원"입니다.
  - And `drop-month-card`에 "2026년 12월에 기준을 넘을 것으로 예상돼요"가 표시됩니다.

- AC-4 [U][P1]: Scenario: 리포트 레이아웃 계약과 안전 상태 문구
  - Given 리포트가 열린 상태일 때
  - Then 화면은 ScreenScaffold 안에 `criteria-card` Card 2개, `premium-card` Card 1개, `drop-month-card` Card 1개, `income-breakdown` 안의 MiniBar 3개, `display="block"` Button "시시뮬레이션 해보기"를 가집니다.
  - And AC-3 데이터에서 MiniBar 라벨은 "본업 88%", "부업 12%", "기타 0%"입니다(`Math.round(항목 연 환산 × 100 / totalAnnual)`).
  - And 사업자 미등록에 salary 1,000,000, side 200,000(SAFE)이면 `premium-card` 제목은 "탈락 시 예상 월 보험료(현재 소득 기준)", 값은 "84,780원"입니다(monthlyBase 1,200,000 → 건강 86,280? 아래 참고). `drop-month-card`는 "올해 안에는 기준을 넘지 않을 것으로 보여요"입니다.
    - 참고: 1,200,000 × 719 / 10000 = 86,280 → 건강 86,280원, 장기요양 Math.floor(86,280 × 1314 / 10000 / 10) × 10 = 11,330원, 합계 **97,610원**. 테스트 기대값은 **"97,610원"**입니다.
  - And 면책 문구와 "재산·자동차분은 제외하고 소득분만 반영한 추정치예요"가 표시됩니다.
  - When "시뮬레이션 해보기"를 탭하면 `navigate('/simulate', { state: { year: 2026 } })`가 호출됩니다.

- AC-5 [S][P1]: Scenario: 기록이 없을 때 빈 상태
  - Given 2026년 기록이 0건일 때
  - When `/report`에 `state = { year: 2026 }`으로 진입하면
  - Then Asset.ContentIcon, "소득을 입력하면 리포트를 볼 수 있어요", Button "소득 입력하기"가 표시되고 TossRewardAd와 `report-gate`는 렌더링되지 않습니다.

- AC-6 [W][P1]: Scenario: 광고 로드 실패
  - Given 잠금 상태에서 TossRewardAd의 로드 실패 콜백이 호출될 때(no-fill이나 네트워크 오류)
  - Then Toast "광고를 불러오지 못했어요. 리포트를 바로 보여드릴게요"가 표시되고 리포트 본문이 렌더링됩니다.
  - And `getReportUnlock()`은 `null`로 남아, 다음 진입 때 다시 잠금 화면이 보입니다.
  - And `console.error` 호출 횟수는 0입니다.

- AC-7 [W][P1]: Scenario: 광고 중도 종료
  - Given 잠금 상태에서 광고가 표시된 뒤 보상 완료 전에 닫기 콜백이 호출될 때
  - Then Toast "광고를 끝까지 보면 리포트가 열려요"가 표시되고, `report-gate`가 그대로 남으며 `getReportUnlock() === null`입니다.

- AC-8 [W][P1]: Scenario: 잘못된 year state
  - Given AC-3 데이터일 때
  - When `/report`에 `state = null`, `{ year: 1999 }`, `{ year: '2026' }` 중 하나로 진입하면
  - Then 모두 2026년 기준 리포트(Badge "탈락 위험")를 보여주고, 예외 없이 렌더링됩니다.

---

### F5. 월별 소득 변동 추적과 인앱 알림
- **설명**: 연도별로 월 소득 기록을 목록과 Sparkline 추이로 보여주고, 전월 대비 증감을 표시하며, 기록을 수정하거나 삭제할 수 있게 합니다. 푸시 알림 대신 두 가지 인앱 알림을 제공합니다. 하나는 지난달 소득이 아직 입력되지 않았을 때 홈에 뜨는 리마인더 배너이고, 다른 하나는 저장으로 자격 상태가 나빠졌을 때 뜨는 AlertDialog입니다.
- **Data**: MonthlyIncomeRecord, AppSettings, UserProfile(읽기), DiagnosisResult
- **API**: 없음
- **Screens**: S4 `/history`, S1 `/`(배너), S3 `/record`(상태 변화 다이얼로그)
- **Requirements**

- AC-1 [U][P0]: Scenario: 월별 목록과 누적 표시
  - Given `2026-01`(salary 1,000,000, side 0), `2026-02`(1,000,000/200,000), `2026-03`(1,000,000/400,000)이 저장돼 있을 때
  - When `/history`를 렌더링하면
  - Then Tab "2026년"이 선택돼 있고, `month-row`는 9개가 "9월"부터 "1월"까지 내림차순으로 표시됩니다.
  - And "3월" 행은 "1,400,000원"과 "+200,000원", "2월" 행은 "1,200,000원"과 "+200,000원", "1월" 행은 "1,000,000원"(증감 표시 없음)이고, "4월"~"9월" 행은 "미입력"입니다.
  - And `ytd-card`에 "올해 누적 3,600,000원"이 t3로 강조돼 표시됩니다.

- AC-2 [W][P1]: Scenario: 기록이 1개 이하일 때 Sparkline 대체
  - Given AC-1 데이터에서 Sparkline은 `income-sparkline`에 data `[1000000, 1200000, 1400000]`(월 오름차순)으로 렌더링됩니다.
  - When 2026년 기록이 `2026-01` 1건뿐이면
  - Then `income-sparkline`은 렌더링되지 않고, Paragraph.Text "2개월 이상 입력하면 추이를 볼 수 있어요"가 표시됩니다.

- AC-3 [E][P0]: Scenario: 행 탭으로 수정 후 복귀
  - Given AC-1 데이터일 때
  - When "3월" 행을 탭하면
  - Then `navigate('/record', { state: { month: '2026-03', from: 'history' } })`가 호출됩니다.
  - When `/record`에서 side를 "500000"으로 바꿔 저장하면 `/history`로 replace 이동하고, Toast "3월 소득을 저장했어요"가 표시되며 "3월" 행은 "1,500,000원"입니다.

- AC-4 [E][P1]: Scenario: 기록 삭제
  - Given AC-1 데이터일 때
  - When "3월" 행의 `delete-button`을 탭하면
  - Then AlertDialog 제목 "3월 소득 기록을 삭제할까요?"와 버튼 "취소"/"삭제"가 표시됩니다.
  - When "삭제"를 탭하면 `getRecord('2026-03') === null`, Toast "3월 기록을 삭제했어요"가 표시되고, "3월" 행은 "미입력"으로 바뀝니다.
  - And "취소"를 탭하면 기록 3건이 그대로 남습니다.

- AC-5 [E][P0]: Scenario: 저장으로 상태가 나빠지면 다이얼로그
  - Given 사업자 미등록이고 `2026-01`, `2026-02`에 salary 1,000,000, side 200,000(SAFE)이 저장돼 있을 때
  - When `/record`(month `2026-03`)에서 salary 1,000,000, side 700,000을 저장하면(연 환산 16,400,000원, side 4,400,000원 → WARNING)
  - Then 이동하기 전에 AlertDialog 제목 "자격 상태가 바뀌었어요"와 본문 "안전 → 주의"가 표시됩니다.
  - When "확인"을 탭하면 `navigate('/', { replace: true, state: { savedMonth: '2026-03' } })`가 호출됩니다.
  - And 상태가 같거나 나아진 경우(WARNING → SAFE 등)에는 AlertDialog 없이 바로 이동합니다.

- AC-6 [O][P1]: Scenario: 지난달 미입력 리마인더 배너
  - Where `getSettings().reminderEnabled === true`이고, 프로필이 있으며, `2026-08` 기록이 없고, `dismissedReminderMonth !== '2026-08'`일 때
  - When `/`를 렌더링하면
  - Then `reminder-banner`에 "8월 소득을 아직 입력하지 않았어요"와 Button "입력하기", "닫기"가 표시됩니다.
  - When "입력하기"를 탭하면 `navigate('/record', { state: { month: '2026-08', from: 'home' } })`가 호출됩니다.
  - When "닫기"를 탭하면 `getSettings().dismissedReminderMonth === '2026-08'`이 되고 배너가 사라집니다.
  - And `reminderEnabled === false`이면 배너는 렌더링되지 않습니다.
  - And 오늘이 2027-01-05이면 확인 대상은 `2026-12`이고, 문구는 "2026년 12월 소득을 아직 입력하지 않았어요"입니다.

- AC-7 [S][P1]: Scenario: 선택한 해에 기록이 없을 때 빈 상태
  - Given AC-1 데이터(2025년 기록 0건)일 때
  - When Tab "2025년"을 탭하면
  - Then Asset.ContentIcon과 "이 해에 입력된 소득이 없어요"가 표시되고, `month-row` 12개("12월"~"1월")가 모두 "미입력"입니다.
  - And `ytd-card`는 "2025년 누적 0원"이고 `income-sparkline`은 렌더링되지 않습니다.
  - And 12개 행은 가상 스크롤 없이 페이지 스크롤로 보이며, 마지막 행 아래에 FloatingTabBar를 피하는 Spacing이 있습니다.

- AC-8 [W][P1]: Scenario: 삭제 실패
  - Given `deleteRecord`가 `{ ok: false, error: 'STORAGE_UNAVAILABLE' }`을 반환하도록 mock했을 때
  - When "3월" 삭제를 확인하면
  - Then Toast "삭제하지 못했어요. 다시 시도해주세요"가 표시되고, "3월" 행은 "1,400,000원"으로 남습니다.

---

### F6. 지역가입자 전환 시뮬레이션
- **설명**: 사용자가 본업·부업 월 소득과 사업자등록 여부를 바꿔 보면서, 피부양자 상태와 지역가입자로 바뀔 때의 예상 보험료를 현재와 나란히 비교합니다. 자격을 유지할 수 있는 부업 월 최대 금액과, 부업을 늘렸을 때 보험료를 빼고 실제로 남는 금액을 계산해 부업 확대 판단을 돕습니다. 시뮬레이션 값은 저장하지 않습니다.
- **Data**: MonthlyIncomeRecord, UserProfile(읽기 전용), DiagnosisResult, PremiumEstimate
- **API**: 없음
- **계산 규칙**
  - 기준값: `summarizeYear` 결과에서 `Math.floor(salaryAnnual/12)`, `Math.floor(sideAnnual/12)`, `Math.floor(otherAnnual/12)`를 씁니다. 기타 소득은 화면에서 바꿀 수 없고 현재값으로 고정합니다.
  - 시뮬레이션 연 환산은 각 월값 × 12입니다.
  - 순증가액: `netGain = (simSide − baseSide) × 12 − (simPremiumAnnual − basePremiumAnnual)`. premium은 해당 status가 DROP일 때만 `estimatePremium(totalAnnual).totalAnnual`이고, 아니면 0입니다.
- **Screens**: S6 `/simulate`
- **Requirements**

- AC-1 [U][P0]: Scenario: 현재값 불러오기
  - Given 사업자 미등록이고 `2026-01`~`2026-03`에 salary 1,000,000, side 200,000이 저장돼 있을 때
  - When `/simulate`에 `state = { year: 2026 }`으로 진입하면
  - Then `sim-salary`는 "1,000,000", `sim-side`는 "200,000", `sim-biz-switch`는 off입니다.
  - And `compare-card[0]`(제목 "현재")에 Badge "안전", "연 14,400,000원", "보험료 0원 (피부양자 유지)"가 표시됩니다.

- AC-2 [E][P0]: Scenario: 부업 소득을 늘려 탈락하는 경우
  - Given AC-1 상태일 때
  - When `sim-side`를 "500000"으로 바꾸면
  - Then `compare-card[1]`(제목 "시뮬레이션")에 Badge "탈락 위험", "연 18,000,000원", "월 예상 보험료 122,020원"이 표시됩니다.
  - And `net-gain-value`는 "부업으로 연 3,600,000원 더 벌면 보험료 연 1,464,240원을 내고 실제로 2,135,760원이 늘어요"입니다.

- AC-3 [E][P1]: Scenario: 증액 Chip
  - Given AC-1 상태(`sim-side` "200,000")일 때
  - When Chip "+50만원"을 탭하면 `sim-side`는 "700,000"이 됩니다.
  - When 이어서 Chip "+200만원"을 탭하면 "2,700,000"이 되고, `compare-card[1]`의 Badge는 "탈락 위험"입니다.

- AC-4 [U][P0]: Scenario: 부업 최대 안전 금액과 사업자등록 전환
  - Given AC-1 상태일 때
  - Then `max-safe-side`는 "부업은 월 416,666원까지 피부양자 유지가 가능해요"입니다.
  - When `sim-biz-switch`를 on으로 바꾸면 `max-safe-side`는 "사업자등록 시 부업 소득이 있으면 자격이 유지되지 않아요", `compare-card[1]`의 Badge는 "탈락 위험"이 됩니다.
  - And 이때 `getProfile().hasBusinessRegistration`은 `false`로 바뀌지 않습니다.
  - And `sim-salary`를 "1,700,000", `sim-side`를 "0"으로 두고 스위치를 off로 바꾸면 `max-safe-side`는 "본업·기타 소득만으로 기준을 넘어요"입니다.

- AC-5 [W][P1]: Scenario: 입력 상한 초과
  - Given AC-2 결과가 표시된 상태일 때
  - When `sim-side`에 "1000000001"을 입력하면
  - Then `sim-side` 아래에 에러 "월 소득은 10억원 이하로 입력해주세요"가 표시되고, `compare-card[1]`은 "연 18,000,000원"을 유지합니다.

- AC-6 [W][P1]: Scenario: 부업을 늘려도 손해인 경우
  - Given 사업자 미등록이고 3개월 모두 salary 1,300,000, side 300,000이 저장돼 있을 때(현재 WARNING, 연 19,200,000원)
  - When `sim-side`를 "400000"으로 바꾸면
  - Then `compare-card[1]`은 "탈락 위험", "연 20,400,000원", "월 예상 보험료 138,290원"입니다.
  - And `net-gain-value`는 "부업으로 연 1,200,000원 더 벌어도 보험료 연 1,659,480원 때문에 오히려 연 459,480원 손해예요"입니다.
  - And `max-safe-side`는 "부업은 월 366,666원까지 피부양자 유지가 가능해요"입니다.
  - And `sim-side`를 현재값 이하("300000")로 되돌리면 `net-gain-value`는 "부업 소득을 늘려 비교해보세요"입니다.

- AC-7 [S][P1]: Scenario: 기록이 없을 때 빈 상태
  - Given 2026년 기록이 0건이고 사업자 미등록일 때
  - When `/simulate`에 `state = null`로 진입하면
  - Then Paragraph.Text "입력된 소득이 없어 직접 입력한 금액으로 계산해요"가 표시되고, `sim-salary`와 `sim-side`는 빈 값(placeholder "0")입니다.
  - And `compare-card[0]`은 Badge "안전", "연 0원"입니다.
  - When `sim-salary`에 "1000000"을 입력하면 `compare-card[1]`은 "안전", "연 12,000,000원"입니다.

- AC-8 [U][P1]: Scenario: 시뮬레이션 레이아웃과 광고 배치
  - Given AC-2 상태일 때
  - Then ScreenScaffold 안에 `compare-card` Card가 정확히 2개이고, 가로 2열 grid로 배치되며, 각 카드의 연 환산 금액은 t3 이상으로 강조됩니다.
  - And DOM 순서는 입력 영역 → `compare-card`들 → `max-safe-side` → `net-gain-value` → `simulate-ad-slot`입니다. AdSlot은 결과 카드 뒤에만 있고 입력 필드 사이에는 없습니다.
  - And `sim-salary`와 `sim-side`는 `inputMode="numeric"`이고, Chip 3개의 높이는 44px 이상입니다.

---

### F7. 설정과 데이터 관리
- **설명**: 판정에 쓰이는 사업자등록 여부 수정, 월간 리마인더 on/off, 계산 기준 확인, 모든 데이터 삭제를 한 화면에서 제공합니다. 모든 진단이 추정치라는 면책 문구를 항상 보여줍니다.
- **Data**: UserProfile, AppSettings, RecordsStore, ReportUnlock
- **API**: 없음
- **Screens**: S7 `/settings`, S2 `/profile`(edit 모드)
- **Requirements**

- AC-1 [E][P0]: Scenario: 리마인더 끄기
  - Given `ddg:settings:v1`이 기본값일 때
  - When `/settings`에서 `reminder-switch`를 탭하면
  - Then Switch는 off, `getSettings().reminderEnabled === false`이고, 홈의 `reminder-banner`는 렌더링되지 않습니다.

- AC-2 [E][P0]: Scenario: 사업자등록 여부 수정
  - Given 프로필 `{ hasBusinessRegistration: false }`와 salary 1,000,000, side 200,000 × 3개월 기록이 있을 때
  - When `row-biz`("없음")를 탭하면 `navigate('/profile', { state: { mode: 'edit' } })`가 호출되고, `biz-option-no`가 `aria-checked="true"`이며 버튼 문구는 "저장하기"입니다.
  - When `biz-option-yes`를 선택하고 "저장하기"를 탭하면
  - Then `getProfile().hasBusinessRegistration === true`이고 `navigate('/settings', { replace: true })`가 호출되며, `row-biz` 오른쪽은 "있음"입니다.
  - And `/`의 Badge는 "탈락 위험", 사유는 "사업자등록 상태에서 부업 소득이 있어요"입니다.

- AC-3 [E][P1]: Scenario: 모든 데이터 삭제
  - Given 4개 키(`ddg:profile:v1`, `ddg:records:v1`, `ddg:settings:v1`, `ddg:reportUnlock:v1`)가 모두 있을 때
  - When `row-reset`를 탭하면 AlertDialog 제목 "모든 데이터를 삭제할까요?", 본문 "입력한 소득 기록과 설정이 모두 지워지고 되돌릴 수 없어요", 버튼 "취소"/"삭제"가 표시됩니다.
  - When "삭제"를 탭하면 4개 키가 모두 `localStorage.getItem`에서 `null`이 되고, `navigate('/profile', { replace: true, state: { mode: 'onboarding' } })`가 호출됩니다.

- AC-4 [E][P2]: Scenario: 계산 기준 보기
  - When `row-rules`를 탭하면
  - Then BottomSheet에 ListRow 6개가 표시됩니다: "합산 소득 기준: 연 20,000,000원 초과 시 탈락", "부업 소득 기준(사업자 미등록): 연 5,000,000원 초과 시 탈락", "부업 소득 기준(사업자 등록): 0원 초과 시 탈락", "주의 구간: 기준의 80% 이상", "건강보험료율: 7.19%", "장기요양보험료: 건강보험료의 13.14%"
  - And 문구의 숫자는 `RULES` 상수에서 만들며, 하드코딩하지 않습니다.

- AC-5 [W][P1]: Scenario: 데이터 삭제 실패
  - Given `clearAllData`가 `{ ok: false, error: 'STORAGE_UNAVAILABLE' }`을 반환하도록 mock했을 때
  - When 데이터 삭제를 확인하면
  - Then Toast "삭제하지 못했어요. 다시 시도해주세요"가 표시되고, 화면은 `/settings`에 머물며 기록은 그대로입니다.

- AC-6 [W][P1]: Scenario: 설정 저장 실패
  - Given `saveSettings`가 `{ ok: false, error: 'STORAGE_FULL' }`을 반환하도록 mock했을 때
  - When `reminder-switch`를 탭하면
  - Then Switch는 on으로 되돌아가고, Toast "저장 공간이 부족해 설정을 저장하지 못했어요"가 표시됩니다.

- AC-7 [S][P1]: Scenario: 프로필이 없을 때
  - Given `ddg:profile:v1`이 없고 `/settings`에 직접 진입했을 때
  - Then `row-biz` 오른쪽은 "미설정"입니다.
  - When `row-biz`를 탭하면 `navigate('/profile', { state: { mode: 'edit' } })`가 호출되고, 선택 전에는 "저장하기" 버튼이 `disabled`입니다.

- AC-8 [U][P1]: Scenario: 면책 문구 상시 노출
  - Given `/settings`, `/report`(열린 상태), `/profile` 화면일 때
  - Then 각 화면에 `DISCLAIMER_TEXT`("이 앱의 진단은 입력한 소득을 바탕으로 한 참고용 추정치이며, 실제 자격 판정과 보험료는 국민건강보험공단 기준에 따라 달라질 수 있어요.")가 Paragraph.Text로 1회 표시됩니다.
  - And 이 문구에는 외부 링크(`<a href="http`)가 없습니다.

---

### F8. 앱인토스 검수 준수 가드
- **설명**: 앱인토스 검수에서 반려되는 항목(외부 이탈, 콘솔 에러, HEX 색상, 외부 로깅, 설치 유도, 호환성, 금지 UI 라이브러리)을 자동 테스트와 정적 검사로 막습니다. 알 수 없는 라우트와 빈 저장소 같은 경계 상태에서도 에러 없이 동작하는지 확인합니다.
- **Data**: 없음(전체 소스와 빌드 산출물 검사)
- **API**: 없음
- **산출물**:
  - `scripts/check-compliance.mjs`: 정적 grep 검사. 위반하면 exit 1
  - `src/__tests__/compliance.test.tsx`: 라우트 순회 테스트
- **Requirements**

- AC-1 [W][P0]: Scenario: 외부 도메인 이탈 금지
  - Given `src/**/*.{ts,tsx}`에서(테스트 파일 제외)
  - When `check-compliance`를 실행하면
  - Then 정규식 `window\.open\(`, `window\.location\.href\s*=`, `location\.assign\(`, `location\.replace\(`, `href=["']https?://`에 걸리는 곳이 0건이고 exit code는 0입니다.

- AC-2 [U][P0]: Scenario: 콘솔 에러 0개
  - Given `console.error`를 spy하고 (a) 빈 localStorage와 (b) F1 AC-3 1행 데이터 두 조건일 때
  - When MemoryRouter로 `/`, `/profile`, `/record`, `/history`, `/report`, `/simulate`, `/settings`, `/unknown`을 차례로 렌더링하면
  - Then 두 조건 모두 `console.error` 호출 횟수가 0입니다.

- AC-3 [W][P1]: Scenario: 알 수 없는 라우트
  - Given 프로필이 있을 때
  - When `/does-not-exist`로 진입하면
  - Then `/`로 replace 이동해 홈 화면(`status-hero` 또는 빈 상태 문구)이 렌더링되고, 404 텍스트나 흰 화면이 나타나지 않습니다.

- AC-4 [W][P1]: Scenario: HEX 색상 하드코딩 금지
  - Given `src/**/*.{ts,tsx,css}`에서(테스트 파일 제외)
  - When `check-compliance`를 실행하면
  - Then 정규식 `#[0-9a-fA-F]{3,8}\b`(색상 문맥: `color`, `background`, `border`, `fill`, `stroke` 속성 값, 또는 CSS 선언)에 걸리는 곳이 0건입니다.
  - And 색상은 `var(--tds-color-` 접두사나 TDS 컴포넌트 prop으로만 지정합니다.

- AC-5 [W][P1]: Scenario: 외부 로깅과 금지 UI 라이브러리 차단
  - Given `package.json`의 `dependencies`와 `devDependencies`를 검사할 때
  - Then `react-ga`, `react-ga4`, `@amplitude/`, `mixpanel-browser`, `firebase`, `@sentry/`, `@mui/`, `antd`, `@chakra-ui/`로 시작하는 패키지가 0개입니다.
  - And `src`에서 `gtag(`, `amplitude.`, `mixpanel.` 문자열이 0건입니다.

- AC-6 [W][P1]: Scenario: 앱 설치 유도 문구 금지
  - Given `src/**/*.{ts,tsx}`와 `index.html`에서
  - When `check-compliance`를 실행하면
  - Then 문자열 "앱을 설치", "설치하세요", "다운로드", "앱스토어", "플레이스토어"가 0건입니다.

- AC-7 [U][P1]: Scenario: Android 7+, iOS 16+ 호환
  - Given `src/**/*.{ts,tsx}`에서(테스트 파일 제외)
  - When `check-compliance`를 실행하면
  - Then `.at(`, `structuredClone(`, `.replaceAll(`, `Object.hasOwn(`, `.findLast(`, `.toSorted(`, `Array.fromAsync(`가 0건입니다.
  - And `npm run build`가 성공합니다.

- AC-8 [U][P1]: Scenario: 수익화 API 오용 방지
  - Given `src`에서
  - Then `grantPromotionReward`, `TossPurchase`, `IAP.` 사용이 0건입니다(이 앱은 광고만 씁니다).
  - And `AdSlot` 사용처는 `adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID}`, `TossRewardAd` 사용처는 `slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}`만 쓰고, 문자열 리터럴 ID는 0건입니다.

---

## Assumptions
1. **판정 기준 수치**
   - PRD에는 "연 2,000만원 등"만 있습니다.
   - 부업 사업자 미등록 500만원 초과, 사업자 등록 시 소득 발생, 주의 구간 80%는 이 SPEC에서 정한 가정값입니다.
   - 모두 `RULES` 상수 한 곳에서 관리하고 설정 화면에 공개합니다.
2. **보험료율 수치**: 건강보험료율 7.19%와 장기요양보험료 건강보험료의 13.14%는 2026년 기준 가정값입니다. 공식 수치가 다르면 `RULES`만 고칩니다.
3. **예상 보험료 범위**
   - 지역가입자 보험료는 **소득분만** 계산합니다. 재산·자동차분, 최저·최고 보험료, 경감 제도는 반영하지 않고, 추정치라고 표시합니다.
   - 피부양자(SAFE/WARNING)의 보험료는 0원으로 표시합니다.
4. **입력 금액의 의미**: 사용자가 입력하는 금액은 그대로 판정 소득으로 씁니다. 필요경비 차감, 소득 종류별 반영률, 분리과세는 계산하지 않습니다.
5. **연 환산 방식**: 연 환산은 해당 연도에 입력된 달의 평균 × 12이며, 소득을 입력한 해를 기준으로 판정합니다.
6. **알림 방식**: PRD의 "매달 알림"은 MVP 원칙(푸시 금지)에 따라 인앱 리마인더 배너와 상태 변화 AlertDialog로 대신합니다.
7. **리포트 열람 규칙**
   - 보상형 광고로 연 리포트는 **달력 월 단위**로 유지됩니다(같은 달에는 다시 광고 없음).
   - 광고 로드에 실패하면 사용자 경험을 위해 리포트를 보여주되, 열람 상태는 저장하지 않습니다.
8. **템플릿 인터페이스**
   - 템플릿의 ScreenScaffold, SubmitFooter, Card, SummaryHero(CountUp), Sparkline, MiniBar, FloatingTabBar, AdSlot, TossRewardAd를 그대로 씁니다.
   - TossRewardAd의 보상 완료, 로드 실패, 중도 종료 콜백 이름은 템플릿 코드에 맞춥니다. 테스트에서는 이 컴포넌트를 mock합니다.
9. **입력 범위**: 입력할 수 있는 달은 전년도 1월부터 이번 달까지이고, 월 소득 상한은 10억원입니다.
10. **AI 미사용**: 생성형 AI를 쓰지 않으므로 AI 고지 의무 대상이 아닙니다.
11. **사용자 식별**: 사용자를 식별할 필요가 없으므로 `getIsTossLoginIntegratedService()`는 호출하지 않습니다.

## Open Questions
1. **타깃 사용자와 제도의 불일치**
   - PRD 타깃은 "직장 다니며 부업하는 N잡러"입니다. 그런데 직장가입자 본인은 피부양자가 아니고, 보수 외 소득이 기준을 넘을 때 **소득월액보험료**가 따로 부과되는 구조일 수 있습니다.
   - 확인할 것: 타깃을 "부모·배우자의 피부양자로 등록된 부업러"로 좁힐지, 아니면 직장가입자용 소득월액보험료 진단을 추가할지 정해야 합니다.
2. **판정 기준 검증**: 합산소득 2,000만원, 사업소득 요건(사업자 미등록 500만원, 등록 시 소득 발생), 재산 요건, 판정 시점(전년도 소득 확정 후 반영 시기)을 국민건강보험공단의 최신 기준으로 확인해야 합니다.
3. **입력 기준**: 사용자가 입력할 금액이 **수입(매출)**인지 **소득금액(필요경비 차감 후)**인지, 그리고 근로·연금·금융소득별 반영 방식을 UI 안내 문구로 어떻게 설명할지 정해야 합니다.
4. **보험료율 검증**: 2026년 건강보험료율과 장기요양보험료율 공식 수치를 확인해야 하고, 연도가 바뀔 때 `RULES`를 연도별 배열로 확장할지 정해야 합니다.
5. **재산분 반영 여부**: 예상 보험료에 재산·자동차분 간이 입력(예: 재산세 과세표준)을 넣을지, MVP 이후로 미룰지 정해야 합니다.
6. **리포트 열람 주기**: 보상형 광고 열람 주기를 월 1회로 할지, 데이터를 바꿀 때마다 다시 잠글지는 수익(MRR 64 목표)과 사용자 경험의 균형을 보고 정해야 합니다.