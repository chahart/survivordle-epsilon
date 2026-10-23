import { useEffect, useRef, useState } from "react";
import { fetchRankLeaderboard } from "../shared/rankApi";
import { subOf, barColors } from "../shared/rank";
import { renderRankImage, shareOrDownloadImage } from "../shared/rankImage";

// Text-only on purpose (no contestant photos). Tribe colors are just an accent.
// A season shows one stripe per starting tribe, the winner's tribe on top.
export function Bar({ w }) {
  const cols = barColors(w);
  const step = 100 / cols.length;
  const bg = `linear-gradient(to bottom, ${cols.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(", ")})`;
  return <span className="rk-bar" style={{ background: bg }} />;
}

export const RANK_CSS = `
  .rk { --rk-accent: #e8742a; max-width: 640px; margin: 0 auto; padding: 8px 4px 40px; color: var(--text); } /* swap this one variable to re-theme (e.g. BB) */
  .rk h1 { font-family: 'Bebas Neue', sans-serif; font-size: 44px; letter-spacing: 2px; text-align: center; margin: 12px 0 4px; color: var(--rk-accent); }
  .rk h1::after { content: ''; display: block; width: 56px; height: 4px; border-radius: 2px; background: var(--rk-accent); margin: 8px auto 0; }
  .rk .rk-sub { text-align: center; color: var(--text3); font-size: 14px; margin-bottom: 18px; }
  .rk-btn { padding: 10px 16px; font-size: 15px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg3); color: var(--text); cursor: pointer; font-family: inherit; }
  .rk-btn:hover { background: var(--bg2); border-color: var(--rk-accent); }
  .rk-btn.primary { background: var(--rk-accent); color: #1a1a1a; border-color: var(--rk-accent); }
  .rk-btn.primary:hover { filter: brightness(1.08); }
  .rk-btn.small { padding: 5px 10px; font-size: 13px; font-weight: 500; }
  .rk-btn:disabled { opacity: .4; cursor: default; }
  .rk-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 10px 0; }
  .rk-q { text-align: center; font-size: 20px; font-weight: 600; margin: 8px 0 14px; }
  .rk-vs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rk-pick { position: relative; overflow: hidden; text-align: left; padding: 22px 16px 22px 24px; border-radius: 12px; border: 1px solid var(--border);
    background: var(--bg2); color: var(--text); cursor: pointer; font-family: inherit;
    min-height: 120px; transition: transform .08s, background .12s; }
  .rk-pick:hover { background: var(--bg3); border-color: var(--rk-accent); }
  .rk-pick:active { transform: scale(.98); }
  .rk-pick .nm { font-size: 20px; font-weight: 600; line-height: 1.2; }
  .rk-pick .se { font-size: 13px; color: var(--text3); margin-top: 6px; }
  .rk-pick .se.top { margin: 0 0 6px; }
  .rk-list { list-style: none; border: 1px solid var(--rk-accent); border-radius: 10px; overflow: hidden; }
  .rk-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border2);
    position: relative; padding-left: 18px; background: var(--bg2); font-size: 15px; }
  .rk-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
  .rk-item:last-child { border-bottom: none; }
  .rk-item .pos { width: 28px; text-align: right; color: var(--rk-accent); font-weight: 700; font-variant-numeric: tabular-nums; }
  .rk-item .nm { flex: 1; font-weight: 600; }
  .rk-item .se { color: var(--text3); font-size: 12px; }
  .rk-item .sc { color: var(--rk-accent); font-weight: 600; font-size: 13px; font-variant-numeric: tabular-nums; }
  .rk-item .mv { display: flex; gap: 4px; }
  .rk-h2 { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 1.5px; margin: 26px 0 8px; color: var(--rk-accent); }
  .rk-label { color: var(--text); font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin: 14px 0 6px; }
  .rk-link { background: none; border: none; color: var(--rk-accent); font-size: 12px; text-decoration: underline;
    cursor: pointer; font-family: inherit; padding: 2px; }
  .rk-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin: 10px 0 16px; }
  .rk-chip { text-align: left; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg2);
    color: var(--text3); font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rk-chip b { color: var(--text2); margin-right: 3px; }
  .rk-chip:hover { border-color: var(--rk-accent); }
  .rk-chip.on { border-color: var(--rk-accent); box-shadow: inset 0 0 0 1px var(--rk-accent); color: var(--text); font-weight: 700; }
  .rk-chip.on b { color: var(--rk-accent); }
  .rk-big { display: block; width: 100%; text-align: left; padding: 22px 18px; margin: 12px 0; border-radius: 12px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--text); cursor: pointer; font-family: inherit; }
  .rk-big { border-left: 6px solid var(--rk-accent); }
  .rk-big:hover { background: var(--bg3); border-color: var(--rk-accent); }
  .rk-big .t { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 1.5px; color: var(--rk-accent); }
  .rk-big .d { color: var(--text3); font-size: 14px; margin-top: 2px; }
  .rk-static { cursor: default; min-height: 0; }
  .rk-static:hover { background: var(--bg2); border-color: var(--border); }
  .rk-static:active { transform: none; }
  .rk-flip { perspective: 900px; }
  .rk-flip-in { display: grid; transform-style: preserve-3d; transition: transform .5s cubic-bezier(.3, .7, .2, 1); }
  .rk-flip-in.open { transform: rotateY(180deg); }
  .rk-flip-in > * { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  .rk-flip-in > .front { transform: rotateY(180deg); }
  .rk-back { display: flex; align-items: center; justify-content: center; background: var(--rk-accent); border-color: var(--rk-accent);
    color: #1a1a1a; font-family: 'Bebas Neue', sans-serif; font-size: 64px; }
  .rk-back:hover { background: var(--rk-accent); border-color: var(--rk-accent); }
  @media (prefers-reduced-motion: reduce) { .rk-flip-in { transition: none; } }
  .rk-slot { flex: 1; text-align: left; background: none; border: 1px dashed var(--border); border-radius: 6px; padding: 6px 10px;
    color: var(--text3); font-family: inherit; font-size: 14px; cursor: pointer; }
  .rk-slot:hover:not(:disabled) { border-color: var(--rk-accent); color: var(--text); }
  .rk-slot:disabled { cursor: default; opacity: .5; }
  .rk-tent { outline: 2px solid var(--rk-accent); outline-offset: -2px; }
  .rk-note { color: var(--text3); font-size: 13px; text-align: center; margin: 10px 0; }
  @media (max-width: 480px) {
    .rk-vs { grid-template-columns: 1fr; }
    .rk-pick { min-height: 90px; padding: 16px 14px 16px 22px; }
    .rk-item .se { display: none; }
  }
`;

