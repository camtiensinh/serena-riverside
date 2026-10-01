import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const entries = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    name: "TEST " + (i + 1),
    team: "SERENA",
    likes: 900 - i,
    reactions: 100 - i,
    comments: 2,
    shares: 1,
    media:
      i === 4
        ? [
            "https://image.test/1.jpg",
            "https://image.test/broken.jpg",
            "https://image.test/2.jpg",
            "https://image.test/3.jpg",
          ]
        : [],
  }));
  await page.route("**/api/public", (r) =>
    r.fulfill({
      json: {
        settings: {
          display_mode: "auto",
          display_started_at: new Date(Date.now() - 11000).toISOString(),
          metric: "likes",
        },
        leaderboard: entries,
        server_time: new Date().toISOString(),
      },
    }),
  );
  await page.route("https://image.test/**", (r) =>
    r.request().url().includes("broken")
      ? r.abort()
      : r.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="blue"/></svg>',
        }),
  );
  await page.goto(
    (process.env.TEST_BASE_URL || "http://localhost:3000") + "/live",
  );
  await page.getByRole("heading", { name: "HẠNG 5", exact: true }).waitFor();
  await page.locator(".award-collage.photos-3").waitFor();
  assert.equal(await page.locator(".collage-cell").count(), 3);
  assert.match(
    await page.locator(".award-metrics span").first().innerText(),
    /96\s*Cảm xúc/i,
  );
  assert.match(await page.locator(".place-5").innerText(), /96 CẢM XÚC/);
  console.log(
    "PASS: countdown opens rank 5; failed fourth image collapses to 3-photo layout; reactions shown even when API setting says likes.",
  );
} finally {
  await browser.close();
}
