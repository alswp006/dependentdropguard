import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Packet 0020: 정적 검수 스크립트(scripts/check-compliance.mjs) + 화면 흐름·콘솔 에러 테스트(flows.test.tsx)
 *
 * 이 파일은 아직 존재하지 않는 두 산출물의 계약을 고정한다(TDD red — 지금은 전부 실패해야 정상):
 *
 * scripts/check-compliance.mjs 계약
 *  - 실행: `node scripts/check-compliance.mjs [projectRoot]` (projectRoot 생략 시 process.cwd())
 *  - 대상: `<projectRoot>/src/pages`, `<projectRoot>/src/components` 아래 .ts/.tsx/.js/.jsx 재귀 스캔
 *  - 제외: `__tests__` 디렉터리, `*.test.*`/`*.spec.*` 파일, 템플릿 래퍼 정의 파일
 *    (`src/components/AdSlot.tsx`, `src/components/TossRewardAd.tsx`, `src/components/TossPurchase.tsx`)
 *  - 위반 패턴: HEX 색상(#[0-9a-fA-F]{3,8}), '@mui'/'antd'/'@chakra-ui'/'shadcn' import,
 *    'IAP.' 또는 'TossPurchase' 사용, 'grantPromotionReward' 사용, 금지 카피('취소'/'설치하세요'/'다운로드')
 *  - 출력: 위반마다 최소 "<상대경로>:<라인번호>"를 포함하는 줄을 stdout 또는 stderr에 출력
 *  - 종료 코드: 위반 0건이면 0, 1건 이상이면 1
 *
 * package.json에는 `check:compliance` 스크립트로 위 명령을 연결한다.
 * src/__tests__/flows.test.tsx는 온보딩→소득 입력→홈 진단→리포트 열람→시뮬레이션 흐름과
 * 전 라우트 순회 중 console.error 0회를 검증하는 실제 통합 테스트다(이 파일이 대신 실행하지 않고,
 * 존재·핵심 검증 포함 여부·자체 통과 여부만 확인한다).
 */

const PROJECT_ROOT = resolve(process.cwd());
const COMPLIANCE_SCRIPT = join(PROJECT_ROOT, "scripts", "check-compliance.mjs");
const FLOWS_TEST_FILE = join(PROJECT_ROOT, "src", "__tests__", "flows.test.tsx");

function runCompliance(args: string[] = []) {
  const result = spawnSync(process.execPath, [COMPLIANCE_SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

const tmpRoots: string[] = [];
function makeFixtureRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "ddg-compliance-"));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("정적 검수 스크립트 + 화면 간 흐름·콘솔 에러 테스트", () => {
  it("AC-1[P0]: 현재 코드베이스(src/pages, src/components)를 스캔하면 위반 없이 exit 0이다", () => {
    const { status, output } = runCompliance();
    expect(status).toBe(0);
    expect(output).not.toMatch(/✗|VIOLATION|위반/);
  });

  it("AC-1[P0]: package.json의 'check:compliance' 스크립트가 check-compliance.mjs를 실행하도록 연결돼 있다", () => {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf8"));
    expect(typeof pkg.scripts["check:compliance"]).toBe("string");
    expect(pkg.scripts["check:compliance"]).toMatch(/check-compliance\.mjs/);
  });

  it("AC-1[P1]: 템플릿 래퍼 정의 파일(TossPurchase.tsx)은 검사에서 제외되고, 같은 위반을 가진 일반 파일은 잡힌다", () => {
    const root = makeFixtureRoot();
    mkdirSync(join(root, "src", "components"), { recursive: true });
    const usageSnippet = "export function X() {\n  return IAP.createOneTimePurchaseOrder({});\n}\n";
    writeFileSync(join(root, "src", "components", "TossPurchase.tsx"), usageSnippet);
    writeFileSync(join(root, "src", "components", "Other.tsx"), usageSnippet);

    const { status, output } = runCompliance([root]);

    expect(status).toBe(1);
    expect(output).toContain("Other.tsx");
    expect(output).not.toContain("TossPurchase.tsx");
  });

  it("AC-2[P0]: HEX 색상 위반이 있는 파일은 exit 1로 끝나고 파일:라인을 출력한다", () => {
    const root = makeFixtureRoot();
    mkdirSync(join(root, "src", "pages"), { recursive: true });
    writeFileSync(
      join(root, "src", "pages", "Bad.tsx"),
      "export default function Bad() {\n  return <div style={{ color: '#ff0000' }}>bad</div>;\n}\n",
    );

    const { status, output } = runCompliance([root]);

    expect(status).toBe(1);
    expect(output).toMatch(/Bad\.tsx:2/);
    expect(output).toContain("#ff0000");
  });

  it("AC-2[P0]: 금지 UI 라이브러리 import와 금지 카피 문구가 섞인 파일은 위반 2건 모두 잡는다", () => {
    const root = makeFixtureRoot();
    mkdirSync(join(root, "src", "pages"), { recursive: true });
    writeFileSync(
      join(root, "src", "pages", "Bad2.tsx"),
      "import { Button } from 'antd';\nexport default function Bad2() {\n  return <Button>설치하세요</Button>;\n}\n",
    );

    const { status, output } = runCompliance([root]);

    expect(status).toBe(1);
    const hits = output.match(/Bad2\.tsx:\d+/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("AC-3[P0]: flows.test.tsx가 존재하고 온보딩→기록 저장→홈 진단 흐름의 핵심 지점을 검증한다", () => {
    expect(existsSync(FLOWS_TEST_FILE)).toBe(true);
    const source = readFileSync(FLOWS_TEST_FILE, "utf8");
    expect(source).toContain("biz-option-no");
    expect(source).toContain("기록 저장");
    expect(source).toMatch(/소득을 저장했어요/);
    expect(source).toContain("안전");
  });

  it("AC-4[P0]: flows.test.tsx가 전 라우트 console.error 0회와 시뮬레이션 비교 카드 2개를 검증한다", () => {
    expect(existsSync(FLOWS_TEST_FILE)).toBe(true);
    const source = readFileSync(FLOWS_TEST_FILE, "utf8");
    expect(source).toContain("console.error");
    expect(source).toContain("compare-card");
    expect(source).toContain("시뮬레이션 해보기");
    expect(source).toMatch(/2026-09/);
  });

  it(
    "AC-3+AC-4[P0]: flows.test.tsx 자체가 vitest에서 그린으로 통과한다",
    () => {
      const result = spawnSync("npx", ["vitest", "run", "src/__tests__/flows.test.tsx"], {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
        timeout: 120_000,
        shell: true,
      });
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      expect(result.status).toBe(0);
      expect(output).not.toMatch(/failed|FAIL/i);
    },
    120_000,
  );
});
