🇰🇷 [English](./README.md)

# DependentDropGuard

앱인토스 (Vite + React + TDS) 미니앱. 부업이나 N잡으로 부수입이 있는 경우, 건강보험 피부양자 자격을 유지할 수 있는지 매달 진단해주는 앱입니다.

부업과 N잡으로 소득이 늘어나면서, 일정 기준(예: 연 2,000만원)을 초과하면 건강보험 피부양자 자격을 잃고 지역가입자로 전환되어 보험료 폭탄을 맞는 경우가 많습니다. DependentDropGuard는 이러한 상황을 미리 파악할 수 있도록 도와줍니다.

## 기술 스택

- React 18.0.0
- TypeScript
- Vitest

## 라우트

| 경로 | 설명 |
|------|------|
| `/History` | 기록 보기 |
| `/Home` | 홈 |
| `/Profile` | 프로필 |
| `/Record` | 기록 입력 |
| `/Report` | 진단 보고서 |
| `/ReportUnlockManager` | 보고서 잠금 관리 |
| `/Settings` | 설정 |
| `/Simulate` | 시뮬레이션 |

## 시작하기

```bash
pnpm install
pnpm dev
```

## 개발

```bash
pnpm typecheck    # 타입 검사
pnpm test         # 테스트 실행
pnpm build        # 프로덕션 빌드
```

## 설계 문서

`.ai-factory/` 디렉터리에서 전체 설계 산출물을 확인할 수 있습니다:
- `prd.md` — 제품 요구사항 정의서
- `spec.md` — 기술 명세서
- `task.md` — 에픽/태스크 분해

---
[AI Factory](https://github.com/alswp006/ai-factory)로 구축됨 · 마지막 동기화: 2026-09-13
