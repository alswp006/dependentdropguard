#!/usr/bin/env node
// 토스 검수 반려 패턴 정적 검사. 의존성 0(순수 node ESM).
// 사용: node scripts/check-compliance.mjs [projectRoot]  (생략 시 process.cwd())
// 대상: src/pages, src/components 아래 .ts/.tsx/.js/.jsx (테스트·템플릿 래퍼 정의 파일 제외)
// 위반이 1건이라도 있으면 exit 1. 경고(탭 하단 여백·AdSlot 위치)는 출력만 하고 exit 코드에 반영하지 않는다.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const SCAN_DIRS = ["src/pages", "src/components"];
const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;

// 템플릿이 SDK를 감싸려고 제공한 래퍼 정의 파일 — 그 안의 IAP./TossPurchase는 정의 자체다.
const TEMPLATE_WRAPPERS = new Set([
  "src/components/AdSlot.tsx",
  "src/components/TossRewardAd.tsx",
  "src/components/TossPurchase.tsx",
]);

// FloatingTabBar 아래 콘텐츠가 가려지지 않게 마지막에 Spacing size={32} 3개를 두는 탭-루트 화면
const TAB_SCREENS = ["src/pages/Home.tsx", "src/pages/History.tsx", "src/pages/Simulate.tsx", "src/pages/Settings.tsx"];

const RULES = [
  { id: "hex-color", message: "HEX 색상 하드코딩 — var(--adaptive*)/var(--tds-color-*) 사용", re: /(?<![&\w])#[0-9a-fA-F]{3,8}\b/ },
  {
    id: "forbidden-ui-lib",
    message: "TDS 외 UI 라이브러리 import",
    re: /(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](?:@mui\/[^'"]*|antd(?:\/[^'"]*)?|@chakra-ui\/[^'"]*|[^'"]*shadcn[^'"]*)['"]/,
  },
  { id: "payment", message: "인앱결제 사용(TossPurchase/IAP.)", re: /\bTossPurchase\b|\bIAP\./ },
  { id: "promotion", message: "프로모션 지급 사용(grantPromotionReward)", re: /\bgrantPromotionReward\b/ },
  { id: "forbidden-copy", message: "금지 카피('취소'/'설치하세요'/'다운로드')", re: /취소|설치하세요|다운로드/ },
];

function toPosix(p) {
  return p.split(sep).join("/");
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function collectFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...collectFiles(full));
    } else if (SOURCE_EXT.test(name) && !/\.(test|spec)\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
const warnings = [];

const files = SCAN_DIRS.flatMap((d) => collectFiles(join(root, d)))
  .map((full) => ({ full, rel: toPosix(relative(root, full)) }))
  .filter(({ rel }) => !TEMPLATE_WRAPPERS.has(rel))
  .sort((a, b) => a.rel.localeCompare(b.rel));

for (const { full, rel } of files) {
  const content = readFileSync(full, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    if (isCommentLine(line)) return;
    for (const rule of RULES) {
      const m = line.match(rule.re);
      if (m) violations.push({ rel, line: i + 1, message: rule.message, match: m[0] });
    }
  });

  if (rel.startsWith("src/pages/")) {
    // AdSlot은 콘텐츠 사이나 결과 뒤에만 — 본문 콘텐츠보다 먼저 나오면 화면 최상단 배치로 본다.
    const adIdx = content.indexOf("<AdSlot");
    if (adIdx !== -1) {
      const before = content.slice(0, adIdx);
      const hasContentBefore =
        /<(Paragraph\.Text|Card|SummaryHero|ListRow|TextField|EmptyState|CompareCard|Button|Tab|Badge|Sparkline|MiniBar)\b/.test(before);
      if (!hasContentBefore) {
        const line = before.split("\n").length;
        warnings.push(`${rel}:${line} AdSlot이 화면 최상단에 있어요 — 콘텐츠 사이나 결과 뒤로 옮기세요`);
      }
    }
  }
}

for (const rel of TAB_SCREENS) {
  const full = join(root, rel);
  if (!existsSync(full)) continue;
  const content = readFileSync(full, "utf8");
  // 3연속 Spacing 뒤에는 자리를 차지하지 않는 오버레이(Toast/AlertDialog/BottomSheet 류)만 올 수 있다.
  const m = content.match(/(?:<Spacing\s+size=\{32\}\s*\/>\s*){3}([\s\S]*?)<\/(?:ScreenScaffold|PageShell)>/);
  const tail = m ? m[1].replace(/<\/?[A-Za-z.]*(Toast|Dialog|Sheet)\b/g, "") : "";
  if (!m || /<[A-Za-z]/.test(tail)) {
    warnings.push(`${rel} 마지막에 <Spacing size={32} /> 3개가 없어요 — 하단 탭바가 콘텐츠를 가릴 수 있어요`);
  }
}

for (const w of warnings) console.log(`warn ${w}`);

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`✗ ${v.rel}:${v.line} ${v.message} — ${v.match}`);
  }
  console.error(`\ncheck-compliance: 위반 ${violations.length}건 (파일 ${files.length}개 검사)`);
  process.exit(1);
}

console.log(`check-compliance: ok (파일 ${files.length}개 검사, 경고 ${warnings.length}건)`);
