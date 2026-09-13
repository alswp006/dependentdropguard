import { test } from "@playwright/test";
test("compare fullpage vs viewport", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("ddg:profile:v1", JSON.stringify({version:1,hasBusinessRegistration:false,createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z"}));
    window.localStorage.setItem("ddg:records:v1", JSON.stringify({version:1,items:[
      {month:"2026-01",salaryIncome:3200000,sideIncome:0,otherIncome:0,memo:"",updatedAt:"2026-01-31T00:00:00.000Z"},
      {month:"2026-02",salaryIncome:3200000,sideIncome:500000,otherIncome:0,memo:"",updatedAt:"2026-02-28T00:00:00.000Z"}
    ]}));
  });
  await page.goto("/history");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/history-viewport.png", fullPage: false });
  await page.screenshot({ path: "/tmp/history-fullpage.png", fullPage: true });
});
