import { test, expect } from '@playwright/test';

// nightcrew Sentinel smoke 팩 — Factory 산출(§7.1)
// 핵심 막: 본업+부업 소득 합산 입력, 피부양자 자격 유지/탈락 여부 즉시 진단, 탈락 시 예상 건강보험료 계산, 매달 소득 변동 추적 및 알림, 지역가입자 전환 시뮬레이션
// 토스 브릿지 의존 구간(로그인·결제)은 외부 재현 불가 — 화면 도달 확인까지만.
const ROUTES = ["/","/History","/Home","/Profile","/Record"];
// WebView 밖 실행에서만 나는 콘솔 에러는 무시(앱인토스 관례 — toss visual-smoke 템플릿 계승)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /granite/i, /apps-in-toss/i];

for (const route of ROUTES) {
  test(`smoke: ${route} 렌더링과 콘솔 에러 없음`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(msg.text()))) errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
