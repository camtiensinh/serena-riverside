"use client";
import { useEffect, useState } from "react";
import EventLogo from "@/components/event-logo";
import { Globe, Heart, MessageCircle, Share2, Trophy } from "lucide-react";
import { api, number, date } from "@/lib/client";
import { FacebookAvatar } from "@/components/post-media";
import PostCollage from "@/components/post-collage";
import "./awards.css";
type Entry = {
  id: string;
  name: string;
  author?: string;
  avatar?: string;
  team: string;
  content?: string;
  media?: unknown;
  likes: number;
  reactions: number;
  comments: number;
  shares: number;
  posted_at?: string;
};
type Data = {
  settings: {
    published: Entry[] | null;
    published_at?: string;
    display_mode?: "auto" | "waiting" | "results";
    display_started_at?: string;
    display_rank?: number | null;
    metric: "likes" | "reactions";
  };
  leaderboard: Entry[];
  server_time: string;
};
export default function Live() {
  const [data, setData] = useState<Data | null>(null),
    [clock, setClock] = useState({ server: 0, received: 0 }),
    [now, setNow] = useState(0);
  useEffect(() => {
    let alive = true,
      fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const d = await api("public");
        if (alive) {
          setData(d);
          setClock({
            server: Date.parse(d.server_time),
            received: performance.now(),
          });
        }
      } catch {
        /* Retain the last confirmed ceremony on connection loss. */
      } finally {
        fetching = false;
      }
    }
    refresh();
    const polling = setInterval(refresh, 1000),
      timer = setInterval(() => setNow(performance.now()), 100);
    return () => {
      alive = false;
      clearInterval(polling);
      clearInterval(timer);
    };
  }, []);
  const published =
    !!data?.settings.display_started_at &&
    data?.settings.display_mode !== "waiting";
  const entries = published ? data!.leaderboard.slice(0, 5) : [];
  const elapsed = published
    ? Math.max(
        0,
        clock.server +
          Math.max(0, now - clock.received) -
          Date.parse(
            data!.settings.display_started_at || data!.settings.published_at!,
          ),
      )
    : 0;
  const directResults = data?.settings.display_mode === "results";
  const countdown = published && !directResults && elapsed < 10000;
  // Countdown always lands on rank 5. Later ranks remain admin-controlled.
  const manualRank = directResults
    ? data?.settings.display_rank
    : published && !countdown
      ? 5
      : null;
  const reveal = manualRank ? entries.length - manualRank : -1;
  const final = published && !countdown && !manualRank && directResults;
  const activeIndex = manualRank ? manualRank - 1 : 0;
  const active = !countdown ? entries[activeIndex] : undefined;
  const metric = "reactions" as const;
  return (
    <div className="awards-screen">
      <div className="awards-water" />
      <header className="awards-header">
        <EventLogo />
      </header>
      {!published ||
      (!countdown && (!entries.length || (!manualRank && !directResults))) ? (
        <main className="awards-waiting">
          <span>SERENA RIVERSIDE</span>
          <h1>KHƠI DÒNG</h1>
          <div className="waiting-ripple" />
        </main>
      ) : countdown ? (
        <main className="awards-countdown">
          <p>KHOẢNH KHẮC VINH DANH</p>
          <strong key={Math.ceil((10000 - elapsed) / 1000)}>
            {Math.ceil((10000 - elapsed) / 1000)}
          </strong>
          <h1>TOP 5 BÀI VIẾT ĐẠT GIẢI</h1>
        </main>
      ) : (
        <main className="awards-show">
          <section className="award-feature" key={active?.id}>
            <div className="award-announcement">
              <Trophy />
              <span>{final ? "VINH DANH TOP 5" : "CHÚC MỪNG"}</span>
              <h1>HẠNG {activeIndex + 1}</h1>
              <h2>{active?.name}</h2>
              <p>{active?.team}</p>
            </div>
            {active && (
              <article className="award-post">
                <div className="award-post-header">
                  <FacebookAvatar
                    key={active.id}
                    src={active.avatar}
                    name={active.author || active.name}
                  />
                  <div>
                    <b>{active.author || active.name}</b>
                    <small>
                      {date(active.posted_at)} · <Globe size={12} />
                    </small>
                  </div>
                </div>
                <div className="award-post-content">{active.content}</div>
                <PostCollage key={active.id} media={active.media} />
                <div className="award-metrics">
                  <span>
                    <Heart fill="currentColor" />
                    {number(active.reactions)}
                    <small>Cảm xúc</small>
                  </span>
                  <span>
                    <MessageCircle />
                    {number(active.comments)}
                    <small>Bình luận</small>
                  </span>
                  <span>
                    <Share2 />
                    {number(active.shares)}
                    <small>Chia sẻ</small>
                  </span>
                </div>
              </article>
            )}
          </section>
          <section className="award-podium" aria-label="Top 5 đạt giải">
            {entries.map((entry, i) => {
              const shown = final || i >= entries.length - 1 - reveal;
              return (
                <div
                  key={entry.id}
                  className={`award-place place-${i + 1} ${shown ? "revealed" : "concealed"} ${active?.id === entry.id ? "featured" : ""}`}
                >
                  <span className="place-rank">{i + 1}</span>
                  {shown ? (
                    <>
                      <FacebookAvatar
                        src={entry.avatar}
                        name={entry.author || entry.name}
                      />
                      <b>{entry.name}</b>
                      <small>{number(entry[metric])} CẢM XÚC</small>
                    </>
                  ) : (
                    <span className="place-mystery">✦</span>
                  )}
                </div>
              );
            })}
          </section>
        </main>
      )}
      {published && !countdown && (
        <div className="award-confetti" aria-hidden="true">
          {Array.from({ length: 40 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                animationDelay: `${i % 9}s`,
                background: i % 2 ? "#d7ac53" : "#b7f1ff",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
