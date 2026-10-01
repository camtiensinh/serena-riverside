import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { db } from "../src/lib/db";
assert.ok(process.env.DATABASE_SCHEMA?.startsWith("arena_qa_"));
const sql = db(),
  base = "http://localhost:3001";
const ids = Array.from({ length: 10 }, () => randomUUID());
const names = [
  "Nguyễn Hoàng",
  "Trần Minh Anh",
  "Lê Quang Huy",
  "Phạm Thu Hà",
  "Hoàng Yến",
  "Đỗ Gia Bảo",
  "Ngô Thanh Tâm",
  "Trần Khánh Linh",
  "Bùi Minh Tuấn",
  "Nguyễn Phương Thảo",
];
await sql`UPDATE settings SET time_filter_enabled=false,published=NULL,published_at=NULL,auto_scan=false WHERE id=1`;
for (let i = 0; i < 10; i++) {
  const media: Array<{photo_image?:{uri:string};thumbnail?:string}> = [
    { photo_image: { uri: `https://qa-images.invalid/group-${i}.svg` } },
  ];
  if (i === 0)
    media.push({ thumbnail: "https://qa-images.invalid/second.svg" });
  const raw = {
    text: "#SerenaRiverside #KickoffSerena Cùng nhau viết tiếp hành trình rực rỡ tại Serena Riverside. Hẹn gặp bạn ở cột mốc thành công mới!",
    time: "2020-01-01T00:00:00Z",
    reactionLikeCount: 16800 - i * 1300,
    likes: 18000 - i * 1200,
    media,
  };
  await sql`INSERT INTO submissions(id,name,phone,team,facebook_url,post_id,author,avatar,content,media,raw,posted_at,likes,reactions,comments,shares,hashtag_ok,time_ok,status,checked_at) VALUES(${ids[i]},${names[i]},'0900000000',${i % 2 ? "Riverside Partners" : "Serena Group"},${"https://www.facebook.com/qa/posts/" + ids[i]},${ids[i]},${"FB " + names[i]},${"https://qa-images.invalid/avatar-" + i + ".svg"},${raw.text},${JSON.stringify(media)}::jsonb,${JSON.stringify(raw)}::jsonb,${raw.time},${raw.reactionLikeCount},${raw.likes},${2100 - i * 105},${892 - i * 33},true,true,'valid',now())`;
}
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  }),
  page = await context.newPage();
