import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL),
  base = "https://serena-kickoff-arena.vercel.app";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let id, keyId;
try {
  await page.goto(base);
  await page
    .getByRole("button", { name: "Gửi bài tham dự" })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      !document.querySelector('button[type="submit"],button.primary')?.disabled,
  );
  await page.screenshot({ path: "artifacts/form-desktop.png", fullPage: true });
  await page.getByLabel("Họ và tên").fill("KIỂM THỬ HỆ THỐNG");
  await page.getByLabel("Số điện thoại").fill("0900000000");
  await page.getByLabel("Đơn vị / Sàn giao dịch").fill("QA - SẼ XÓA");
  await page
    .getByLabel("Đường dẫn bài viết Facebook")
    .fill("https://www.facebook.com/serena-qa/posts/9876543210123456789");
  await page.getByRole("checkbox").check();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/submit") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Gửi bài tham dự" }).click();
  const posted = await response;
  assert.equal(posted.status(), 201);
  id = (await posted.json()).id;
  await page.getByText("Đã nhận bài của bạn!").waitFor();
  assert.equal(
    (await sql`SELECT name FROM submissions WHERE id=${id}`)[0].name,
    "KIỂM THỬ HỆ THỐNG",
  );
  assert.equal((await context.request.get(base + "/api/admin")).status(), 401);
  assert.equal(
    (
      await context.request.post(
        base +
          "/api/apify-webhook?job=00000000-0000-4000-8000-000000000000&signature=invalid",
        { data: {} },
      )
    ).status(),
    401,
    "Webhook rejects forged signature",
  );
  await page.goto(base + "/admin");
  await page.getByLabel("Mật khẩu quản trị").fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("heading", { name: "Tổng quan sự kiện" }).waitFor();
  await page.screenshot({
    path: "artifacts/admin-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Quản lý bài dự thi/ }).click();
  await page.getByText("KIỂM THỬ HỆ THỐNG", { exact: true }).waitFor();
  await page.getByPlaceholder("Tìm tên, SĐT, nội dung bài…").fill("KIỂM THỬ");
  await page.getByText("KIỂM THỬ HỆ THỐNG", { exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page
    .getByRole("button", { name: "Cài đặt sự kiện", exact: true })
    .click();
  const settingsResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/settings") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu thể lệ", exact: true }).click();
  assert.equal((await settingsResponse).status(), 200);
  await page.getByRole("button", { name: "Apify API keys" }).click();
  await page.getByRole("heading", { name: "Thêm tài khoản Apify" }).waitFor();
  await page.getByLabel("Tên gợi nhớ").fill("QA TEMP KEY");
  await page
    .getByLabel("API token", { exact: true })
    .fill("apify_api_QA_NOT_REAL_TOKEN_12345");
  const keyResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/keys") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Thêm API key", exact: true }).click();
  assert.equal((await keyResponse).status(), 200);
  const [stored] =
    await sql`SELECT id,secret FROM api_keys WHERE label='QA TEMP KEY'`;
  keyId = stored.id;
  assert.ok(!stored.secret.includes("QA_NOT_REAL_TOKEN"));
  const switchResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/keys/toggle"),
  );
  await page.getByRole("switch", { name: "Bật key QA TEMP KEY" }).click();
  assert.equal((await switchResponse).status(), 200);
  assert.equal(
    (await sql`SELECT enabled FROM api_keys WHERE id=${keyId}`)[0].enabled,
    false,
  );
  await page.getByRole("button", { name: "Nhật ký API" }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  const pub = await (await context.request.get(base + "/api/public")).json();
  assert.ok(
    !JSON.stringify(pub).includes("0900000000"),
    "Public endpoint excludes phone",
  );
  const denied = await context.request.post(base + "/api/publish", {
    data: {},
  });
  assert.equal(denied.status(), 409, "Cannot publish unscanned submissions");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole("button", { name: "Gửi bài tham dự" }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "artifacts/form-mobile.png", fullPage: true });
  await page.goto(base + "/live");
  await page.getByText("Bục vinh quang đang chờ bạn").waitFor();
  await page.screenshot({
    path: "artifacts/live-empty-mobile.png",
    fullPage: true,
  });
  const fixture = {
    settings: {
      metric: "likes",
      hashtags: ["SerenaRiverside", "KickoffSerena"],
      published: true,
      published_at: new Date().toISOString(),
    },
    leaderboard: [
      {
        id: "a",
        name: "Nguyễn Minh Anh",
        team: "Serena Partners",
        likes: 1258,
      },
      {
        id: "b",
        name: "Trần Hoàng Nam",
        team: "Riverside Realty",
        likes: 1146,
      },
      { id: "c", name: "Lê Ngọc Hà", team: "Southern Land", likes: 987 },
      { id: "d", name: "Phạm Quốc Bảo", team: "Serena Partners", likes: 862 },
    ],
  };
  await page.route("**/api/public", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  await page.getByRole("button", { name: /Bắt đầu lễ vinh danh/ }).click();
  await page
    .getByRole("button", { name: "Phát lại lễ vinh danh" })
    .waitFor({ timeout: 20000 });
  await page.screenshot({
    path: "artifacts/award-fixture-1920.png",
    fullPage: true,
  });
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "public form",
        "Neon persistence",
        "admin authentication",
        "submission filters and detail",
        "settings keys and logs",
        "publication freshness guard",
        "public privacy",
        "mobile overflow",
        "award countdown and reveal",
      ],
      browserErrors: errors.length,
      fixtureNote:
        "Award screenshot uses browser-only synthetic data; no fake leaderboard was published",
    }),
  );
} finally {
  if (keyId) await sql`DELETE FROM api_keys WHERE id=${keyId}`;
  if (id) await sql`DELETE FROM submissions WHERE id=${id}`;
  await browser.close();
}
