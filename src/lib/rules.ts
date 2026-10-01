export function facebookUrl(value: string) {
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    throw new Error("Vui lòng nhập đường dẫn bài viết Facebook hợp lệ");
  }
  if (
    u.protocol !== "https:" ||
    ![
      "facebook.com",
      "www.facebook.com",
      "m.facebook.com",
      "web.facebook.com",
    ].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    throw new Error("Vui lòng nhập link bài viết HTTPS trên Facebook");
  if (!(
    /^\/share\/(?:[prv]\/)?[A-Za-z0-9]+\/?$/.test(u.pathname) ||
    /\/posts\/|\/permalink\/|\/reel\/|\/videos\//.test(u.pathname) ||
    ["/permalink.php", "/story.php", "/photo.php", "/photo/"].includes(
      u.pathname,
    )
  ))
    throw new Error("Cần link bài viết cụ thể, không phải link trang cá nhân");
  u.hostname = "www.facebook.com";
  for (const k of [...u.searchParams.keys()])
    if (!["story_fbid", "id", "fbid", "v"].includes(k))
      u.searchParams.delete(k);
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}
export function matchesPost(url: string, post: Record<string, unknown>) {
  const normalized = facebookUrl(url);
  for (const candidate of [post.facebookUrl, post.url]) {
    if (typeof candidate === "string")
      try {
        if (facebookUrl(candidate) === normalized) return true;
      } catch {}
  }
  const parsed = new URL(normalized);
  const identifier =
    parsed.searchParams.get("story_fbid") ||
    parsed.searchParams.get("fbid") ||
    parsed.pathname.match(/\/(?:posts|permalink|videos|reel)\/([^/]+)/)?.[1];
  return !!identifier && identifier === String(post.postId || "");
}
export function checkPost(
  post: Record<string, unknown>,
  settings: {
    starts_at: string;
    ends_at: string | null;
    hashtags: string[];
    time_filter_enabled?: boolean;
  },
) {
  const hashtags = new Set(
    String(post.text || "")
      .match(/#[\p{L}\p{N}_]+/gu)
      ?.map((tag) => tag.slice(1).toLocaleLowerCase("vi-VN")) || [],
  );
  const missing = settings.hashtags.filter(
    (tag) => !hashtags.has(tag.replace(/^#/, "").toLocaleLowerCase("vi-VN")),
  );
  const time =
    typeof post.time === "string"
      ? Date.parse(post.time)
      : typeof post.timestamp === "number"
        ? post.timestamp * 1000
        : NaN;
  const timeOk =
    settings.time_filter_enabled === false ||
    (Number.isFinite(time) &&
      time >= Date.parse(settings.starts_at) &&
      (!settings.ends_at || time <= Date.parse(settings.ends_at)));
  const likes =
    typeof post.reactionLikeCount === "number" ? post.reactionLikeCount : null;
  return {
    hashtagOk: !missing.length,
    timeOk,
    likes,
    postedAt: Number.isFinite(time) ? new Date(time).toISOString() : null,
    reason: [
      missing.length ? `Thiếu ${missing.map((t) => "#" + t).join(", ")}` : "",
      !timeOk ? "Bài viết ngoài thời gian hoặc thiếu thời gian đăng" : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
export function rank<
  T extends {
    id: string;
    likes: number | null;
    reactions: number | null;
    posted_at: string | null;
    created_at: string;
  },
>(rows: T[], metric: string) {
  return [...rows].sort(
    (a, b) =>
      Number(b[metric as "likes" | "reactions"]) -
        Number(a[metric as "likes" | "reactions"]) ||
      Date.parse(a.posted_at || a.created_at) -
        Date.parse(b.posted_at || b.created_at) ||
      a.id.localeCompare(b.id),
  );
}
