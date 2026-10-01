import { randomUUID } from "node:crypto";
import { db } from "./db";
import { decrypt, webhookSignature } from "./security";
import { checkPost, matchesPost } from "./rules";
type Row = Record<string, any>;
export const SCAN_BATCH_SIZE = 50;
const MAX_ACTIVE_RUNS = 4;
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
async function call(
  key: Row,
  job: Row,
  path: string,
  method = "GET",
  body?: unknown,
) {
  const sql = db(),
    start = Date.now();
  let status = 0;
  try {
    const r = await fetch(`https://api.apify.com/v2/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${decrypt(key.secret)}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(18000),
      cache: "no-store",
    });
    status = r.status;
    const data = await r.json();
    if (!r.ok)
      throw new ApiError(status, String(data.error?.type || "api-error"));
    await sql`INSERT INTO api_logs(key_id,job_id,operation,http_status,outcome,duration_ms) VALUES(${key.id},${job.id},${method + " " + path.split("?")[0]},${status},'success',${Date.now() - start})`;
    await sql`UPDATE api_keys SET health='healthy',last_used_at=now() WHERE id=${key.id}`;
    return data;
  } catch (e) {
    const code = e instanceof ApiError ? e.code : "network-timeout";
    await sql`INSERT INTO api_logs(key_id,job_id,operation,http_status,outcome,message,duration_ms) VALUES(${key.id},${job.id},${method + " " + path.split("?")[0]},${status},'error',${code},${Date.now() - start})`;
    throw e;
  }
}
export async function startScan(submissionIds?: string[]) {
  const sql = db();
  const active = await sql`SELECT * FROM scans WHERE status='running'`;
  if (active.length)
    throw new Error("Cần chờ lượt quét hiện tại hoàn tất trước khi quét tiếp");
  const uncertain =
    await sql`SELECT id FROM jobs WHERE state='uncertain' LIMIT 1`;
  if (uncertain.length)
    throw new Error(
      "Cần kiểm tra lượt chạy chưa xác định trong Cài đặt → Nhật ký API trước khi quét lại",
    );
  const keys =
    await sql`SELECT id FROM api_keys WHERE enabled AND health NOT IN ('exhausted','invalid') AND (cooldown_until IS NULL OR cooldown_until<now())`;
  if (!keys.length)
    throw new Error("Cần ít nhất một Apify key đang bật và khả dụng");
  const chosen = submissionIds ? [...new Set(submissionIds)] : null;
  if (chosen && !chosen.length)
    throw new Error("Cần chọn ít nhất một bài để quét");
  const count =
    await sql`SELECT count(*)::int n FROM submissions WHERE deleted_at IS NULL AND (${chosen}::uuid[] IS NULL OR id=ANY(${chosen}::uuid[]))`;
  if (!count[0].n) throw new Error("Chưa có bài dự thi để quét");
  if (chosen && count[0].n !== chosen.length)
    throw new Error(
      "Cần tải lại danh sách: một số bài đã bị xóa hoặc không tồn tại",
    );
  const id = randomUUID();
  const result = await sql.transaction([
    sql`LOCK TABLE settings,scans,submissions IN SHARE ROW EXCLUSIVE MODE`,
    sql`INSERT INTO scans(id) SELECT ${id} WHERE (SELECT count(*) FROM submissions WHERE deleted_at IS NULL AND (${chosen}::uuid[] IS NULL OR id=ANY(${chosen}::uuid[])))=${count[0].n} RETURNING id`,
    sql`INSERT INTO jobs(scan_id,submission_id) SELECT ${id},id FROM submissions WHERE deleted_at IS NULL AND (${chosen}::uuid[] IS NULL OR id=ANY(${chosen}::uuid[])) AND EXISTS(SELECT 1 FROM scans WHERE id=${id})`,
    sql`UPDATE settings SET last_scan_at=now() WHERE id=1 AND EXISTS(SELECT 1 FROM scans WHERE id=${id})`,
  ]);
  if (!result[1].length)
    throw new Error("Danh sách bài đã thay đổi. Vui lòng thử lại.");
  return { id, status: "running" };
}

async function savePost(job: Row, post: Row, settings: Row) {
  const sql = db();
  const checked = checkPost(post, settings as any);
  const likes = checked.likes,
    reactions = typeof post.likes === "number" ? post.likes : null;
  const missingMetric =
    settings.metric === "likes" ? likes === null : reactions === null;
  const valid = checked.hashtagOk && checked.timeOk && !missingMetric;
  const reason =
    checked.reason || (missingMetric ? "Thiếu chỉ số dùng để xếp hạng" : null);
  const n = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x)
      ? Math.max(0, Math.floor(x))
      : null;
  await sql.transaction([
    sql`UPDATE submissions SET post_id=${String(post.postId)},post_url=${post.url || null},author=${post.user?.name || null},avatar=${post.user?.profilePic || null},content=${post.text},media=${JSON.stringify(Array.isArray(post.media) ? post.media : [])}::jsonb,posted_at=${checked.postedAt},likes=${n(likes)},reactions=${n(reactions)},comments=${n(post.comments)},shares=${n(post.shares)},hashtag_ok=${checked.hashtagOk},time_ok=${checked.timeOk},status=${valid ? "valid" : "invalid"},reason=${reason},raw=${JSON.stringify(post)}::jsonb,checked_at=now() WHERE id=${job.submission_id} AND deleted_at IS NULL`,
    sql`INSERT INTO snapshots(scan_id,submission_id,likes,reactions,comments,shares) VALUES(${job.scan_id},${job.submission_id},${n(likes)},${n(reactions)},${n(post.comments)},${n(post.shares)}) ON CONFLICT DO NOTHING`,
    sql`UPDATE jobs SET state='done',reason=NULL,updated_at=now() WHERE id=${job.id}`,
  ]);
}

async function failJobs(ids: string[], reason: string, state = "failed") {
  const sql = db();
  await sql.transaction([
    sql`UPDATE jobs SET state=${state},reason=${reason},updated_at=now() WHERE id=ANY(${ids}::uuid[]) AND state NOT IN ('done','failed')`,
    sql`UPDATE submissions SET status='error',reason=${reason} WHERE checked_at IS NULL AND id IN (SELECT submission_id FROM jobs WHERE id=ANY(${ids}::uuid[]) AND state=${state})`,
  ]);
}

// One run can belong to many jobs. Old single-post runs use the same path.
async function processBatch(leader: Row, settings: Row) {
  const sql = db();
  let key: Row | undefined;
  let jobs: Row[];
  if (leader.run_id) {
    [key] = await sql`SELECT * FROM api_keys WHERE id=${leader.key_id}`;
    jobs =
      await sql`SELECT j.*,s.facebook_url FROM jobs j JOIN submissions s ON s.id=j.submission_id WHERE j.scan_id=${leader.scan_id} AND j.run_id=${leader.run_id} AND j.state='running' ORDER BY j.id`;
  } else {
    [key] =
      await sql`SELECT * FROM api_keys WHERE enabled AND health NOT IN ('exhausted','invalid') AND (cooldown_until IS NULL OR cooldown_until<now()) AND NOT(id=ANY(${leader.tried_keys}::uuid[])) AND NOT EXISTS(SELECT 1 FROM jobs j WHERE j.key_id=api_keys.id AND j.state IN ('running','starting','uncertain')) ORDER BY last_used_at ASC NULLS FIRST,id LIMIT 1`;
    if (!key) {
      const [available] =
        await sql`SELECT count(*)::int n FROM api_keys WHERE enabled AND health NOT IN ('exhausted','invalid') AND NOT(id=ANY(${leader.tried_keys}::uuid[])) AND NOT EXISTS(SELECT 1 FROM jobs j WHERE j.key_id=api_keys.id AND j.state='uncertain')`;
      if (!available.n) {
        const blocked =
          await sql`SELECT j.id FROM jobs j WHERE j.scan_id=${leader.scan_id} AND j.state='queued' AND NOT EXISTS(SELECT 1 FROM api_keys k WHERE k.enabled AND k.health NOT IN ('exhausted','invalid') AND NOT(k.id=ANY(j.tried_keys)) AND NOT EXISTS(SELECT 1 FROM jobs u WHERE u.key_id=k.id AND u.state='uncertain'))`;
        if (blocked.length)
          await failJobs(
            blocked.map((j) => j.id),
            "Không còn API key khả dụng; kiểm tra số dư và run chưa xác định",
          );
      }
      return false;
    }
    jobs =
      await sql`SELECT j.*,s.facebook_url FROM jobs j JOIN submissions s ON s.id=j.submission_id WHERE j.scan_id=${leader.scan_id} AND j.state='queued' AND NOT(${key.id}::uuid=ANY(j.tried_keys)) ORDER BY j.updated_at,j.id LIMIT ${SCAN_BATCH_SIZE}`;
  }
  if (!key || !jobs.length) return false;
  const ids = jobs.map((j) => j.id);
  const logJob = jobs[0];
  try {
    if (!leader.run_id) {
      await sql`UPDATE jobs SET state='starting',key_id=${key.id},attempts=attempts+1,tried_keys=array_append(tried_keys,${key.id}::uuid),updated_at=now() WHERE id=ANY(${ids}::uuid[])`;
      const hooks = process.env.APP_URL
        ? [
            {
              eventTypes: [
                "ACTOR.RUN.SUCCEEDED",
                "ACTOR.RUN.FAILED",
                "ACTOR.RUN.TIMED_OUT",
                "ACTOR.RUN.ABORTED",
              ],
              requestUrl: `${process.env.APP_URL}/api/apify-webhook?job=${logJob.id}&signature=${webhookSignature(logJob.id)}`,
            },
          ]
        : null;
      const path =
        "actors/KoJrdxJCTtpon81KY/runs" +
        (hooks
          ? "?webhooks=" +
            encodeURIComponent(
              Buffer.from(JSON.stringify(hooks)).toString("base64"),
            )
          : "");
      const result = await call(key, logJob, path, "POST", {
        startUrls: jobs.map((j) => ({ url: j.facebook_url })),
        resultsLimit: jobs.length,
        captionText: false,
      });
      if (!result.data?.id || !result.data?.defaultDatasetId)
        throw new Error("Missing run metadata");
      await sql.transaction([
        sql`UPDATE jobs SET state='running',run_id=${result.data.id},dataset_id=${result.data.defaultDatasetId},updated_at=now() WHERE id=ANY(${ids}::uuid[])`,
        sql`INSERT INTO api_logs(key_id,job_id,operation,outcome,message) VALUES(${key.id},${logJob.id},'batch-started','success',${JSON.stringify({ runId: result.data.id, posts: jobs.length })})`,
      ]);
      return true;
    }
    const { data: run } = await call(
      key,
      logJob,
      `actor-runs/${leader.run_id}`,
    );
    if (!["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(run.status))
      return true;
    const items: Row[] = [];
    // Paginate instead of truncating the dataset to the old two-item limit.
    for (let offset = 0; ; offset += 1000) {
      const page = await call(
        key,
        logJob,
        `datasets/${run.defaultDatasetId || leader.dataset_id}/items?clean=true&limit=1000&offset=${offset}`,
      );
      if (!Array.isArray(page)) throw new Error("Invalid dataset response");
      items.push(...page);
      if (page.length < 1000) break;
      if (offset >= 4000) throw new Error("Unexpectedly large post dataset");
    }
    // Bound database fan-out; one bad/missing post does not discard its batch.
    for (let offset = 0; offset < jobs.length; offset += 5) {
      const outcomes = await Promise.allSettled(
        jobs.slice(offset, offset + 5).map(async (job) => {
          const matches = items.filter((item) =>
            matchesPost(job.facebook_url, item),
          );
          const post = matches[0];
          if (
            !post?.postId ||
            typeof post.text !== "string" ||
            matches.some((p) => String(p.postId) !== String(post.postId))
          ) {
            await failJobs(
              [job.id],
              `Không có kết quả khớp duy nhất với link bài viết (Apify ${run.status}); có thể chọn riêng bài này để quét lại`,
            );
            return;
          }
          try {
            await savePost(job, post, settings);
          } catch (error) {
            if (String((error as any).code) !== "23505") throw error;
            await sql.transaction([
              sql`UPDATE jobs SET state='done',reason='Trùng bài Facebook',updated_at=now() WHERE id=${job.id}`,
              sql`UPDATE submissions SET status='invalid',reason='Bài Facebook đã được đăng ký',checked_at=now() WHERE id=${job.submission_id}`,
            ]);
          }
        }),
      );
      const failed = outcomes.find((o) => o.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    }
    await sql`INSERT INTO api_logs(key_id,job_id,operation,outcome,cost_usd,message) SELECT ${key.id},${logJob.id},'run-completed','success',${run.usageTotalUsd ?? null},${leader.run_id} WHERE NOT EXISTS(SELECT 1 FROM api_logs WHERE operation='run-completed' AND message=${leader.run_id})`;
    return true;
  } catch (e) {
    const error = e as ApiError;
    const budget =
      error.status === 402 ||
      /usage-limit|not-enough-usage|insufficient-amount|payment-required/.test(
        error.code || "",
      );
    const invalid =
      error.status === 401 ||
      /invalid-token|user-or-token-not-found/.test(error.code || "");
    const throttle = error.status === 429;
    if (budget || invalid)
      await sql`UPDATE api_keys SET health=${budget ? "exhausted" : "invalid"} WHERE id=${key.id}`;
    if (throttle)
      await sql`UPDATE api_keys SET health='rate_limited',cooldown_until=now()+interval '60 seconds' WHERE id=${key.id}`;
    if (!leader.run_id && (budget || invalid || throttle)) {
      await sql`UPDATE jobs SET state='queued',key_id=NULL,tried_keys=CASE WHEN ${throttle} THEN array_remove(tried_keys,${key.id}::uuid) ELSE tried_keys END,reason=${error.code},updated_at=now() WHERE id=ANY(${ids}::uuid[])`;
      return false;
    }
    // A GET or local write can be retried against the same run, without charging for another run.
    if (
      leader.run_id &&
      !budget &&
      !invalid &&
      (throttle || error.status >= 500 || !(error instanceof ApiError))
    )
      return true;
    const uncertain =
      !leader.run_id && (!(error instanceof ApiError) || error.status >= 500);
    await failJobs(
      ids,
      error.code ||
        "Không xác định kết quả API; kiểm tra run trên Apify trước khi quét lại",
      uncertain ? "uncertain" : "failed",
    );
    return false;
  }
}

export async function tick() {
  const sql = db(),
    owner = randomUUID(),
    started = Date.now();
  const lock =
    await sql`INSERT INTO locks(id,expires_at,owner) VALUES('scanner',now()+interval '110 seconds',${owner}) ON CONFLICT(id) DO UPDATE SET expires_at=EXCLUDED.expires_at,owner=EXCLUDED.owner WHERE locks.expires_at<now() RETURNING id`;
  if (!lock.length) return false;
  try {
    const [settings] = await sql`SELECT * FROM settings WHERE id=1`;
    const [scan] = await sql`SELECT * FROM scans WHERE status='running'`;
    if (!scan) return;
    const stale =
      await sql`SELECT id FROM jobs WHERE scan_id=${scan.id} AND ((state='starting' AND updated_at<now()-interval '110 seconds') OR (state='running' AND updated_at<now()-interval '45 minutes'))`;
    if (stale.length)
      await failJobs(
        stale.map((j) => j.id),
        "Quá thời gian theo dõi; kiểm tra Apify trước khi quét lại",
        "uncertain",
      );
    const running =
      await sql`SELECT DISTINCT ON(run_id) * FROM jobs WHERE scan_id=${scan.id} AND state='running' ORDER BY run_id,id LIMIT ${MAX_ACTIVE_RUNS}`;
    await Promise.allSettled(running.map((j) => processBatch(j, settings)));
    // Reserve a key before launching the next batch. Never exceed four remote runs.
    for (let i = 0; i < MAX_ACTIVE_RUNS && Date.now() - started < 70000; i++) {
      const [active] =
        await sql`SELECT count(DISTINCT run_id)::int n FROM jobs WHERE state='running'`;
      if (active.n >= MAX_ACTIVE_RUNS) break;
      const [leader] =
        await sql`SELECT * FROM jobs WHERE scan_id=${scan.id} AND state='queued' ORDER BY updated_at,id LIMIT 1`;
      if (!leader) break;
      await processBatch(leader, settings);
    }
    const [counts] =
      await sql`SELECT count(*) FILTER(WHERE state IN ('queued','running','starting'))::int active,count(*) FILTER(WHERE state IN ('failed','uncertain'))::int errors FROM jobs WHERE scan_id=${scan.id}`;
    if (!counts.active)
      await sql`UPDATE scans SET status=${counts.errors ? "partial" : "completed"},completed_at=now() WHERE id=${scan.id}`;
  } finally {
    await sql`DELETE FROM locks WHERE id='scanner' AND owner=${owner}`;
  }
}
