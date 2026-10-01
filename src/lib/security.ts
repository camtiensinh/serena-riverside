import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function equal(a: string, b: string) {
  return timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
}
function secret(name: string) {
  const s = process.env[name];
  if (!s) throw new Error("Thiếu cấu hình bảo mật");
  return s;
}
export function encrypt(s: string) {
  const iv = randomBytes(12);
  const c = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret("KEY_ENCRYPTION_SECRET")).digest(),
    iv,
  );
  return [
    iv.toString("hex"),
    Buffer.concat([c.update(s, "utf8"), c.final()]).toString("hex"),
    c.getAuthTag().toString("hex"),
  ].join(".");
}
export function decrypt(s: string) {
  const [iv, data, tag] = s.split(".");
  const c = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret("KEY_ENCRYPTION_SECRET")).digest(),
    Buffer.from(iv, "hex"),
  );
  c.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    c.update(Buffer.from(data, "hex")),
    c.final(),
  ]).toString("utf8");
}
function sign(s: string) {
  return createHmac("sha256", secret("SESSION_SECRET")).update(s).digest("hex");
}
export function webhookSignature(jobId: string) {
  return sign("apify-webhook:" + jobId);
}
export async function login() {
  const exp = String(Date.now() + 12 * 3600000);
  (await cookies()).set("serena_admin", `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 43200,
  });
}
export async function authenticated() {
  const s = (await cookies()).get("serena_admin")?.value;
  if (!s) return false;
  const [exp, sig] = s.split(".");
  return Number(exp) > Date.now() && equal(sig || "", sign(exp));
}
export async function rateLimit(id: string, max: number, seconds: number) {
  const sql = db();
  const r =
    await sql`INSERT INTO rate_limits(id,expires_at) VALUES(${digest(id)},now()+${seconds}*interval '1 second') ON CONFLICT(id) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+${seconds}*interval '1 second' ELSE rate_limits.expires_at END RETURNING count`;
  return r[0].count <= max;
}