const errors: string[] = [],
  ticks: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().endsWith("/api/tick")) ticks.push(r.url());
});
await context.route("https://qa-images.invalid/**", async (route) => {
  const index = Math.max(
    0,
    Number(route.request().url().match(/\d+/)?.[0] || 0),
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><defs><linearGradient id="g"><stop stop-color="#0b386f"/><stop offset="1" stop-color="#098bb3"/></linearGradient></defs><rect width="900" height="600" fill="url(#g)"/><path d="M0 420 Q220 280 440 440 T900 360" fill="none" stroke="#41cfef" stroke-width="12"/><text x="450" y="160" fill="#d5f8ff" text-anchor="middle" font-family="sans-serif" font-size="38">SERENA RIVERSIDE</text><text x="450" y="220" fill="#67d6ff" text-anchor="middle" font-family="sans-serif" font-size="20">KICKOFF 2026 · QA IMAGE ${index + 1}</text>${Array.from({ length: 7 }, (_, j) => `<circle cx="${180 + j * 90}" cy="${340 + (j % 2) * 25}" r="29" fill="#e5c4a5"/><rect x="${145 + j * 90}" y="${370 + (j % 2) * 25}" width="70" height="140" rx="25" fill="${j % 2 ? "#f5f8ff" : "#112440"}"/>`).join("")}</svg>`;
  await route.fulfill({ contentType: "image/svg+xml", body: svg });
});
try {
  await page.goto(base + "/admin");
  await page.getByLabel("Mật khẩu quản trị").fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("heading", { name: "Tổng quan sự kiện" }).waitFor();
  await page
    .getByRole("button", { name: "Cài đặt sự kiện", exact: true })
    .click();
  assert.equal(await page.getByText("Tự động quét khi CMS đang mở").count(), 0);
  await page.getByLabel("Lọc theo thời gian đăng bài").check();
  let response = page.waitForResponse((r) => r.url().endsWith("/api/settings"));
  await page.getByRole("button", { name: "Lưu thể lệ", exact: true }).click();
  assert.equal((await response).status(), 200);
  assert.equal(
    (
      await sql`SELECT count(*)::int n FROM submissions WHERE status='invalid'`
    )[0].n,
    10,
  );
  await page.getByLabel("Lọc theo thời gian đăng bài").uncheck();
  response = page.waitForResponse((r) => r.url().endsWith("/api/settings"));
  await page.getByRole("button", { name: "Lưu thể lệ", exact: true }).click();
  assert.equal((await response).status(), 200);
  assert.equal(
    (await sql`SELECT count(*)::int n FROM submissions WHERE status='valid'`)[0]
      .n,
    10,
  );
  assert.equal(
    (await sql`SELECT count(*)::int n FROM api_logs`)[0].n,
    0,
    "Changing filters made no API calls",
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: /Quản lý bài dự thi/ }).click();
  await page.getByLabel("Chọn bài của " + names[0], { exact: true }).check();
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "Checkbox must not open detail",
  );
  let chosen: string[] = [];
  await page.route("**/api/scan", async (route) => {
    chosen = route.request().postDataJSON().ids;
    await route.fulfill({
      status: 400,
      json: { error: "QA: scan request captured without calling Apify" },
    });
  });
  await page
    .getByRole("button", { name: "Quét 1 bài đã chọn", exact: true })
    .click();
  await page
    .getByText("QA: scan request captured without calling Apify")
    .waitFor();
  assert.deepEqual(chosen, [ids[0]]);
  await page.unroute("**/api/scan");
  await page.getByRole("button", { name: "Bỏ chọn", exact: true }).click();
  await page
    .getByLabel("Đơn vị", { exact: true })
    .selectOption("Riverside Partners");
  await page.getByLabel("Chọn tất cả bài theo bộ lọc").check();
  assert.equal(
    await page.getByRole("checkbox", { checked: true }).count(),
    6,
    "Five filtered rows + select all",
  );
  await page.getByRole("button", { name: "Bỏ chọn", exact: true }).click();
  await page.getByLabel("Đơn vị", { exact: true }).selectOption("all");
  await page
    .getByRole("button", { name: "Chi tiết " + names[0], exact: true })
    .click();
  await page.getByRole("img", { name: "Ảnh bài viết 1" }).waitFor();
  await page.getByRole("button", { name: "Ảnh tiếp theo" }).click();
  await page.getByRole("img", { name: "Ảnh bài viết 2" }).waitFor();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByLabel("Chọn bài của " + names[9], { exact: true }).check();
  await page
    .getByRole("button", { name: "Xóa bài đã chọn", exact: true })
    .click();
  response = page.waitForResponse((r) =>
    r.url().endsWith("/api/submissions/delete"),
  );
  await page.getByRole("button", { name: "Xác nhận xóa 1 bài" }).click();
  assert.equal((await response).status(), 200);
  assert.ok(
    (await sql`SELECT deleted_at FROM submissions WHERE id=${ids[9]}`)[0]
      .deleted_at,
  );
  const repeat = await context.request.post(base + "/api/submit", {
    data: {
      name: "QA đăng lại",
      team: "QA",
      phone: "0900000000",
      facebookUrl: "https://www.facebook.com/qa/posts/" + ids[9],
      consent: true,
    },
  });
  assert.equal(repeat.status(), 201, "Deleted URL can be submitted again");
  const newId = (await repeat.json()).id;
  await sql`UPDATE submissions SET deleted_at=now() WHERE id=${newId}`;
  assert.equal(
    (
      await context.request.post(base + "/api/scan", { data: { ids: [] } })
    ).status(),
    400,
  );
  assert.equal((await sql`SELECT count(*)::int n FROM scans`)[0].n, 0);
  assert.equal(ticks.length, 0, "Idle CMS never invokes worker");
  await page.screenshot({
    path: "artifacts/admin-checkboxes.png",
    fullPage: true,
  });
  // Return deleted fixture for the visual check; this mutation is inside QA only.
  await sql`UPDATE submissions SET deleted_at=NULL WHERE id=${ids[9]}`;
  await page.goto(base + "/live");
  await page
    .locator(".fb-post-header h2")
    .filter({ hasText: "FB " + names[0] })
    .waitFor();
  await page.getByRole("img", { name: "Ảnh bài viết 1" }).waitFor();
  await page.getByRole("button", { name: "TOP 2", exact: true }).click();
  await page
    .locator(".fb-post-header h2")
    .filter({ hasText: "FB " + names[1] })
    .waitFor();
  await page
    .getByRole("tab")
    .filter({ hasText: "FB " + names[4] })
    .click();
  await page
    .locator(".fb-post-header h2")
    .filter({ hasText: "FB " + names[4] })
    .waitFor();
  await page.getByRole("button", { name: "TOP 3", exact: true }).click();
  await page
    .locator(".fb-post-header h2")
    .filter({ hasText: "FB " + names[2] })
    .waitFor();
  await page.getByRole("button", { name: "TOP 1", exact: true }).click();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page
    .locator(".stage-photo img")
    .evaluate((img: HTMLImageElement) => img.decode());
  await page.screenshot({
    path: "artifacts/blue-stage-1920.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1234, height: 400 });
  await page.screenshot({
    path: "artifacts/blue-stage-wide.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/blue-stage-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "time filter revalidates without Apify",
        "selected scan payload",
        "filtered select-all",
        "soft delete and resubmit",
        "idle CMS no worker",
        "saved images and gallery",
        "top 1/2/3 and right tabs",
        "responsive LED",
      ],
      browserErrors: errors.length,
    }),
  );
} finally {
  await browser.close();
}
