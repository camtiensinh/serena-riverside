import { db } from "../src/lib/db";
import { checkPost } from "../src/lib/rules";

const sql = db();
const startsAt = "2026-10-27T08:00:00+07:00";
const endsAt = "2026-10-27T11:30:00+07:00";
const [settings] = await sql`SELECT hashtags FROM settings WHERE id=1`;
const hashtags = Array.isArray(settings.hashtags) ? settings.hashtags : [];
const rows = await sql`SELECT id,raw,reactions FROM submissions WHERE deleted_at IS NULL AND raw IS NOT NULL AND post_id IS NOT NULL`;
const validations = rows.map((row) => {
  const checked = checkPost(row.raw, {
    starts_at: startsAt,
    ends_at: endsAt,
    time_filter_enabled: true,
    hashtags,
  });
  const missingMetric = row.reactions == null;
  return {
    id: row.id,
    hashtag_ok: checked.hashtagOk,
    time_ok: checked.timeOk,
    status:
      checked.hashtagOk && checked.timeOk && !missingMetric
        ? "valid"
        : "invalid",
    reason:
      checked.reason || (missingMetric ? "Thiếu chỉ số dùng để xếp hạng" : null),
  };
});

await sql.transaction([
  sql`UPDATE settings SET starts_at=${startsAt},ends_at=${endsAt},time_filter_enabled=true WHERE id=1`,
  sql`UPDATE submissions s SET status=v.status,reason=v.reason,hashtag_ok=v.hashtag_ok,time_ok=v.time_ok FROM jsonb_to_recordset(${JSON.stringify(validations)}::jsonb) AS v(id uuid,status text,reason text,hashtag_ok boolean,time_ok boolean) WHERE s.id=v.id AND s.deleted_at IS NULL`,
]);

console.log(`Updated the event window and rechecked ${validations.length} stored posts without calling Apify.`);
