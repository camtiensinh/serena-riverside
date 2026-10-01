"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Trophy } from "lucide-react";
import "./wheel.css";

type Entry = { id: string; name: string; team: string };
type Winner = Entry & { prize_rank: number };
type Payload = {
  state: any;
  entries: Entry[];
  winners: Winner[];
  server_time: string;
};

export default function LuckyDraw() {
  const [data, setData] = useState<Payload | null>(null),
    [rotation, setRotation] = useState(0),
    [showWinner, setShowWinner] = useState(false);
  const nonce = useRef("");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/wheel/public", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await load();
      if (!stopped) timer = setTimeout(poll, 1200);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [load]);
  const entries = data?.entries || [],
    state = data?.state || {};
  const winnerIndex = entries.findIndex((e) => e.id === state.winner_entry_id);
  useEffect(() => {
    if (
      !state.spin_nonce ||
      state.spin_nonce === nonce.current ||
      winnerIndex < 0 ||
      !entries.length
    )
      return;
    nonce.current = state.spin_nonce;
    setShowWinner(false);
    const slice = 360 / entries.length,
      target = 360 - (winnerIndex * slice + slice / 2);
    setRotation((r) => r + 360 * 8 + ((target - (r % 360) + 360) % 360));
    const elapsed = Math.max(
      0,
      Date.now() - Date.parse(state.started_at || new Date().toISOString()),
    );
    const id = setTimeout(
      () => setShowWinner(true),
      Math.max(0, 7200 - elapsed),
    );
    return () => clearTimeout(id);
  }, [state.spin_nonce, state.started_at, winnerIndex, entries.length]);
  const colors = useMemo(
    () =>
      entries.map((_, i) =>
        i % 4 === 0
          ? "#ff8597"
          : i % 4 === 1
            ? "#0bbbe8"
            : i % 4 === 2
              ? "#fff7eb"
              : "#2c8bc9",
      ),
    [entries],
  );
  const gradient = entries.length
    ? `conic-gradient(${entries.map((_, i) => `${colors[i]} ${(i * 360) / entries.length}deg ${((i + 1) * 360) / entries.length}deg`).join(",")})`
    : "conic-gradient(#23bde4,#087cc1,#ff8ba0,#23bde4)";
  return (
    <main className="lucky-stage">
      <Image
        src="/serena-riverside-kv.png"
        fill
        priority
        alt="Serena Riverside"
        className="lucky-bg"
      />
      <div className="lucky-overlay" />
      <header>
        <Image
          src="/digital gold light (1).png"
          width={250}
          height={95}
          alt="Serena Riverside"
          priority
          style={{ width: "auto", height: "auto" }}
        />
      </header>
      <section className="lucky-copy">
        <span>DÀNH CHO CHUYÊN VIÊN TƯ VẤN</span>
        <h1>
          VÒNG QUAY
          <br />
          <em>SERENA</em>
        </h1>
      </section>
      <section className="wheel-wrap">
        <div className="wheel-pointer" />
        <div
          className="wheel"
          style={{ background: gradient, transform: `rotate(${rotation}deg)` }}
        >
          <div className="wheel-rim" />
          <div className="wheel-center">
            <Sparkles />
          </div>
        </div>
        <div className="wheel-count">
          {entries.length || 0}
          <small>KHÁCH HÀNG</small>
        </div>
      </section>
      {showWinner && state.winner_name && (
        <div className="winner-reveal">
          <Trophy />
          <span>CHÚC MỪNG GIẢI {state.prize_rank}</span>
          <h2>{state.winner_name}</h2>
          <p>{state.winner_team}</p>
        </div>
      )}
    </main>
  );
}