export function WinnerLine({ w }) {
  return (
    <>
      <span className="nm">{w.name}</span>
      <span className="se">{subOf(w)}</span>
    </>
  );
}

// Text card for one season / winner (shared by matchups and Blind ranking).
export function CardBody({ w }) {
  return (
    <>
      <Bar w={w} />
      {w.winner === undefined ? (
        <>
          <div className="nm">{w.name}</div>
          <div className="se">Season {w.season} · {w.seasonName}</div>
        </>
      ) : (
        <>
          <div className="se top">Season {w.season}</div>
          <div className="nm">{w.name}</div>
          {w.winner && <div className="se">Winner: {w.winner}</div>}
        </>
      )}
    </>
  );
}

export function Matchup({ cur, other, flip, question, onChoose }) {
  const side = (w, code) => (
    <button className="rk-pick" onClick={() => onChoose(code)}>
      <CardBody w={w} />
    </button>
  );
  // Which side each one lands on is random (seeded by the engine).
  return (
    <>
      <div className="rk-q">{question}</div>
      <div className="rk-vs">
        {flip ? side(cur, "w") : side(other, "l")}
        {flip ? side(other, "l") : side(cur, "w")}
      </div>
      <div className="rk-row" style={{ marginTop: 14 }}>
        <button className="rk-btn small" onClick={() => onChoose("?")}>I don't know</button>
      </div>
    </>
  );
}

