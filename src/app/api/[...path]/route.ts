import { DISTRIBUTORS } from "@/lib/distributors";
import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  authenticated,
  digest,
  encrypt,
  equal,
  login,
  rateLimit,
  webhookSignature,
} from "@/lib/security";
import { facebookUrl, rank, checkPost } from "@/lib/rules";
import { startScan, tick } from "@/lib/scanner";
import { parseSubmissionWorkbook } from "@/lib/import-submissions";
import { randomInt, randomUUID } from "node:crypto";
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path.join("/");
    const sql = db();
    const ip =
      req.headers.get("x-vercel-forwarded-for") ||
      req.headers.get("x-forwarded-for") ||
      "local";
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      if (origin && origin !== req.nextUrl.origin)
        return json({ error: "Origin không hợp lệ" }, 403);
    }
    if (path === "login" && req.method === "POST") {
      if (!(await rateLimit("login:" + ip, 8, 900)))
        return json({ error: "Thử lại sau 15 phút" }, 429);
      const { password } = await req.json();
      if (
        !process.env.ADMIN_PASSWORD ||
        typeof password !== "string" ||
        !equal(password, process.env.ADMIN_PASSWORD)
      )
        return json({ error: "Mật khẩu không đúng" }, 401);
      await login();
      return json({ ok: true });
    }
    if (path === "logout" && req.method === "POST") {
      (await cookies()).delete("serena_admin");
      return json({ ok: true });
    }
    if (path === "public" && req.method === "GET") {
      const [s] =
        await sql`SELECT starts_at,ends_at,time_filter_enabled,hashtags,metric,published_at,display_mode,display_started_at,display_rank FROM settings WHERE id=1`;
      const visible = s.display_mode !== "waiting" && !!s.display_started_at;
      const entries = visible
        ? await sql`SELECT id,name,team,author,avatar,content,media,facebook_url,post_url,likes,reactions,comments,shares,posted_at,created_at,count(*) OVER()::int AS total_count FROM submissions WHERE checked_at IS NOT NULL AND hashtag_ok IS TRUE AND time_ok IS TRUE AND reactions IS NOT NULL AND deleted_at IS NULL ORDER BY COALESCE(reactions,0) DESC,COALESCE(posted_at,created_at),id LIMIT 5`
        : [];
      return json({
        settings: { ...s, metric: "reactions", published: null },
        leaderboard: visible
          ? rank(entries as any, "reactions").slice(0, 5)
          : [],
        server_time: new Date().toISOString(),
        valid_count: entries[0]?.total_count ?? 0,
      });
    }
    if (path === "wheel/public" && req.method === "GET") {
      const [state] =
        await sql`SELECT ws.*,s.name AS segment_name,e.name AS winner_name,e.team AS winner_team FROM wheel_state ws LEFT JOIN wheel_segments s ON s.id=ws.segment_id LEFT JOIN wheel_entries e ON e.id=ws.winner_entry_id WHERE ws.id=1`;
      const entries = state?.segment_id
        ? await sql`SELECT id,name,team FROM wheel_entries WHERE segment_id=${state.segment_id} ORDER BY created_at,id`
        : [];
      const winners = state?.segment_id
        ? await sql`SELECT w.prize_rank,w.selected_at,e.id,e.name,e.team FROM wheel_winners w JOIN wheel_entries e ON e.id=w.entry_id WHERE w.segment_id=${state.segment_id} ORDER BY w.prize_rank DESC`
        : [];
      return json({
        state: state || { phase: "waiting" },
        entries,
        winners,
        server_time: new Date().toISOString(),
      });
    }
    if (path === "submit" && req.method === "POST") {
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          team: z.enum(DISTRIBUTORS),
          facebookUrl: z.string().max(2000),
          consent: z.literal(true),
          website: z.string().optional(),
        })
        .parse(await req.json());
      if (data.website) return json({ error: "Yêu cầu không hợp lệ" }, 400);
      const url = facebookUrl(data.facebookUrl);
      const [s] = await sql`SELECT * FROM settings WHERE id=1`;
      if (
        s.time_filter_enabled &&
        s.starts_at &&
        Date.now() < Date.parse(s.starts_at)
      )
        return json({ error: "Chưa đến thời gian nhận bài" }, 409);
      if (
        s.time_filter_enabled &&
        s.ends_at &&
        Date.now() > Date.parse(s.ends_at)
      )
        return json({ error: "Cuộc thi đã đóng nhận bài" }, 409);
      const inserted = await sql.transaction([
        sql`LOCK TABLE settings,submissions IN SHARE ROW EXCLUSIVE MODE`,
        sql`INSERT INTO submissions(name,phone,team,facebook_url) SELECT ${data.name},${""},${data.team},${url} FROM settings WHERE id=1 AND (NOT time_filter_enabled OR ((starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now()))) ON CONFLICT (facebook_url) WHERE deleted_at IS NULL DO NOTHING RETURNING id`,
        sql`SELECT EXISTS(SELECT 1 FROM submissions WHERE facebook_url=${url} AND deleted_at IS NULL) AS registered`,
      ]);
      const [r] = inserted[1];
      if (!r)
        return json(
          {
            error: inserted[2][0].registered
              ? "Bài viết này đã được đăng ký. Bạn không cần gửi lại; nếu cần sửa thông tin, vui lòng liên hệ ban tổ chức."
              : "Cuộc thi đã đóng nhận bài",
          },
          409,
        );
      return json({ id: r.id }, 201);
    }
    if (path === "apify-webhook" && req.method === "POST") {
      const jobId = z.uuid().parse(req.nextUrl.searchParams.get("job"));
      if (
        !equal(
          req.nextUrl.searchParams.get("signature") || "",
          webhookSignature(jobId),
        )
      )
        return json({ error: "Unauthorized" }, 401);
      const [job] =
        await sql`SELECT j.run_id,j.state,s.status FROM jobs j JOIN scans s ON s.id=j.scan_id WHERE j.id=${jobId}`;
      if (!job || job.status !== "running") return json({ ok: true });
      if (!job.run_id)
        return json({ error: "Run metadata pending; retry" }, 503);
      const processed = await tick();
      return processed === false
        ? json({ error: "Worker busy; retry" }, 503)
        : json({ ok: true });
    }
    if (!(await authenticated()))
      return json({ error: "Vui lòng đăng nhập quản trị" }, 401);
    if (path === "admin" && req.method === "GET") {
      const results = await Promise.all([
        sql`SELECT * FROM settings WHERE id=1`,
        sql`SELECT id,name,phone,team,facebook_url,post_id,post_url,author,avatar,content,media,posted_at,likes,reactions,comments,shares,hashtag_ok,time_ok,CASE WHEN checked_at IS NOT NULL AND hashtag_ok IS TRUE AND time_ok IS TRUE AND reactions IS NOT NULL THEN 'valid' ELSE status END AS status,CASE WHEN checked_at IS NOT NULL AND hashtag_ok IS TRUE AND time_ok IS TRUE AND reactions IS NOT NULL THEN NULL ELSE reason END AS reason,checked_at,created_at FROM submissions WHERE deleted_at IS NULL ORDER BY created_at DESC`,
        sql`SELECT id,label,suffix,enabled,health,cooldown_until,last_used_at FROM api_keys ORDER BY created_at`,
        sql`SELECT l.*,k.label FROM api_logs l LEFT JOIN api_keys k ON k.id=l.key_id ORDER BY l.id DESC LIMIT 150`,
        sql`SELECT s.*,count(j.id)::int total,count(j.id) FILTER(WHERE j.state='done')::int done,count(j.id) FILTER(WHERE j.state IN ('failed','uncertain'))::int errors FROM scans s LEFT JOIN jobs j ON j.scan_id=s.id GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`,
        sql`SELECT s.id,s.completed_at,sum(p.likes)::int likes,sum(p.reactions)::int reactions,sum(p.comments)::int comments,sum(p.shares)::int shares FROM scans s JOIN LATERAL (SELECT DISTINCT ON (snap.submission_id) snap.likes,snap.reactions,snap.comments,snap.shares FROM snapshots snap JOIN submissions sub ON sub.id=snap.submission_id WHERE sub.deleted_at IS NULL AND snap.created_at<=s.completed_at ORDER BY snap.submission_id,snap.created_at DESC,snap.id DESC) p ON true WHERE s.status='completed' GROUP BY s.id ORDER BY s.completed_at DESC LIMIT 20`,
        sql`SELECT j.*,s.name FROM jobs j JOIN submissions s ON s.id=j.submission_id WHERE j.scan_id=(SELECT id FROM scans ORDER BY created_at DESC LIMIT 1) ORDER BY j.updated_at DESC`,
        sql`SELECT s.*,count(e.id)::int AS entry_count FROM wheel_segments s LEFT JOIN wheel_entries e ON e.segment_id=s.id GROUP BY s.id ORDER BY s.created_at DESC`,
        sql`SELECT ws.*,s.name AS segment_name,e.name AS winner_name,e.team AS winner_team FROM wheel_state ws LEFT JOIN wheel_segments s ON s.id=ws.segment_id LEFT JOIN wheel_entries e ON e.id=ws.winner_entry_id WHERE ws.id=1`,
        sql`SELECT w.*,e.name,e.team FROM wheel_winners w JOIN wheel_entries e ON e.id=w.entry_id ORDER BY w.selected_at DESC`,
      ]);
      return json({
        settings: results[0][0],
        submissions: results[1],
        keys: results[2],
        logs: results[3],
        scans: results[4],
        history: results[5].reverse(),
        jobs: results[6],
        wheel: {
          segments: results[7],
          state: results[8][0],
          winners: results[9],
        },
      });
    }
    if (path.startsWith("raw/") && req.method === "GET") {
      const id = z.uuid().parse(path.split("/")[1]);
      const [r] = await sql`SELECT raw FROM submissions WHERE id=${id}`;
      return json(r?.raw || {});
    }
    if (req.method !== "POST") return json({ error: "Không tìm thấy" }, 404);
    if (path === "tick") {
      await tick();
      const [progress] =
        await sql`SELECT s.id,s.status,count(j.id) FILTER(WHERE j.state='queued')::int queued,count(j.id) FILTER(WHERE j.state='starting')::int starting,count(j.id) FILTER(WHERE j.state='running')::int running,count(j.id) FILTER(WHERE j.state='done')::int done,count(j.id) FILTER(WHERE j.state IN ('failed','uncertain'))::int errors,count(DISTINCT j.run_id) FILTER(WHERE j.state='running')::int active_batches FROM scans s LEFT JOIN jobs j ON j.scan_id=s.id WHERE s.id=(SELECT id FROM scans ORDER BY created_at DESC LIMIT 1) GROUP BY s.id`;
      return json({ ok: true, progress });
    }
    if (path === "scan") {
      const selection = z
        .object({ ids: z.array(z.uuid()).min(1).max(5000).optional() })
        .parse(await req.json());
      const scan = await startScan(selection.ids);
      after(async () => {
        await tick();
      });
      return json(scan);
    }
    if (path === "submissions/import") {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        return json({ error: "Chưa chọn file Excel" }, 400);
      if (!/\.xlsx$/i.test(file.name))
        return json({ error: "Vui lòng dùng file Excel định dạng .xlsx" }, 400);
      if (file.size > 4 * 1024 * 1024)
        return json({ error: "File Excel vượt quá giới hạn 4 MB" }, 400);
      const parsed = await parseSubmissionWorkbook(
        Buffer.from(await file.arrayBuffer()),
      );
      const existing = parsed.rows.length
        ? await sql`SELECT facebook_url FROM submissions WHERE deleted_at IS NULL AND facebook_url=ANY(${parsed.rows.map((row) => row.facebookUrl)}::text[])`
        : [];
      const existingUrls = new Set(existing.map((row) => row.facebook_url));
      const candidates = parsed.rows.filter(
        (row) => !existingUrls.has(row.facebookUrl),
      );
      const inserted = candidates.length
        ? await sql`INSERT INTO submissions(name,phone,team,facebook_url,status) SELECT x.name,'',x.team,x.url,'pending' FROM unnest(${candidates.map((row) => row.name)}::text[],${candidates.map((row) => row.team)}::text[],${candidates.map((row) => row.facebookUrl)}::text[]) AS x(name,team,url) ON CONFLICT (facebook_url) WHERE deleted_at IS NULL DO NOTHING RETURNING id,facebook_url`
        : [];
      const insertedUrls = new Set(inserted.map((row) => row.facebook_url));
      const duplicates = parsed.rows
        .filter((row) => !insertedUrls.has(row.facebookUrl))
        .map((row) => ({
          row: row.row,
          reason: "Link đã tồn tại trong database",
        }));
      return json({
        ok: true,
        sheet: parsed.sheet,
        total: parsed.rows.length + parsed.issues.length,
        inserted: inserted.length,
        duplicates: duplicates.length,
        invalid: parsed.issues.length,
        issues: [...parsed.issues, ...duplicates].slice(0, 100),
      });
    }
    if (path === "wheel/import") {
      const form = await req.formData();
      const file = form.get("file"),
        segmentName = String(form.get("segmentName") || "").trim();
      const requestedSegment = String(form.get("segmentId") || "").trim();
      if (!(file instanceof File))
        return json({ error: "Chưa chọn file Excel" }, 400);
      if (!/\.xlsx$/i.test(file.name) || file.size > 4 * 1024 * 1024)
        return json({ error: "Vui lòng dùng file .xlsx không quá 4 MB" }, 400);
      if (
        !requestedSegment &&
        (segmentName.length < 2 || segmentName.length > 100)
      )
        return json({ error: "Tên segment cần từ 2 đến 100 ký tự" }, 400);
      const parsed = await parseSubmissionWorkbook(
        Buffer.from(await file.arrayBuffer()),
      );
      const segmentId = requestedSegment
        ? z.uuid().parse(requestedSegment)
        : randomUUID();
      const transaction: any[] = [];
      if (!requestedSegment)
        transaction.push(
          sql`INSERT INTO wheel_segments(id,name) VALUES(${segmentId},${segmentName})`,
        );
      else
        transaction.push(
          sql`SELECT id FROM wheel_segments WHERE id=${segmentId} FOR UPDATE`,
        );
      transaction.push(
        sql`INSERT INTO wheel_entries(segment_id,name,team,facebook_url) SELECT ${segmentId},x.name,x.team,x.url FROM unnest(${parsed.rows.map((r) => r.name)}::text[],${parsed.rows.map((r) => r.team)}::text[],${parsed.rows.map((r) => r.facebookUrl)}::text[]) x(name,team,url) ON CONFLICT(segment_id,facebook_url) DO NOTHING RETURNING id,facebook_url`,
      );
      const result = await sql.transaction(transaction);
      if (requestedSegment && !result[0].length)
        return json({ error: "Segment không tồn tại" }, 404);
      const inserted = result[1];
      if (!requestedSegment)
        await sql`UPDATE wheel_state SET segment_id=COALESCE(segment_id,${segmentId}),updated_at=now() WHERE id=1`;
      return json({
        ok: true,
        segmentId,
        sheet: parsed.sheet,
        total: parsed.rows.length + parsed.issues.length,
        inserted: inserted.length,
        duplicates: parsed.rows.length - inserted.length,
        invalid: parsed.issues.length,
        issues: parsed.issues.slice(0, 100),
      });
    }
    if (path === "wheel/from-submissions") {
      const data = z
        .object({ name: z.string().trim().min(2).max(100) })
        .parse(await req.json());
      const segmentId = randomUUID();
      const result = await sql.transaction([
        sql`INSERT INTO wheel_segments(id,name) VALUES(${segmentId},${data.name})`,
        sql`INSERT INTO wheel_entries(segment_id,name,team,facebook_url) SELECT ${segmentId},name,team,facebook_url FROM submissions WHERE deleted_at IS NULL ON CONFLICT(segment_id,facebook_url) DO NOTHING RETURNING id`,
      ]);
      await sql`UPDATE wheel_state SET segment_id=COALESCE(segment_id,${segmentId}),updated_at=now() WHERE id=1`;
      return json({ ok: true, segmentId, inserted: result[1].length });
    }
    if (path === "wheel/select") {
      const { segmentId } = z
        .object({ segmentId: z.uuid() })
        .parse(await req.json());
      const [segment] =
        await sql`SELECT id FROM wheel_segments WHERE id=${segmentId}`;
      if (!segment) return json({ error: "Segment không tồn tại" }, 404);
      await sql`UPDATE wheel_state SET segment_id=${segmentId},phase='waiting',prize_rank=NULL,winner_entry_id=NULL,spin_nonce=NULL,started_at=NULL,updated_at=now() WHERE id=1`;
      return json({ ok: true });
    }
    if (path === "wheel/spin") {
      const { rank: prizeRank } = z
        .object({ rank: z.number().int().min(1).max(3) })
        .parse(await req.json());
      const [state] =
        await sql`SELECT * FROM wheel_state WHERE id=1 FOR UPDATE`;
      if (!state?.segment_id)
        return json({ error: "Hãy chọn segment trước khi quay" }, 409);
      const [already] =
        await sql`SELECT entry_id FROM wheel_winners WHERE segment_id=${state.segment_id} AND prize_rank=${prizeRank}`;
      const eligible =
        await sql`SELECT e.id,e.name,e.team FROM wheel_entries e WHERE e.segment_id=${state.segment_id} AND (${already?.entry_id ?? null}::uuid IS NULL OR e.id<>${already?.entry_id ?? null}::uuid) AND NOT EXISTS(SELECT 1 FROM wheel_winners w WHERE w.segment_id=e.segment_id AND w.entry_id=e.id AND w.prize_rank<>${prizeRank}) AND NOT EXISTS(SELECT 1 FROM wheel_redraw_exclusions x WHERE x.segment_id=e.segment_id AND x.entry_id=e.id) ORDER BY e.created_at,e.id`;
      if (!eligible.length)
        return json({ error: "Segment không còn người đủ điều kiện" }, 409);
      const winner = eligible[randomInt(eligible.length)],
        nonce = randomUUID();
      const statements: any[] = [];
      if (already)
        statements.push(
          sql`INSERT INTO wheel_redraw_exclusions(segment_id,entry_id,prize_rank) VALUES(${state.segment_id},${already.entry_id},${prizeRank}) ON CONFLICT(segment_id,entry_id) DO NOTHING`,
          sql`DELETE FROM wheel_winners WHERE segment_id=${state.segment_id} AND prize_rank=${prizeRank}`,
        );
      statements.push(
        sql`INSERT INTO wheel_winners(segment_id,entry_id,prize_rank) VALUES(${state.segment_id},${winner.id},${prizeRank})`,
        sql`UPDATE wheel_state SET phase='spinning',prize_rank=${prizeRank},winner_entry_id=${winner.id},spin_nonce=${nonce},started_at=now(),updated_at=now() WHERE id=1`,
      );
      await sql.transaction(statements);
      return json({ ok: true, winner, nonce });
    }
    if (path === "wheel/settle") {
      const { nonce } = z.object({ nonce: z.uuid() }).parse(await req.json());
      await sql`UPDATE wheel_state SET phase='result',updated_at=now() WHERE id=1 AND spin_nonce=${nonce}`;
      return json({ ok: true });
    }
    if (path === "wheel/reset") {
      const [state] = await sql`SELECT segment_id FROM wheel_state WHERE id=1`;
      if (state?.segment_id)
        await sql.transaction([
          sql`DELETE FROM wheel_winners WHERE segment_id=${state.segment_id}`,
          sql`DELETE FROM wheel_redraw_exclusions WHERE segment_id=${state.segment_id}`,
          sql`UPDATE wheel_state SET phase='waiting',prize_rank=NULL,winner_entry_id=NULL,spin_nonce=NULL,started_at=NULL,updated_at=now() WHERE id=1`,
        ]);
      return json({ ok: true });
    }
    if (path === "submissions/delete") {
      const { ids } = z
        .object({ ids: z.array(z.uuid()).min(1).max(5000) })
        .parse(await req.json());
      const result = await sql.transaction([
        sql`LOCK TABLE settings,scans,submissions IN SHARE ROW EXCLUSIVE MODE`,
        sql`UPDATE submissions SET deleted_at=now() WHERE id=ANY(${ids}::uuid[]) AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM scans WHERE status='running') AND NOT EXISTS(SELECT 1 FROM jobs WHERE submission_id=ANY(${ids}::uuid[]) AND state='uncertain') RETURNING id`,
      ]);
      if (!result[1].length)
        return json(
          {
            error:
              "Không thể xóa: đang quét, bài không còn tồn tại hoặc có run chưa xác định. Kiểm tra nhật ký API.",
          },
          409,
        );
      return json({ ok: true, deleted: result[1].length });
    }
    if (path === "keys") {
      const data = z
        .object({
          label: z.string().trim().min(1).max(60),
          token: z.string().trim().min(15).max(300),
        })
        .parse(await req.json());
      await sql`INSERT INTO api_keys(label,secret,fingerprint,suffix) VALUES(${data.label},${encrypt(data.token)},${digest(data.token)},${data.token.slice(-4)})`;
      return json({ ok: true });
    }
    if (path === "keys/toggle") {
      const data = z
        .object({ id: z.uuid(), enabled: z.boolean() })
        .parse(await req.json());
      await sql`UPDATE api_keys SET enabled=${data.enabled},health=CASE WHEN ${data.enabled} THEN 'unknown' ELSE health END,cooldown_until=NULL WHERE id=${data.id}`;
      return json({ ok: true });
    }
    if (path === "jobs/acknowledge") {
      const data = z
        .object({ id: z.uuid(), confirmed: z.literal(true) })
        .parse(await req.json());
      await sql`UPDATE jobs SET state='failed',reason='Admin đã kiểm tra Apify và xác nhận có thể quét lại',updated_at=now() WHERE id=${data.id} AND state='uncertain'`;
      return json({ ok: true });
    }
    if (path === "settings") {
      const data = z
        .object({
          starts_at: z.iso.datetime({ offset: true }),
          ends_at: z.iso.datetime({ offset: true }).nullable(),
          metric: z.literal("reactions"),
          time_filter_enabled: z.boolean(),
          hashtags: z
            .array(z.string().regex(/^[\p{L}\p{N}_]+$/u))
            .min(1)
            .max(5),
        })
        .parse(await req.json());
      if (
        data.time_filter_enabled &&
        data.ends_at &&
        Date.parse(data.ends_at) <= Date.parse(data.starts_at)
      )
        throw new Error("Giờ kết thúc phải sau giờ bắt đầu");
      const [state] =
        await sql`SELECT published,EXISTS(SELECT 1 FROM scans WHERE status='running') busy FROM settings WHERE id=1`;
      if (state.busy)
        return json({ error: "Không sửa thể lệ khi đang quét " }, 409);
      const stored =
        await sql`SELECT id,raw,likes,reactions FROM submissions WHERE deleted_at IS NULL AND raw IS NOT NULL AND post_id IS NOT NULL AND status IN ('valid','invalid')`;
      const validations = stored.map((row) => {
        const checked = checkPost(row.raw, data);
        const missing = row.reactions == null;
        return {
          id: row.id,
          hashtag_ok: checked.hashtagOk,
          time_ok: checked.timeOk,
          status:
            checked.hashtagOk && checked.timeOk && !missing
              ? "valid"
              : "invalid",
          reason:
            checked.reason ||
            (missing ? "Thiếu chỉ số dùng để xếp hạng" : null),
        };
      });
      const updated = await sql.transaction([
        sql`LOCK TABLE settings,scans,submissions IN SHARE ROW EXCLUSIVE MODE`,
        sql`WITH changed AS (UPDATE settings SET starts_at=${data.starts_at},ends_at=${data.ends_at},metric=${data.metric},auto_scan=false,time_filter_enabled=${data.time_filter_enabled},hashtags=${data.hashtags} WHERE id=1 AND NOT EXISTS(SELECT 1 FROM scans WHERE status='running') RETURNING id), rechecked AS (UPDATE submissions s SET status=v.status,reason=v.reason,hashtag_ok=v.hashtag_ok,time_ok=v.time_ok FROM jsonb_to_recordset(${JSON.stringify(validations)}::jsonb) AS v(id uuid,status text,reason text,hashtag_ok boolean,time_ok boolean) WHERE s.id=v.id AND s.deleted_at IS NULL AND EXISTS(SELECT 1 FROM changed)) SELECT id FROM changed`,
      ]);
      if (!updated[1].length)
        return json({ error: "Không sửa thể lệ khi đang quét " }, 409);
      return json({ ok: true });
    }
    if (
      (path === "presentation" || path === "publish") &&
      req.method === "POST"
    ) {
      const { mode, rank: position } =
        path === "publish"
          ? { mode: "auto", rank: undefined }
          : z
              .object({
                mode: z.enum(["waiting", "auto", "results"]),
                rank: z.number().int().min(1).max(5).optional(),
              })
              .parse(await req.json());
      await sql`UPDATE settings SET display_mode=${mode},display_rank=${mode === "results" ? (position ?? null) : null},display_started_at=now() WHERE id=1`;
      return json({ ok: true });
    }
    return json({ error: "Không tìm thấy" }, 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        { error: "Thông tin chưa hợp lệ. Kiểm tra các trường nhập." },
        400,
      );
    if ((e as any).code === "23505")
      return json(
        {
          error: "Bài viết/API key đã tồn tại hoặc đang có một lượt quét khác.",
        },
        409,
      );
    const message = e instanceof Error ? e.message : "Có lỗi xảy ra";
    const safe = /Cần |Chưa |Vui lòng |Giờ |link |Không còn/.test(message);
    console.error(
      "API error",
      e instanceof Error ? e.name : "unknown",
      (e as any).code || "",
      e instanceof Error ? e.message : "",
    );
    return json(
      {
        error: safe
          ? message
          : "Không thể xử lý yêu cầu. Vui lòng thử lại hoặc kiểm tra cấu hình.",
      },
      safe ? 400 : 500,
    );
  }
}
export const GET = handle;
export const POST = handle;
