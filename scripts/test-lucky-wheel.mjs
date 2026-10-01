import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import writeXlsxFile from "write-excel-file/node";
import { unlink } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:3000",
  file = ".tmp-lucky.xlsx";
await writeXlsxFile([
  [
    { value: "ho va ten" },
    { value: "dai ly phan phoi" },
    { value: "duong dan bai viet facebook" },
  ],
  [
    { value: "Khach A" },
    { value: "MAPLELAND" },
    { value: "https://facebook.com/share/p/ABC123" },
  ],
  [
    { value: "Khach A duplicate" },
    { value: "MAPLELAND" },
    { value: "https://www.facebook.com/share/p/ABC123/" },
  ],
  [
    { value: "Khach B" },
    { value: "PICOLAND" },
    { value: "https://facebook.com/share/p/DEF456" },
  ],
  [
    { value: "Khach C" },
    { value: "HUNTERLAND" },
    { value: "https://facebook.com/share/p/GHI789" },
  ],
  [
    { value: "Khach D" },
    { value: "DAT XANH SERVICES" },
    { value: "https://facebook.com/share/p/JKL012" },
  ],
]).toFile(file);
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
try {
  const c = await browser.newContext();
  assert.equal(
    (
      await c.request.post(base + "/api/login", {
        headers: { origin: base },
        data: { password: process.env.ADMIN_PASSWORD },
      })
    ).status(),
    200,
  );
  const imported = await c.request.post(base + "/api/wheel/import", {
    headers: { origin: base },
    multipart: {
      segmentName: "QA Lucky",
      file: {
        name: "qa.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: await (await import("node:fs/promises")).readFile(file),
      },
    },
  });
  assert.equal(imported.status(), 200);
  const result = await imported.json();
  assert.equal(result.inserted, 4);
  assert.equal(result.invalid, 1);
  let admin = await (await c.request.get(base + "/api/admin")).json();
  const seg = admin.wheel.segments.find((s) => s.name === "QA Lucky");
  assert.equal(seg.entry_count, 4);
  await c.request.post(base + "/api/wheel/select", {
    headers: { origin: base },
    data: { segmentId: seg.id },
  });
  for (const rank of [1, 3, 2])
    assert.equal(
      (
        await c.request.post(base + "/api/wheel/spin", {
          headers: { origin: base },
          data: { rank },
        })
      ).status(),
      200,
    );
  admin = await (await c.request.get(base + "/api/admin")).json();
  const winners = admin.wheel.winners.filter((w) => w.segment_id === seg.id);
  assert.equal(winners.length, 3);
  assert.equal(new Set(winners.map((w) => w.entry_id)).size, 3);
  const oldSecond = winners.find((w) => w.prize_rank === 2).entry_id;
  assert.equal(
    (
      await c.request.post(base + "/api/wheel/spin", {
        headers: { origin: base },
        data: { rank: 2 },
      })
    ).status(),
    200,
  );
  admin = await (await c.request.get(base + "/api/admin")).json();
  const newSecond = admin.wheel.winners.find(
    (w) => w.segment_id === seg.id && w.prize_rank === 2,
  ).entry_id;
  assert.notEqual(newSecond, oldSecond);
  const page = await c.newPage();
  await page.goto(base + "/lucky");
  await page
    .getByText("DÀNH CHO CHUYÊN VIÊN TƯ VẤN", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".prize-strip").count(), 0);
  await c.request.post(base + "/api/wheel/reset", {
    headers: { origin: base },
    data: {},
  });
  admin = await (await c.request.get(base + "/api/admin")).json();
  assert.equal(
    admin.wheel.winners.filter((w) => w.segment_id === seg.id).length,
    0,
  );
  console.log(
    "PASS: dedupe, prizes in any order, redraw, centered live screen and reset.",
  );
} finally {
  await browser.close();
  await unlink(file).catch(() => {});
}