export function RankList({ ids, byId, onMove, scores }) {
  return (
    <ol className="rk-list">
      {ids.map((id, i) => {
        const w = byId.get(id);
        if (!w) return null;
        return (
          <li key={id} className="rk-item">
            <Bar w={w} />
            <span className="pos">{i + 1}</span>
            <WinnerLine w={w} />
            {scores && <span className="sc">{scores[i]}</span>}
            {onMove && (
              <span className="mv">
                <button className="rk-btn small" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label="Move up">↑</button>
                <button className="rk-btn small" disabled={i === ids.length - 1} onClick={() => onMove(i, i + 1)} aria-label="Move down">↓</button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Leaderboard({ kind, bySeason, top }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = failed
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    fetchRankLeaderboard(kind).then(d => { if (live) setData(d); });
    return () => { live = false; };
  }, [kind]);

  if (data === undefined) return <div className="rk-note">Loading the consensus…</div>;
  if (data === null) return <div className="rk-note">Leaderboard unavailable right now.</div>;
  if (!data.rows.length) return <div className="rk-note">No rankings yet. Be the first!</div>;

  const rows = data.rows.filter(r => bySeason.has(r.season));
  const shown = all ? rows : rows.slice(0, top || 10);
  const ids = shown.map(r => bySeason.get(r.season).id);
  const lookup = new Map(shown.map(r => [bySeason.get(r.season).id, bySeason.get(r.season)]));
  const scores = shown.map(r => `${Math.round((1 - r.avgPct) * 100)}`);

  return (
    <>
      <RankList ids={ids} byId={lookup} scores={scores} />
      <div className="rk-note">
        {top ? "Based on" : "Consensus score out of 100 · based on"} {data.total.toLocaleString()} ranking{data.total === 1 ? "" : "s"}
      </div>
      {!top && rows.length > 10 && (
        <div className="rk-row">
          <button className="rk-btn small" onClick={() => setAll(a => !a)}>{all ? "Show top 10" : `Show all ${rows.length}`}</button>
        </div>
      )}
    </>
  );
}

// Season picker shown before ranking starts. `seasons` = [{ season, seasonName }].
const RANGES = [[1, 20], [21, 40], [41, 99]];

export function SeasonPicker({ seasons, selected, onChange }) {
  const toggle = n => onChange(selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n]);
  const toggleRange = ([a, b]) => {
    const inRange = seasons.map(x => x.season).filter(n => n >= a && n <= b);
    const all = inRange.every(n => selected.includes(n));
    onChange(all ? selected.filter(n => !inRange.includes(n)) : [...new Set([...selected, ...inRange])]);
  };
  const last = seasons[seasons.length - 1]?.season;
  return (
    <>
      <div className="rk-row">
        <button className="rk-btn small" onClick={() => onChange(seasons.map(x => x.season))}>All</button>
        <button className="rk-btn small" onClick={() => onChange([])}>None</button>
        {RANGES.filter(([a]) => a <= last).map(r => (
          <button key={r[0]} className="rk-btn small" onClick={() => toggleRange(r)}>
            {r[0]}–{Math.min(r[1], last)}
          </button>
        ))}
      </div>
      <div className="rk-chips">
        {seasons.map(x => (
          <button
            key={x.season}
            className={`rk-chip${selected.includes(x.season) ? " on" : ""}`}
            aria-pressed={selected.includes(x.season)}
            onClick={() => toggle(x.season)}
          >
            <b>{x.season}</b> {x.seasonName}
          </button>
        ))}
      </div>
    </>
  );
}

// Copy-text and image sharing for a finished (or partial) ranking.
export function ShareButtons({ ranking, byId, cfg, kind, blind }) {
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const sizes = ranking.length > 10 ? [10, 0] : [0];
  const word = blind ? "blind " : "";

  async function share(count) {
    const top = count ? ranking.slice(0, count) : ranking;
    const text = [
      count ? `My top ${top.length} ${cfg.noun} 🏝️` : `My ${word}${cfg.noun} ranking 🏝️`,
      "",
      ...top.map((id, i) => `${i + 1}. ${cfg.line(byId.get(id))}`),
      "",
      "survivordle.com/rank",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(count);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }

  async function shareImage(count) {
    setBusy(count);
    try {
      const ids = count ? ranking.slice(0, count) : ranking;
      const title = count ? `My Top ${ids.length}` : blind ? "My Blind Ranking" : "My Ranking";
      const light = !!document.querySelector(".light");
      const blob = await renderRankImage(ids, byId, { title, subtitle: cfg.noun, light });
      await shareOrDownloadImage(blob, count ? `survivor-${kind}-top-${ids.length}.png` : `survivor-${kind}-${word ? "blind-" : ""}ranking.png`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="rk-h2">Share</div>
      <div className="rk-row">
        {sizes.map(c => (
          <button key={c} className="rk-btn" onClick={() => share(c)}>
            {copied === c ? "Copied!" : c ? `Copy top ${c}` : sizes.length > 1 ? "Copy full ranking" : "Copy ranking"}
          </button>
        ))}
      </div>
      <div className="rk-row">
        {sizes.map(c => (
          <button key={c} className="rk-btn" disabled={busy !== null} onClick={() => shareImage(c)}>
            {busy === c ? "Making image…" : c ? `Image: top ${c}` : sizes.length > 1 ? "Image: full ranking" : "Image"}
          </button>
        ))}
      </div>
    </>
  );
}
