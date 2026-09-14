🇺🇸 [한국어](./README.ko.md)

# DependentDropGuard

앱인토스 (Vite + React + TDS) 부업·N잡 소득이 늘어날 때 건강보험 피부양자 자격을 유지할 수 있는지 매달 진단해주는 앱 N잡·부업이 늘면서 소득이 일정 기준(연 2,000만원 등)을 넘으면 건강보험 피부양자 자격을 잃고 지역가입자로 전환되어 보험료 폭탄을 맞는 경우가 많은데, 이를 미리 확인할 방법이 마땅치 않다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/History` | History |
| `/Home` | Home |
| `/Profile` | Profile |
| `/Record` | Record |
| `/Report` | Report |
| `/ReportUnlockManager` | ReportUnlockManager |
| `/Settings` | Settings |
| `/Simulate` | Simulate |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-13
