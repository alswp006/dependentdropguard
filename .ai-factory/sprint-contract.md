# Sprint Contract: 정적 검수 스크립트 + 흐름·에러 테스트

## 만들 항목
1. **scripts/check-compliance.mjs** — 검수 반려 패턴 정적 검사
   - HEX 색상 하드코딩(`#[0-9a-fA-F]{3,6}`)
   - 외부 링크(`window.location.href`, `window.open`, `target="_blank"`)
   - console.log/warn/error 호출
   - 미성년 타겟 키워드
   - 금지된 라이브러리(D3, Three.js, Tailwind, shadcn/ui)
   - src/ 및 scripts/ 전체 스캔 (node_modules·`.ai-factory` 제외)
   
2. **package.json** — 'check:compliance' 스크립트 추가: `node scripts/check-compliance.mjs`

3. **src/__tests__/flows.test.tsx** — E2E 흐름 테스트
   - 온보딩 → 소득 입력 → 홈(진단) → 리포트(월별) → 시뮬레이션 네비게이션 흐름
   - 전 라우트 순회 (`/`, `/onboarding`, `/income`, `/home`, `/report`, `/simulate`, `/history`)
   - 각 라우트에서 console.error 0회 검증 (try/catch로 SDK 호출 가드 확인)
   - 미분류 에러는 fail

## 사용할 TypeScript 타입
- `UserProfile`, `MonthlyIncomeRecord`, `RecordsStore`, `AppSettings`, `ReportUnlock`, `RuleSet` (types.ts import)
- `StorageResult<T>` 타입으로 storage 작업 결과 검증

## 검증 방법
```bash
npm run check:compliance   # 정적 검사 (exit 0 = 무위반)
npx vitest run flows.test.tsx  # E2E 흐름 테스트 (모든 라우트 순회 + console.error 0)
npm run test:visual       # 비주얼 스모크 (흰 화면 감지)
```

## 절대 하면 안 되는 것
- ❌ App.tsx, main.tsx 수정
- ❌ src/components/PageShell.tsx, ScreenScaffold.tsx 등 템플릿 래퍼 수정
- ❌ check-compliance에서 .ai-factory, node_modules, types.ts 자체 검사
- ❌ 테스트에서 정적 로컬 저장소 외 외부 API 호출
