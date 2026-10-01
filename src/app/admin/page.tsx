"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Files,
  Settings,
  ArrowUpRight,
  RefreshCw,
  Maximize2,
  Trophy,
  Search,
  ChevronRight,
  Users,
  Heart,
  MessageCircle,
  Share2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Plus,
  LogOut,
  Download,
  KeyRound,
  Activity,
  SlidersHorizontal,
  ExternalLink,
  Radio,
  Waves,
  Trash2,
  Upload,
  Gift,
  Dices,
  RotateCcw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import Brand from "@/components/brand";
import { api, date, number } from "@/lib/client";
import { rank } from "@/lib/rules";
import { PostMedia, FacebookAvatar } from "@/components/post-media";
type Row = Record<string, any>;
const labels: Record<string, string> = {
  pending: "Chờ kiểm tra",
  valid: "Hợp lệ",
  invalid: "Không hợp lệ",
  error: "Lỗi quét",
  healthy: "Khả dụng",
  unknown: "Chưa kiểm tra",
  exhausted: "Hết hạn mức",
  invalid_key: "Key không hợp lệ",
  rate_limited: "Tạm giới hạn",
};
function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value}>
      <i />
      {labels[value] || value}
    </span>
  );
}
function Empty({ text = "Chưa có dữ liệu" }: { text?: string }) {
  return (
    <div className="empty">
      <Waves size={28} />
      <strong>{text}</strong>
      <span>Dữ liệu sẽ xuất hiện sau khi nhận bài và hoàn tất lượt quét.</span>
    </div>
  );
}
export default function Admin() {
  const [data, setData] = useState<Row | null>(null),
    [logged, setLogged] = useState<boolean | null>(null),
    [tab, setTab] = useState("dashboard"),
    [modal, setModal] = useState(""),
    [detail, setDetail] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [tag, setTag] = useState("all"),
    [team, setTeam] = useState("all"),
    [raw, setRaw] = useState<unknown>(null),
    [selected, setSelected] = useState<string[]>([]),
    [deleteOpen, setDeleteOpen] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [importFile, setImportFile] = useState<File | null>(null),
    [importResult, setImportResult] = useState<Row | null>(null);
  const activeScan = data?.scans?.[0]?.status === "running";
  const ticking = useRef(false);
  const scanProgressSignature = useRef("");
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const d = await api("admin");
      setData(d);
      setSelected((ids) =>
        ids.filter((id) => d.submissions.some((row: Row) => row.id === id)),
      );
      setLogged(true);
    } catch (e) {
      if ((e as Error).message.includes("đăng nhập")) setLogged(false);
      else setError((e as Error).message);
    } finally {
      refreshing.current = false;
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!logged || !activeScan) return;
    const id = setInterval(async () => {
      if (ticking.current) return;
      ticking.current = true;
      try {
        const result = await api("tick", {});
        const signature = JSON.stringify(result.progress);
        if (signature !== scanProgressSignature.current) {
          await refresh();
          scanProgressSignature.current = signature;
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        ticking.current = false;
      }
    }, 3000);
    return () => clearInterval(id);
  }, [logged, refresh, activeScan]);
  async function action(
    path: string,
    body: unknown = {},
    message = "Đã cập nhật",
  ) {
    setBusy(path);
    setError("");
    try {
      await api(path, body);
      setNotice(message);
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  }
  async function importExcel() {
    if (!importFile) return;
    setBusy("submissions/import");
    setError("");
    setImportResult(null);
    try {
      const body = new FormData();
      body.set("file", importFile);
      const response = await fetch("/api/submissions/import", {
        method: "POST",
        body,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Không thể import Excel");
      setImportResult(result);
      setNotice(
        `Đã import ${result.inserted} bài; bỏ qua ${result.duplicates} link trùng.`,
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  async function doLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await action(
      "login",
      { password: new FormData(e.currentTarget).get("password") },
      "Đăng nhập thành công",
    );
  }
  if (logged === false)
    return (
      <div className="login-page">
        <Brand />
        <form className="login-card" onSubmit={doLogin}>
          <span className="card-kicker">
            <KeyRound size={18} /> EVENT CONTROL CENTER
          </span>
          <h1>Chào mừng trở lại.</h1>
          <p>Đăng nhập để quản lý Social Arena.</p>
          <label>
            Mật khẩu quản trị
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="alert">{error}</div>}
          <button className="primary wide" disabled={!!busy}>
            Đăng nhập <ArrowUpRight size={18} />
          </button>
          <a href="/">← Về trang dự thi</a>
        </form>
      </div>
    );
  if (!data)
    return (
      <div className="loading-page">
        <RefreshCw className="spin" />
        <p>{error || "Đang mở trung tâm điều hành…"}</p>
        {error && <button onClick={refresh}>Thử lại</button>}
      </div>
    );
  const rows: Row[] = data.submissions,
    valid = rows.filter((r) => r.status === "valid"),
    leaderboard = rank(valid as any[], "reactions") as Row[],
    scan = data.scans[0],
    running = scan?.status === "running",
    metric = "reactions",
    metricName = "Cảm xúc";
  const total = (key: string) =>
      rows.reduce((s, r) => s + Number(r[key] || 0), 0),
    checked = rows.filter((r) => r.checked_at).length,
    percentage = rows.length
      ? Math.round((valid.length / rows.length) * 100)
      : 0;
  const filtered = rows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (tag === "all" ||
        (tag === "yes" ? r.hashtag_ok === true : r.hashtag_ok === false)) &&
      (team === "all" || r.team === team) &&
      `${r.name} ${r.team} ${r.phone} ${r.post_id || ""} ${r.content || ""}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const allSelected =
    filtered.length > 0 && filtered.every((row) => selected.includes(row.id));
  function selectAll() {
    setSelected((ids) =>
      allSelected
        ? ids.filter((id) => !filtered.some((row) => row.id === id))
        : [...new Set([...ids, ...filtered.map((row) => row.id)])],
    );
  }
  async function scanSelected() {
    if (
      await action(
        "scan",
        { ids: selected },
        `Đã bắt đầu quét ${selected.length} bài được chọn.`,
      )
    )
      setSelected([]);
  }
  function csv() {
    const columns = [
      "name",
      "phone",
      "team",
      "facebook_url",
      "author",
      "posted_at",
      "likes",
      "reactions",
      "comments",
      "shares",
      "hashtag_ok",
      "time_ok",
      "status",
      "reason",
      "checked_at",
    ];
    const cell = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const content =
      "\uFEFF" +
      [columns, ...filtered.map((r) => columns.map((k) => r[k]))]
        .map((r) => r.map(cell).join(","))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "serena-bai-du-thi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <span className="workspace-logo">S</span>
          <div>
            Serena Kickoff 2026<small>Không gian sự kiện</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-caption">TRUNG TÂM ĐIỀU HÀNH</div>
        <nav>
          <button
            className={tab === "dashboard" ? "active" : ""}
            onClick={() => setTab("dashboard")}
          >
            <LayoutDashboard size={19} />
            Tổng quan <span className="nav-dot" />
          </button>
          <button
            className={tab === "submissions" ? "active" : ""}
            onClick={() => setTab("submissions")}
          >
            <Files size={19} />
            Quản lý bài dự thi <b>{rows.length}</b>
          </button>
          <button
            className={tab === "lucky" ? "active" : ""}
            onClick={() => setTab("lucky")}
          >
            <Gift size={19} />
            Vòng quay may mắn <b>{data.wheel?.segments?.length || 0}</b>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="led-promo">
            <Radio size={21} />
            <strong>Sẵn sàng cho sân khấu?</strong>
            <p>Bảng xếp hạng sống động trên màn hình LED.</p>
            <a href="/live" target="_blank">
              Mở màn hình trình chiếu <ArrowUpRight size={15} />
            </a>
          </div>
          <button onClick={() => setModal("settings")}>
            <Settings size={18} />
            Cài đặt sự kiện
          </button>
          <button
            onClick={async () => {
              await api("logout", {});
              setLogged(false);
            }}
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
          <div className="admin-person">
            <span>AD</span>
            <div>
              Ban tổ chức<small>Quản trị viên</small>
            </div>
            <span className="live-dot" />
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            Không gian làm việc <ChevronRight size={14} />
            <b>
              {tab === "dashboard"
                ? "Tổng quan"
                : tab === "lucky"
                  ? "Vòng quay may mắn"
                  : "Bài dự thi"}
            </b>
          </div>
          <div>
            <span className="timezone">GMT+7 · Việt Nam</span>
            <a href="/" target="_blank">
              Form tham dự <ExternalLink size={14} />
            </a>
            <button
              className="icon-button"
              title="Cài đặt"
              onClick={() => setModal("settings")}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>
        <main className="admin-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">SOCIAL ARENA / KICKOFF 2026</div>
              <h1>
                {tab === "dashboard"
                  ? "Tổng quan sự kiện"
                  : tab === "lucky"
                    ? "Điều khiển vòng quay may mắn"
                    : "Quản lý bài dự thi"}
                <span className="live-label">
                  <i />
                  {"DỮ LIỆU HIỆN TẠI"}
                </span>
              </h1>
              <p>
                {tab === "dashboard"
                  ? "Mỗi tương tác, một dấu ấn. Theo dõi hành trình lan tỏa Serena."
                  : tab === "lucky"
                    ? "Tạo segment, loại link trùng và điều khiển từng giải trên màn hình LED."
                    : "Tất cả bài tham dự, nội dung và điều kiện hợp lệ trong một nơi."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                onClick={refresh}
                disabled={!!busy}
                title="Chỉ đọc dữ liệu đã lưu, không gọi Apify"
              >
                <RefreshCw size={16} /> Làm mới dữ liệu
              </button>
              <button
                onClick={() =>
                  window.open(tab === "lucky" ? "/lucky" : "/live", "_blank")
                }
              >
                <Maximize2 size={16} />
                {tab === "lucky" ? "Mở vòng quay" : "Trình chiếu"}
              </button>
              {tab !== "lucky" && (
                <button
                  className="primary"
                  disabled={running || !!busy}
                  onClick={() =>
                    action(
                      "scan",
                      {},
                      "Đã tạo lượt quét. Tiến trình được lưu và sẽ cập nhật tự động.",
                    )
                  }
                >
                  <RefreshCw size={16} className={running ? "spin" : ""} />
                  {running ? "Đang quét dữ liệu" : "Quét tất cả bài"}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div role="alert" className="alert dismissible">
              {error}
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="toast">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          <div className="event-banner">
            <div className="banner-icon">
              <Waves size={25} />
            </div>
            <div>
              <b>Serena Riverside · Kickoff 2026</b>
              <p>
                {data.settings.hashtags.map((t: string) => "#" + t).join("   ")}
                <span>•</span>
                {data.settings.time_filter_enabled
                  ? "Từ " + date(data.settings.starts_at)
                  : "Không lọc thời gian đăng bài"}
              </p>
            </div>
            <div className="banner-status">
              <span className="live-dot" />
              {"Đang tiếp nhận bài dự thi"}
            </div>
          </div>
          {running && (
            <div className="scan-progress">
              <div>
                <RefreshCw className="spin" size={18} />
                <b>Đang kiểm tra bài viết & cập nhật tương tác</b>
                <span>
                  {scan.done + scan.errors}/{scan.total} bài
                </span>
              </div>
              <div className="progress-track">
                <i
                  style={{
                    width: `${((scan.done + scan.errors) / Math.max(1, scan.total)) * 100}%`,
                  }}
                />
              </div>
              <small>
                {scan.done} thành công · {scan.errors} lỗi ·{" "}
                {Math.max(0, scan.total - scan.done - scan.errors)} bài còn lại.
                Hàng đợi đã lưu trong DB: tối đa 50 bài/lô, 4 lô đồng thời trên
                các key khả dụng. Giữ CMS mở trong lúc quét; có thể tải lại
                trang để tiếp tục theo dõi. Chỉ tạo lượt quét khi bạn nhấn nút.
              </small>
            </div>
          )}
          {tab === "lucky" ? (
            <LuckyPanel
              data={data}
              action={action}
              refresh={refresh}
              busy={busy}
              setError={setError}
              setNotice={setNotice}
            />
          ) : tab === "dashboard" ? (
            <>
              <div className="stat-grid">
                {[
                  {
                    name: "Bài viết tham dự",
                    value: rows.length,
                    icon: Files,
                    note: `${rows.length - checked} bài chờ kiểm tra`,
                    color: "green",
                  },
                  {
                    name: `Tổng lượt ${metricName.toLowerCase()}`,
                    value: total(metric),
                    icon: Heart,
                    note: "Từ các bài đã quét",
                    color: "pink",
                  },
                  {
                    name: "Bình luận & chia sẻ",
                    value: total("comments") + total("shares"),
                    icon: MessageCircle,
                    note: `${number(total("comments"))} bình luận · ${number(total("shares"))} chia sẻ`,
                    color: "blue",
                  },
                  {
                    name: "Bài viết hợp lệ",
                    value: valid.length,
                    icon: ShieldIcon,
                    note: `${percentage}% tổng bài dự thi`,
                    color: "amber",
                  },
                ].map((s) => (
                  <div className="stat-card" key={s.name}>
                    <div>
                      <span>{s.name}</span>
                      <i className={s.color}>
                        <s.icon size={19} />
                      </i>
                    </div>
                    <strong>{number(s.value)}</strong>
                    <small>{s.note}</small>
                  </div>
                ))}
              </div>
              <div className="charts-grid">
                <section className="panel trend-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Nhịp độ lan tỏa</h2>
                      <p>Tương tác qua từng lượt quét hoàn tất</p>
                    </div>
                    <span className="subtle-pill">
                      {data.history.length} lượt quét
                    </span>
                  </div>
                  {data.history.length ? (
                    <div className="chart-area">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={data.history.map((r: Row) => ({
                            ...r,
                            time: date(r.completed_at),
                          }))}
                        >
                          <defs>
                            <linearGradient
                              id="green"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#159779"
                                stopOpacity={0.25}
                              />
                              <stop
                                offset="100%"
                                stopColor="#159779"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#edf0ee" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey={metric}
                            name={metricName}
                            stroke="#159779"
                            strokeWidth={3}
                            fill="url(#green)"
                          />
                          <Area
                            type="monotone"
                            dataKey="comments"
                            name="Bình luận"
                            stroke="#b8a66d"
                            fill="transparent"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="shares"
                            name="Chia sẻ"
                            stroke="#7c9ed2"
                            fill="transparent"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty text="Chờ nhịp tương tác đầu tiên" />
                  )}
                  <div className="chart-legend">
                    <span>
                      <i style={{ background: "#159779" }} />
                      {metricName}
                    </span>
                    <span>
                      <i style={{ background: "#b8a66d" }} />
                      Bình luận
                    </span>
                    <span>
                      <i style={{ background: "#7c9ed2" }} />
                      Chia sẻ
                    </span>
                  </div>
                </section>
                <section className="panel validity-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Chất lượng bài dự thi</h2>
                      <p>Kiểm tra thời gian & hashtag</p>
                    </div>
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="donut">
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie
                          data={
                            rows.length
                              ? [
                                  { name: "Hợp lệ", value: valid.length },
                                  {
                                    name: "Không hợp lệ / lỗi",
                                    value: rows.filter((r) =>
                                      ["invalid", "error"].includes(r.status),
                                    ).length,
                                  },
                                  {
                                    name: "Chờ kiểm tra",
                                    value: rows.filter(
                                      (r) => r.status === "pending",
                                    ).length,
                                  },
                                ]
                              : [{ name: "Chưa có bài", value: 1 }]
                          }
                          dataKey="value"
                          innerRadius={sixty()}
                          outerRadius={80}
                          stroke="none"
                          startAngle={90}
                          endAngle={-270}
                        >
                          {["#158871", "#e5b96a", "#e8eeeb"].map((c) => (
                            <Cell key={c} fill={c} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-label">
                      <b>{percentage}%</b>
                      <span>Hợp lệ</span>
                    </div>
                  </div>
                  <div className="validity-legend">
                    <span>
                      <i />
                      Đủ điều kiện<b>{valid.length}</b>
                    </span>
                    <span>
                      <i />
                      Không hợp lệ / lỗi
                      <b>
                        {
                          rows.filter((r) =>
                            ["invalid", "error"].includes(r.status),
                          ).length
                        }
                      </b>
                    </span>
                    <span>
                      <i />
                      Chờ kiểm tra
                      <b>{rows.filter((r) => r.status === "pending").length}</b>
                    </span>
                  </div>
                </section>
              </div>
              <div className="bottom-grid">
                <section className="panel ranking-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        <Trophy size={18} /> Những gương mặt dẫn đầu
                      </h2>
                      <p>
                        Xếp hạng theo {metricName.toLowerCase()} · Bài hợp lệ
                      </p>
                    </div>
                    <a href="/live" target="_blank">
                      Xem tất cả <ArrowUpRight size={15} />
                    </a>
                  </div>
                  {leaderboard.length ? (
                    <div className="mini-ranking">
                      {leaderboard.slice(0, 5).map((r, i) => (
                        <div key={r.id}>
                          <span className={"rank-number rank-" + i}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="avatar">
                            {r.name
                              .split(" ")
                              .slice(-2)
                              .map((s: string) => s[0])
                              .join("")}
                          </span>
                          <div>
                            <b>{r.name}</b>
                            <small>{r.team}</small>
                          </div>
                          <div className="rank-bar">
                            <i
                              style={{
                                width: `${Math.max(2, (Number(r[metric]) / Math.max(1, Number(leaderboard[0][metric]))) * 100)}%`,
                              }}
                            />
                          </div>
                          <strong>
                            {number(r[metric])}
                            <Heart size={12} />
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text="Bục vinh quang đang chờ chủ nhân" />
                  )}
                </section>
                <section className="award-card">
                  <span className="award-orb">
                    <Trophy size={32} />
                  </span>
                  <div className="eyebrow">THE MOMENT OF GLORY</div>
                  <h2>
                    Sẵn sàng gọi tên
                    <br />
                    người chiến thắng?
                  </h2>
                  <p>Đọc dữ liệu hiện tại và mở màn trao giải đầy cảm xúc.</p>
                  <button
                    className="gold-button"
                    onClick={() => setModal("publish")}
                    disabled={running}
                  >
                    {" "}
                    {"Điều khiển trình chiếu"}
                    <ArrowUpRight size={17} />
                  </button>
                  <small>
                    <ShieldIcon size={13} /> Bảng xếp hạng theo dữ liệu hiện tại
                    · công bố
                  </small>
                </section>
              </div>
              <section className="panel team-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Dấu ấn các đơn vị</h2>
                    <p>
                      Tổng {metricName.toLowerCase()} của bài hợp lệ theo sàn
                      giao dịch
                    </p>
                  </div>
                  <Users size={18} />
                </div>
                {valid.length ? (
                  <div style={{ height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(
                          valid.reduce((acc: Record<string, number>, r) => {
                            acc[r.team] =
                              (acc[r.team] || 0) + Number(r[metric] || 0);
                            return acc;
                          }, {}),
                        ).map(([name, value]) => ({ name, value }))}
                      >
                        <CartesianGrid vertical={false} stroke="#edf0ee" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          name={metricName}
                          fill="#1c8d77"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={50}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty text="Chưa có tương tác theo đơn vị" />
                )}
              </section>
            </>
          ) : (
            <section className="panel submissions-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Danh sách bài dự thi{" "}
                    <span className="count-pill">{filtered.length}</span>
                  </h2>
                  <p>Cập nhật gần nhất: {date(scan?.completed_at)}</p>
                </div>
                <div className="panel-actions">
                  <button
                    onClick={() => {
                      setImportFile(null);
                      setImportResult(null);
                      setError("");
                      setImportOpen(true);
                    }}
                    disabled={running}
                  >
                    <Upload size={15} /> Import Excel
                  </button>
                  <button onClick={csv}>
                    <Download size={15} />
                    Xuất CSV
                  </button>
                </div>
              </div>
              <div className="filters">
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Tìm tên, SĐT, nội dung bài…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Trạng thái"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  {["pending", "valid", "invalid", "error"].map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Hashtag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="all">Tất cả hashtag</option>
                  <option value="yes">Đủ hashtag</option>
                  <option value="no">Thiếu hashtag</option>
                </select>
                <select
                  aria-label="Đơn vị"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                >
                  <option value="all">Tất cả đơn vị</option>
                  {[...new Set(rows.map((r) => r.team))].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="selection-toolbar">
                <span>
                  <b>{selected.length}</b> bài đã chọn
                  {filtered.length !== rows.length && (
                    <small> · {filtered.length} bài khớp bộ lọc</small>
                  )}
                </span>
                <button
                  onClick={() => setSelected([])}
                  disabled={!selected.length}
                >
                  Bỏ chọn
                </button>
                <button
                  className="primary"
                  disabled={!selected.length || running || !!busy}
                  onClick={scanSelected}
                >
                  <RefreshCw size={15} />
                  Quét {selected.length || ""} bài đã chọn
                </button>
                <button
                  className="danger-button"
                  disabled={!selected.length || running || !!busy}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 size={15} />
                  Xóa bài đã chọn
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả bài theo bộ lọc"
                          checked={allSelected}
                          ref={(el) => {
                            if (el)
                              el.indeterminate =
                                !allSelected &&
                                filtered.some((row) =>
                                  selected.includes(row.id),
                                );
                          }}
                          disabled={!filtered.length || running}
                          onChange={selectAll}
                        />
                      </th>
                      <th>NGƯỜI THAM DỰ</th>
                      <th>BÀI VIẾT</th>
                      <th>LIKE / CẢM XÚC</th>
                      <th>BL / CHIA SẺ</th>
                      <th>ĐIỀU KIỆN</th>
                      <th>TRẠNG THÁI</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => {
                          setDetail(r);
                          setRaw(null);
                        }}
                      >
                        <td
                          className="checkbox-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={"Chọn bài của " + r.name}
                            checked={selected.includes(r.id)}
                            disabled={running}
                            onChange={() =>
                              setSelected((ids) =>
                                ids.includes(r.id)
                                  ? ids.filter((id) => id !== r.id)
                                  : [...ids, r.id],
                              )
                            }
                          />
                        </td>
                        <td>
                          <b>{r.name}</b>
                          <small>
                            {r.team} · {r.phone}
                          </small>
                        </td>
                        <td>
                          <span className="content-preview">
                            {r.content || "Chưa lấy nội dung"}
                          </span>
                          <small>{date(r.posted_at)}</small>
                        </td>
                        <td>
                          <b>{number(r.likes)}</b> / {number(r.reactions)}
                        </td>
                        <td>
                          {number(r.comments)} / {number(r.shares)}
                        </td>
                        <td>
                          <span
                            className={
                              r.hashtag_ok ? "check-good" : "check-muted"
                            }
                          >
                            #
                            {r.hashtag_ok
                              ? " Đủ hashtag"
                              : r.hashtag_ok === false
                                ? " Thiếu hashtag"
                                : " Chưa kiểm tra"}
                          </span>
                          <small>
                            {!data.settings.time_filter_enabled
                              ? "Không lọc thời gian"
                              : r.time_ok
                                ? "✓ Đúng thời gian"
                                : r.time_ok === false
                                  ? "✕ Sai thời gian"
                                  : "— Thời gian"}
                          </small>
                        </td>
                        <td>
                          <Badge value={r.status} />
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={"Chi tiết " + r.name}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && <Empty text="Chưa có bài viết phù hợp" />}
            </section>
          )}
          <div className="admin-foot">
            <span>
              <span className="live-dot" /> Nhấn Làm mới dữ liệu để cập nhật
            </span>
            <span>Serena Riverside · Social Arena 2026</span>
          </div>
        </main>
      </div>
      {deleteOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Xóa bài dự thi"
          >
            <div className="modal-heading">
              <h2>Xóa {selected.length} bài đã chọn?</h2>
              <button
                className="icon-button"
                aria-label="Đóng"
                onClick={() => setDeleteOpen(false)}
              >
                <X />
              </button>
            </div>
            <p>
              Các bài này sẽ được gỡ khỏi danh sách tham dự và bảng xếp hạng.
              Nhật ký API được giữ lại để đối soát.
            </p>
            <div className="delete-actions">
              <button onClick={() => setDeleteOpen(false)}>Hủy</button>
              <button
                className="danger-button"
                disabled={!!busy}
                onClick={async () => {
                  if (
                    await action(
                      "submissions/delete",
                      { ids: selected },
                      "Đã xóa các bài được chọn",
                    )
                  ) {
                    setSelected([]);
                    setDeleteOpen(false);
                  }
                }}
              >
                Xác nhận xóa {selected.length} bài
              </button>
            </div>
            {error && <div className="alert">{error}</div>}
          </section>
        </div>
      )}
      {importOpen && (
        <div className="modal-backdrop">
          <section
            className="modal import-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Import bài dự thi từ Excel"
          >
            <div className="modal-heading">
              <div>
                <h2>Import bài dự thi từ Excel</h2>
                <p>Đọc worksheet đầu tiên, tối đa 5.000 dòng.</p>
              </div>
              <button
                className="icon-button"
                aria-label="Đóng"
                onClick={() => setImportOpen(false)}
              >
                <X />
              </button>
            </div>
            <div className="import-guide">
              <b>File .xlsx cần có 3 cột</b>
              <span>Họ và tên</span>
              <span>Đại lý phân phối / Sàn giao dịch</span>
              <span>Đường dẫn bài viết Facebook</span>
              <small>
                Tên cột từ Google Forms được nhận tự động. Link trùng trong file
                hoặc đã có trong database sẽ được bỏ qua.
              </small>
            </div>
            <label className="excel-picker">
              <Upload size={22} />
              <span>{importFile?.name || "Chọn file Excel .xlsx"}</span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportResult(null);
                  setError("");
                }}
              />
            </label>
            {importResult && (
              <div className="import-summary">
                <b>Kết quả sheet “{importResult.sheet}”</b>
                <div>
                  <span>{importResult.inserted} đã thêm</span>
                  <span>{importResult.duplicates} trùng</span>
                  <span>{importResult.invalid} lỗi</span>
                </div>
                {!!importResult.issues?.length && (
                  <details>
                    <summary>Xem các dòng bị bỏ qua</summary>
                    <ul>
                      {importResult.issues.map((issue: Row, index: number) => (
                        <li key={index}>
                          Dòng {issue.row}: {issue.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {error && <div className="alert">{error}</div>}
            <div className="delete-actions">
              <button onClick={() => setImportOpen(false)}>Đóng</button>
              <button
                className="primary"
                disabled={!importFile || !!busy}
                onClick={importExcel}
              >
                <Upload size={16} />{" "}
                {busy === "submissions/import"
                  ? "Đang kiểm tra…"
                  : "Kiểm tra và import"}
              </button>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className={
              "modal " + (modal === "settings" ? "settings-modal" : "")
            }
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "settings" ? "Cài đặt sự kiện" : "Công bố giải"
            }
          >
            <div className="modal-heading">
              <h2>
                {modal === "settings"
                  ? "Cài đặt sự kiện"
                  : "Khoảnh khắc vinh danh"}
              </h2>
              <button
                className="icon-button"
                onClick={() => setModal("")}
                aria-label="Đóng"
              >
                <X />
              </button>
            </div>
            {modal === "settings" ? (
              <SettingsPanel data={data} action={action} busy={busy} />
            ) : (
              <div className="publish-content">
                <Trophy size={46} />
                <h2>{"Điều khiển màn báo cáo"}</h2>
                <p>
                  Báo cáo lấy trực tiếp top 5 bài hợp lệ từ dữ liệu hiện tại
                  trong CMS. Không chốt hoặc khóa kết quả. Các nút bên dưới chỉ
                  chuyển màn hình, không gọi Apify và không yêu cầu quét lại
                  trong 5 phút.
                </p>
                <div className="rule-box">
                  Xếp hạng: {metricName} cao nhất. Nếu bằng điểm, ưu tiên bài
                  đăng sớm hơn; nếu vẫn bằng nhau, dùng mã bài để sắp xếp ổn
                  định.
                </div>
                <>
                  <p>
                    Điều khiển màn báo cáo đang mở. Bài mới hoặc chỉ số mới sẽ
                    được cập nhật từ DB. Đếm ngược xong sẽ chờ bạn chọn hạng;
                    không tự mở hoặc chuyển thứ hạng.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <button
                      disabled={!!busy}
                      onClick={() =>
                        action(
                          "presentation",
                          { mode: "waiting" },
                          "Đã chuyển về màn chờ",
                        )
                      }
                    >
                      Về màn chờ
                    </button>
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() =>
                        action(
                          "presentation",
                          { mode: "auto" },
                          "Đã bắt đầu lại countdown 10 giây",
                        )
                      }
                    >
                      Công bố lại · Countdown 10 giây
                    </button>
                    <button
                      disabled={!!busy}
                      onClick={() =>
                        action(
                          "presentation",
                          { mode: "results" },
                          "Đã mở màn kết quả top 5",
                        )
                      }
                    >
                      Hiện ngay top 5
                    </button>
                  </div>
                  <a
                    className="button primary"
                    href="/live?ceremony=1"
                    target="_blank"
                  >
                    Mở màn trao giải <Maximize2 size={17} />
                  </a>
                  <p style={{ marginTop: 20 }}>
                    Bấm từng hạng để vinh danh. Màn hình giữ hạng đã chọn, không
                    tự chuyển.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {[5, 4, 3, 2, 1].map((position) => (
                      <button
                        key={position}
                        disabled={!!busy || leaderboard.length < position}
                        aria-pressed={
                          data.settings.display_mode === "results" &&
                          data.settings.display_rank === position
                        }
                        onClick={() =>
                          action(
                            "presentation",
                            { mode: "results", rank: position },
                            `Đã mở hạng ${position}`,
                          )
                        }
                      >
                        Mở hạng {position}
                      </button>
                    ))}
                  </div>
                </>
              </div>
            )}
            {error && <div className="alert">{error}</div>}
          </section>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop">
          <section
            className="modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết bài dự thi"
          >
            <div className="modal-heading">
              <div>
                <h2>{detail.name}</h2>
                <p>
                  {detail.team} · {detail.phone}
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setDetail(null)}
                aria-label="Đóng"
              >
                <X />
              </button>
            </div>
            <Badge value={detail.status} />
            {detail.reason && <div className="alert">{detail.reason}</div>}
            <div className="detail-meta">
              <span>
                Tác giả FB<b>{detail.author || "Chưa lấy dữ liệu"}</b>
              </span>
              <span>
                Thời gian đăng<b>{date(detail.posted_at)}</b>
              </span>
              <span>
                Kiểm tra gần nhất<b>{date(detail.checked_at)}</b>
              </span>
              <span>
                Facebook post ID<b>{detail.post_id || "—"}</b>
              </span>
            </div>
            <div className="post-content">
              {detail.content || "Nội dung sẽ được lưu sau khi quét."}
            </div>
            <PostMedia key={detail.id} media={detail.media} />
            <div className="detail-stats">
              <span>👍 {number(detail.likes)} Like</span>
              <span>♥ {number(detail.reactions)} cảm xúc</span>
              <span>💬 {number(detail.comments)}</span>
              <span>↗ {number(detail.shares)}</span>
            </div>
            <a
              className="button"
              href={detail.facebook_url}
              target="_blank"
              rel="noreferrer"
            >
              Mở bài viết Facebook <ExternalLink size={15} />
            </a>
            <button
              onClick={async () => {
                try {
                  setRaw(await api("raw/" + detail.id));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Xem dữ liệu Apify đầy đủ
            </button>
            {raw !== null && (
              <pre className="raw-data">{JSON.stringify(raw, null, 2)}</pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function LuckyPanel({
  data,
  action,
  refresh,
  busy,
  setError,
  setNotice,
}: {
  data: Row;
  action: (p: string, b?: unknown, m?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  busy: string;
  setError: (v: string) => void;
  setNotice: (v: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [name, setName] = useState("Khách tham dự 20.09"),
    [segmentId, setSegmentId] = useState(data.wheel?.state?.segment_id || "");
  const wheel = data.wheel || { segments: [], state: {}, winners: [] },
    current = wheel.segments.find((s: Row) => s.id === wheel.state?.segment_id);
  const winners = wheel.winners.filter(
    (w: Row) => w.segment_id === wheel.state?.segment_id,
  );
  async function upload() {
    if (!file) return;
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("segmentName", name);
    try {
      const r = await fetch("/api/wheel/import", { method: "POST", body });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setNotice(
        `Đã tạo segment với ${result.inserted} khách; bỏ qua ${result.duplicates} link trùng.`,
      );
      setFile(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="lucky-admin">
      <section className="wheel-control-card">
        <div className="wheel-control-copy">
          <span>
            <Gift size={17} /> LUCKY DRAW CONTROL
          </span>
          <h2>Khơi nguồn may mắn</h2>
          <p>
            Kết quả được chọn ngẫu nhiên trên server, mỗi link Facebook chỉ có
            một vé trong segment và người đã trúng không thể trúng lại.
          </p>
          <a className="button primary" href="/lucky" target="_blank">
            <Maximize2 size={16} /> Mở màn hình vòng quay
          </a>
        </div>
        <div className="wheel-preview">
          <Dices size={62} />
          <b>{current?.entry_count || 0}</b>
          <span>khách trong segment</span>
        </div>
      </section>
      <div className="lucky-grid">
        <section className="panel lucky-segment-panel">
          <div className="panel-heading">
            <div>
              <h2>Danh sách segment</h2>
              <p>Chọn tệp đang dùng để quay</p>
            </div>
          </div>
          <div className="segment-list">
            {wheel.segments.map((s: Row) => (
              <button
                key={s.id}
                className={wheel.state?.segment_id === s.id ? "active" : ""}
                onClick={() =>
                  action(
                    "wheel/select",
                    { segmentId: s.id },
                    `Đã chọn segment ${s.name}`,
                  )
                }
              >
                <span>
                  <b>{s.name}</b>
                  <small>
                    {s.entry_count} khách · tạo {date(s.created_at)}
                  </small>
                </span>
                <CheckCircle2 size={18} />
              </button>
            ))}
            {!wheel.segments.length && <Empty text="Chưa có segment" />}
          </div>
          <button
            disabled={!rowsAvailable(data)}
            onClick={() =>
              action(
                "wheel/from-submissions",
                {
                  name: `Bài dự thi ${new Date().toLocaleDateString("vi-VN")}`,
                },
                "Đã tạo segment từ toàn bộ bài đã nhận, kể cả bài chưa quét Apify.",
              )
            }
          >
            <Users size={16} /> Tạo từ tất cả bài dự thi hiện tại
          </button>
        </section>
        <section className="panel lucky-import-panel">
          <div className="panel-heading">
            <div>
              <h2>Import khách hàng</h2>
              <p>Excel gồm Họ tên, Đại lý và link Facebook</p>
            </div>
          </div>
          <div className="lucky-import-body">
            <label>
              Tên segment
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </label>
            <label className="excel-picker">
              <Upload size={20} />
              {file ? file.name : "Chọn file Excel .xlsx"}
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="hint">
              Link được chuẩn hóa và kiểm tra trùng ngay khi import, không chờ
              lấy dữ liệu bài post.
            </p>
            <button
              className="primary"
              disabled={!file || !name.trim()}
              onClick={upload}
            >
              <Upload size={16} /> Tạo segment
            </button>
          </div>
        </section>
      </div>
      <section className="panel prize-control">
        <div className="panel-heading">
          <div>
            <h2>Điều khiển công bố giải</h2>
            <p>Quay theo thứ tự giải 3 → giải 2 → giải 1</p>
          </div>
          <button
            className="danger-button"
            disabled={!current || !!busy}
            onClick={() =>
              action(
                "wheel/reset",
                {},
                "Đã reset kết quả vòng quay của segment hiện tại",
              )
            }
          >
            <RotateCcw size={16} /> Reset dashboard
          </button>
        </div>
        <div className="prize-buttons">
          {[3, 2, 1].map((rank) => {
            const winner = winners.find((w: Row) => w.prize_rank === rank);
            return (
              <button
                key={rank}
                className={winner ? "done" : ""}
                disabled={!current || !!busy}
                onClick={() =>
                  action(
                    "wheel/spin",
                    { rank },
                    winner
                      ? `Đã quay lại giải ${rank}; người cũ sẽ không được chọn lại`
                      : `Đã bắt đầu quay giải ${rank}`,
                  )
                }
              >
                <span>GIẢI {rank}</span>
                <b>
                  {winner ? `Quay lại giải ${rank}` : `Quay lấy giải ${rank}`}
                </b>
                <small>
                  {winner
                    ? `Đang giữ: ${winner.name} · ${winner.team}`
                    : "Màn hình LED sẽ tự chạy hiệu ứng"}
                </small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
function rowsAvailable(data: Row) {
  return Array.isArray(data.submissions) && data.submissions.length > 0;
}
function sixty() {
  return 62;
}
function ShieldIcon(props: any) {
  return <CheckCircle2 {...props} />;
}
function SettingsPanel({
  data,
  action,
  busy,
}: {
  data: Row;
  action: (p: string, b?: unknown, m?: string) => Promise<boolean>;
  busy: string;
}) {
  const [section, setSection] = useState("event");
  const s = data.settings;
  const [timeEnabled, setTimeEnabled] = useState(!!s.time_filter_enabled);
  const local = (v: string | null) =>
    v ? new Date(Date.parse(v) + 7 * 3600000).toISOString().slice(0, 16) : "";
  return (
    <>
      <div className="settings-tabs">
        {[
          { id: "event", label: "Thể lệ", icon: SlidersHorizontal },
          { id: "keys", label: "Apify API keys", icon: KeyRound },
          { id: "logs", label: "Nhật ký API", icon: Activity },
        ].map((t) => (
          <button
            className={section === t.id ? "active" : ""}
            key={t.id}
            onClick={() => setSection(t.id)}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>
      {section === "event" ? (
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await action(
              "settings",
              {
                starts_at: f.get("start")
                  ? new Date(f.get("start") + "+07:00").toISOString()
                  : s.starts_at,
                ends_at: f.get("end")
                  ? new Date(f.get("end") + "+07:00").toISOString()
                  : null,
                hashtags: String(f.get("tags"))
                  .split(/[\s,]+/)
                  .filter(Boolean)
                  .map((s) => s.replace(/^#/, "")),
                metric: "reactions",
                time_filter_enabled: timeEnabled,
              },
              "Đã lưu bộ lọc và kiểm tra lại dữ liệu đã lưu, không gọi thêm Apify.",
            );
          }}
        >
          <div className="manual-mode">
            <CheckCircle2 size={18} />
            <div>
              <b>Chỉ quét khi admin nhấn nút</b>
              <p>
                Không có lịch tự chạy. Mở CMS hoặc màn LED chỉ đọc dữ liệu đã
                lưu.
              </p>
            </div>
          </div>
          <label className="checkbox-label time-filter-toggle">
            <input
              type="checkbox"
              checked={timeEnabled}
              onChange={(e) => setTimeEnabled(e.target.checked)}
            />
            <span>Lọc theo thời gian đăng bài</span>
          </label>
          {!timeEnabled && (
            <p className="hint">
              Đang bỏ kiểm tra thời gian. Bài đăng trước sự kiện vẫn có thể hợp
              lệ nếu đủ hashtag.
            </p>
          )}
          <div
            className="form-row"
            style={{ display: timeEnabled ? undefined : "none" }}
          >
            <label>
              Bắt đầu (giờ Việt Nam)
              <input
                type="datetime-local"
                name="start"
                defaultValue={local(s.starts_at)}
                required={timeEnabled}
              />
            </label>
            <label>
              Kết thúc (giờ Việt Nam)
              <input
                type="datetime-local"
                name="end"
                defaultValue={local(s.ends_at)}
              />
            </label>
          </div>
          <label>
            Hashtag bắt buộc
            <input
              name="tags"
              defaultValue={s.hashtags.map((t: string) => "#" + t).join(" ")}
              required
            />
          </label>
          <p className="hint">
            Xếp hạng mặc định theo tổng cảm xúc từ Apify, gồm Like, Love, Care…
          </p>
          <p className="hint">
            Lưu bộ lọc sẽ kiểm tra lại dữ liệu hiện có, không phát sinh lượt gọi
            Apify. Để lấy tương tác mới, chọn bài ở tab Quản lý bài dự thi rồi
            nhấn Quét bài đã chọn.
          </p>
          <button className="primary" disabled={!!busy}>
            Lưu thể lệ
          </button>
        </form>
      ) : section === "keys" ? (
        <div>
          <p className="hint">
            Thêm 3–4 API key từ các tài khoản Apify của bạn. Tối đa 4 lượt chạy
            đồng thời. Key được mã hóa và không trả về trình duyệt. Bật lại key
            sau khi nạp tiền để thử lại.
          </p>
          <div className="key-list">
            {data.keys.map((k: Row) => (
              <div key={k.id}>
                <span className="key-icon">
                  <KeyRound size={19} />
                </span>
                <div>
                  <b>{k.label}</b>
                  <small>
                    •••• {k.suffix} · {date(k.last_used_at)}
                  </small>
                </div>
                <Badge
                  value={k.health === "invalid" ? "invalid_key" : k.health}
                />
                <button
                  className={"toggle " + (k.enabled ? "on" : "")}
                  role="switch"
                  aria-checked={k.enabled}
                  aria-label={"Bật key " + k.label}
                  disabled={!!busy}
                  onClick={() =>
                    action("keys/toggle", { id: k.id, enabled: !k.enabled })
                  }
                >
                  <i />
                </button>
              </div>
            ))}
          </div>
          <form
            className="add-key"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              if (
                await action(
                  "keys",
                  { label: f.get("label"), token: f.get("token") },
                  "Đã thêm API key",
                )
              )
                form.reset();
            }}
          >
            <h3>
              <Plus size={17} />
              Thêm tài khoản Apify
            </h3>
            <label>
              Tên gợi nhớ
              <input
                name="label"
                placeholder="Tài khoản 01"
                required
                maxLength={60}
              />
            </label>
            <label>
              API token
              <input
                name="token"
                type="password"
                autoComplete="new-password"
                placeholder="apify_api_…"
                required
                minLength={15}
              />
            </label>
            <button className="primary" disabled={!!busy}>
              Thêm API key
            </button>
          </form>
        </div>
      ) : (
        <div>
          <p className="hint">
            Log ghi trạng thái HTTP, lỗi hạn mức, thời gian và phí run khi Apify
            cung cấp. “Khả dụng” là trạng thái lần gọi gần nhất, không phải số
            dư tiền.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>THỜI GIAN / KEY</th>
                  <th>API / KẾT QUẢ</th>
                  <th>HTTP / MS</th>
                  <th>PHÍ RUN</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((l: Row) => (
                  <tr key={l.id}>
                    <td>
                      {date(l.created_at)}
                      <small>{l.label}</small>
                    </td>
                    <td>
                      <code>{l.operation}</code>
                      <small
                        className={l.outcome === "error" ? "error-text" : ""}
                      >
                        {l.message || l.outcome}
                      </small>
                    </td>
                    <td>
                      {l.http_status || "—"} / {l.duration_ms ?? "—"}
                    </td>
                    <td>
                      {l.cost_usd != null
                        ? "$" + Number(l.cost_usd).toFixed(4)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.logs.length && <Empty text="Chưa có lần gọi API" />}
          <h3>Chi tiết lượt quét gần nhất</h3>
          <div className="job-list">
            {data.jobs.map((j: Row) => (
              <div key={j.id}>
                <b>{j.name}</b>
                <span>{j.state}</span>
                <small>{j.reason || j.run_id || "Đang chờ"}</small>
                {j.state === "uncertain" && (
                  <form
                    style={{ gridColumn: "1 / -1" }}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await action(
                        "jobs/acknowledge",
                        { id: j.id, confirmed: true },
                        "Đã ghi nhận kiểm tra. Có thể tạo lượt quét mới.",
                      );
                    }}
                  >
                    <label className="checkbox-label">
                      <input type="checkbox" required />
                      <span>
                        Tôi đã kiểm tra tài khoản Apify và xác nhận không có
                        lượt chạy đang hoạt động cho bài này.
                      </span>
                    </label>
                    <button disabled={!!busy}>
                      Xác nhận cho phép quét lại
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
