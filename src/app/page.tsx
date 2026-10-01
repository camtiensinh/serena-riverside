"use client";
import { useEffect, useState } from "react";
import { Check, ArrowRight, Link as LinkIcon, Sparkles } from "lucide-react";
import Image from "next/image";
import { DISTRIBUTORS } from "@/lib/distributors";
import "./entry.css";
import EventLogo from "@/components/event-logo";
import { api, date } from "@/lib/client";
export default function Home() {
  const [settings, setSettings] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  useEffect(() => {
    api("public")
      .then((d) => setSettings(d.settings))
      .catch(() =>
        setError("Không tải được thông tin sự kiện. Vui lòng tải lại trang."),
      );
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await api("submit", {
        name: f.get("name"),
        team: f.get("team"),
        facebookUrl: f.get("facebookUrl"),
        website: f.get("website"),
        consent: f.get("consent") === "on",
      });
      setSuccess(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-page">
      <nav className="public-nav">
        <EventLogo variant="black" />
      </nav>
      <main className="entry-layout">
        <section
          className="kickoff-visual"
          aria-label="Lễ kick-off Serena Riverside"
        >
          <Image
            src="/serena-form-kv-27-10-2026.png"
            alt="Sống trọn từng khoảnh khắc tại Serena Riverside"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </section>
        <section className="entry-card">
          <div className="card-kicker">
            <Sparkles size={18} /> SẴN SÀNG TỎA SÁNG?
          </div>
          <h2>Gửi bài dự thi</h2>
          <p>
            Đăng bài công khai trên Facebook và gửi đường dẫn của bạn tại đây.
          </p>
          <div className="event-time">
            <span>
              {settings?.time_filter_enabled
                ? "THỜI GIAN BÀI ĐĂNG HỢP LỆ"
                : "ĐIỀU KIỆN THAM DỰ"}
            </span>
            <strong>
              {settings?.time_filter_enabled
                ? date(settings.starts_at)
                : "Bài viết công khai · Đủ hashtag sự kiện"}{" "}
              {settings?.time_filter_enabled && <small>· Giờ Việt Nam</small>}
            </strong>
            {settings?.time_filter_enabled && settings?.ends_at && (
              <small>Đến {date(settings.ends_at)}</small>
            )}
          </div>
          {success ? (
            <div className="success-state">
              <span>
                <Check size={36} />
              </span>
              <h2>Đã nhận bài của bạn!</h2>
              <p>
                Bài dự thi đã được lưu. Ban tổ chức sẽ quét và kiểm tra điều
                kiện trước khi xếp hạng.
              </p>
              <code>Mã: {success.slice(0, 8).toUpperCase()}</code>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="form-row">
                <label>
                  Họ và tên
                  <input
                    name="name"
                    placeholder="Nguyễn Minh Anh"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
              </div>
              <label>
                Đại lý phân phối / Sàn giao dịch
                <select name="team" required defaultValue="">
                  <option value="" disabled>
                    Chọn đại lý phân phối
                  </option>
                  {DISTRIBUTORS.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Đường dẫn bài viết Facebook
                <div className="input-icon">
                  <LinkIcon size={17} />
                  <input
                    name="facebookUrl"
                    type="url"
                    placeholder="https://www.facebook.com/.../posts/..."
                    required
                  />
                </div>
              </label>
              <div className="hint">
                Hãy đặt bài viết ở chế độ <b>Công khai</b> và giữ đủ hashtag của
                sự kiện.
              </div>
              <input
                className="honeypot"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <label className="checkbox-label">
                <input type="checkbox" name="consent" required />
                <span>
                  Tôi xác nhận đây là bài viết của mình, đồng ý cho ban tổ chức
                  xử lý thông tin và hiển thị tên, đơn vị, chỉ số tương tác trên
                  bảng xếp hạng.
                </span>
              </label>
              {error && (
                <div role="alert" className="alert">
                  {error}
                </div>
              )}
              <button
                className="primary wide"
                disabled={busy || !settings || !!settings?.published}
              >
                {busy
                  ? "Đang gửi bài…"
                  : settings?.published
                    ? "Cuộc thi đã công bố kết quả"
                    : "Gửi bài tham dự"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </section>
      </main>
      <footer>
        <span>© 2026 Serena Riverside. Together, we rise.</span>
      </footer>
    </div>
  );
}
