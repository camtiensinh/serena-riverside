export async function api(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Không thể kết nối máy chủ");
  return data;
}
export const number = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("vi-VN");
export const date = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "Chưa cập nhật";
