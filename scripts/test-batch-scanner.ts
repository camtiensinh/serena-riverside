import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { encrypt, digest } from "../src/lib/security";
import { startScan, tick } from "../src/lib/scanner";
assert.ok(process.env.DATABASE_SCHEMA?.startsWith("arena_qa_"));
const sql = db();
assert.equal((await sql`SELECT count(*)::int n FROM submissions`)[0].n, 0);
const original = globalThis.fetch;
const keys = Array.from({ length: 4 }, () => randomUUID());
const ids = Array.from({ length: 204 }, () => randomUUID());
const runs = new Map<string, { urls: string[]; token: string }>();
const sizes: number[] = [];
let mode = "normal",
  quota = 0,
  transient = 0,
  posts = 0,
  activeMax = 0,
  pages = 0;
const json = (data: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(data), { status }));
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith("https://api.apify.com/")) return original(input, init);
  const token = (init?.headers as any).Authorization;
  if (url.includes("/actors/")) {
    posts++;
    const body = JSON.parse(String(init?.body));
    assert.ok(body.startUrls.length <= 50);
    assert.equal(body.resultsLimit, body.startUrls.length);
    if (mode === "uncertain") throw new Error("Simulated lost POST response");
    if (mode === "throttle")
      return json({ error: { type: "rate-limit-exceeded" } }, 429);
    if (token === "Bearer batch-key-0" && !quota++) {
      return json({ error: { type: "monthly-usage-limit-too-low" } }, 402);
    }
    assert.ok(
      ![...runs.values()].some((r) => r.token === token),
      "one active batch per key",
    );
    const id = randomUUID();
    sizes.push(body.startUrls.length);
    runs.set(id, { urls: body.startUrls.map((u: any) => u.url), token });
    activeMax = Math.max(activeMax, runs.size);
    return json({ data: { id, defaultDatasetId: id } });
  }
  if (url.includes("/actor-runs/")) {
    if (!transient++) return json({ error: { type: "temporary-error" } }, 500);
    const id = url.split("/").pop();
    return json({
      data: {
        id,
        status: "SUCCEEDED",
        defaultDatasetId: id,
        usageTotalUsd: 0.1,
      },
    });
  }
  const id = url.split("/datasets/")[1].split("/")[0];
  const run = runs.get(id)!;
  const offset = Number(new URL(url).searchParams.get("offset"));
  pages++;
  if (offset) {
    runs.delete(id);
    return json([]);
  }
  const items = run.urls
    .filter((u) => !u.endsWith(ids[203]))
    .map((link) => {
      const index = ids.findIndex((id) => link.endsWith(id));
      return {
        postId: "batch-" + ids[index],
        url: link,
        facebookUrl: link,
        text: index === 202 ? "no hashtags" : "#SerenaRiverside #KickoffSerena",
        reactionLikeCount: index + 10,
        likes: index + 20,
        comments: 5,
        shares: 2,
        media: [{ thumbnail: "https://example.com/image.jpg" }],
      };
    })
    .reverse();
  // Exercise a full dataset page followed by the final empty page.
  if (mode === "normal" && pages === 1) {
    while (items.length < 1000)
      items.push({
        postId: "unrelated",
        url: "https://www.facebook.com/test/posts/unrelated",
      } as any);
  } else runs.delete(id);
  return json(items);
};
async function finish(id: string) {
  for (let i = 0; i < 12; i++) {
    await tick();
    if (
      (await sql`SELECT status FROM scans WHERE id=${id}`)[0].status !==
      "running"
    )
      return;
  }
  assert.fail("scan did not finish");
}
try {
  await sql.transaction(
    keys.map(
      (id, i) =>
        sql`INSERT INTO api_keys(id,label,secret,fingerprint,suffix,last_used_at) VALUES(${id},${"BATCH " + i},${encrypt("batch-key-" + i)},${digest("batch-key-" + i)},'test',${new Date(2020, 0, i + 1).toISOString()})`,
    ),
  );
  await sql.transaction(
    ids.map(
      (id, i) =>
        sql`INSERT INTO submissions(id,name,phone,team,facebook_url) VALUES(${id},${"TEST " + i},'','TEST',${"https://www.facebook.com/test/posts/" + id})`,
    ),
  );
  const scan = await startScan();
  await assert.rejects(startScan());
  await finish(scan.id);
  const rows = await sql`SELECT * FROM submissions`;
  assert.equal(rows.filter((r) => r.status === "valid").length, 202);
  assert.equal(rows.filter((r) => r.status === "invalid").length, 1);
  assert.equal(rows.filter((r) => r.status === "error").length, 1);
  for (const row of rows.filter((r) => r.status === "valid"))
    assert.equal(
      row.likes,
      ids.indexOf(row.id) + 10,
      "shuffled dataset mapped to correct submission",
    );
  assert.ok(sizes.includes(50));
  assert.equal(
    sizes.reduce((a, b) => a + b, 0),
    204,
  );
  assert.ok(activeMax >= 2 && activeMax <= 4);
  assert.equal(
    (
      await sql`SELECT count(*)::int n FROM api_logs WHERE operation='run-completed'`
    )[0].n,
    sizes.length,
    "one cost record per batch",
  );
  assert.equal((await sql`SELECT count(*)::int n FROM snapshots`)[0].n, 203);
  const before = posts;
  const selected = await startScan(ids.slice(0, 3));
  await finish(selected.id);
  assert.equal(posts - before, 1, "three selected posts share one run");
  const idle = posts;
  await tick();
  assert.equal(posts, idle, "no automatic scan");
  // 1,000 queued submissions, no paid calls: verify a single durable queue.
  const extra = Array.from({ length: 796 }, () => randomUUID());
  await sql`INSERT INTO submissions(id,name,phone,team,facebook_url) SELECT id,'LOAD TEST','','TEST','https://www.facebook.com/test/posts/'||id::text FROM unnest(${extra}::uuid[]) id`;
  const large = await startScan();
  assert.equal(
    (await sql`SELECT count(*)::int n FROM jobs WHERE scan_id=${large.id}`)[0]
      .n,
    1000,
  );
  await sql`UPDATE jobs SET state='failed' WHERE scan_id=${large.id}`;
  await tick();
  assert.equal(posts, idle);
  // Definite 429 may retry the same key after cooldown; ambiguous POST may not.
  await sql`UPDATE api_keys SET enabled=(id=${keys[1]}::uuid),health='healthy',cooldown_until=NULL`;
  mode = "throttle";
  const throttled = await startScan(ids.slice(0, 3));
  await tick();
  assert.equal(
    (
      await sql`SELECT count(*)::int n FROM jobs WHERE scan_id=${throttled.id} AND state='queued'`
    )[0].n,
    3,
  );
  mode = "normal";
  await sql`UPDATE api_keys SET cooldown_until=NULL`;
  await finish(throttled.id);
  mode = "uncertain";
  const unsure = await startScan(ids.slice(0, 3));
  const previous = posts;
  await tick();
  assert.equal(
    (
      await sql`SELECT count(*)::int n FROM jobs WHERE scan_id=${unsure.id} AND state='uncertain'`
    )[0].n,
    3,
  );
  await tick();
  assert.equal(posts, previous + 1);
  await assert.rejects(startScan(), /chưa xác định/);
  console.log(
    JSON.stringify({
      passed: true,
      batchSizes: sizes,
      activeMax,
      checks: [
        "50 URL batches",
        "204 posts matched out of order",
        "quota failover",
        "500 retry without restart",
        "paginated dataset",
        "partial success",
        "one cost per run",
        "three posts one run",
        "1000 durable queued jobs",
        "429 cooldown",
        "uncertain POST no duplicate",
        "manual only",
      ],
    }),
  );
} finally {
  globalThis.fetch = original;
}
