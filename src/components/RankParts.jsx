import { useEffect, useState } from "react";
import { fetchRankLeaderboard } from "../shared/rankApi";

// Text-only on purpose (no contestant photos). Tribe color is just an accent.
const TRIBE_HEX = {
  "Magenta": "#c0306a", "Red": "#c0392b", "Orange": "#d9822b", "Yellow/Gold": "#d4a72c",
  "Purple": "#7d4fb0", "Blue/Teal": "#2a8fa8", "Green": "#3d8f4f", "Brown": "#8a6040",
};
const tribeHex = w => TRIBE_HEX[w?.tribe_color] || "var(--text3)";

export const RANK_CSS = `
  .rk { max-width: 640px; margin: 0 auto; padding: 8px 4px 40px; color: var(--text); }
  .rk h1 { font-family: 'Bebas Neue', sans-serif; font-size: 40px; letter-spacing: 2px; text-align: center; margin: 12px 0 4px; }
  .rk .rk-sub { text-align: center; color: var(--text3); font-size: 14px; margin-bottom: 18px; }
  .rk-btn { padding: 10px 16px; font-size: 15px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg3); color: var(--text); cursor: pointer; font-family: inherit; }
  .rk-btn:hover { background: var(--bg2); }
  .rk-btn.primary { background: var(--text); color: var(--bg); border-color: var(--text); }
  .rk-btn.small { padding: 5px 10px; font-size: 13px; font-weight: 500; }
  .rk-btn:disabled { opacity: .4; cursor: default; }
  .rk-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 10px 0; }
  .rk-q { text-align: center; font-size: 20px; font-weight: 600; margin: 8px 0 14px; }
  .rk-vs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rk-card { display: flex; flex-direction: column; gap: 8px; }
  .rk-pick { text-align: left; padding: 22px 16px; border-radius: 12px; border: 1px solid var(--border);
    border-left-width: 6px; background: var(--bg2); color: var(--text); cursor: pointer; font-family: inherit;
    min-height: 120px; transition: transform .08s, background .12s; }
  .rk-pick:hover { background: var(--bg3); }
  .rk-pick:active { transform: scale(.98); }
  .rk-pick .nm { font-size: 20px; font-weight: 600; line-height: 1.2; }
  .rk-pick .se { font-size: 13px; color: var(--text3); margin-top: 6px; }
  .rk-link { background: none; border: none; color: var(--text3); font-size: 12px; text-decoration: underline;
    cursor: pointer; font-family: inherit; padding: 2px; }
  .rk-prog { height: 6px; border-radius: 3px; background: var(--bg3); overflow: hidden; margin: 6px 0 4px; }
  .rk-prog > div { height: 100%; background: var(--text3); transition: width .2s; }
  .rk-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text3); margin-bottom: 14px; }
  .rk-list { list-style: none; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .rk-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border2);
    border-left: 5px solid transparent; background: var(--bg2); font-size: 15px; }
  .rk-item:last-child { border-bottom: none; }
  .rk-item .pos { width: 28px; text-align: right; color: var(--text3); font-variant-numeric: tabular-nums; }
  .rk-item .nm { flex: 1; font-weight: 600; }
  .rk-item .se { color: var(--text3); font-size: 12px; }
  .rk-item .sc { color: var(--text2); font-size: 13px; font-variant-numeric: tabular-nums; }
  .rk-item .mv { display: flex; gap: 4px; }
  .rk-h2 { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 1.5px; margin: 26px 0 8px; }
  .rk-note { color: var(--text3); font-size: 13px; text-align: center; margin: 10px 0; }
  @media (max-width: 480px) {
    .rk-vs { grid-template-columns: 1fr; }
    .rk-pick { min-height: 90px; padding: 16px 14px; }
    .rk-item .se { display: none; }
  }
`;

export function WinnerLine({ w }) {
  return (
    <>
      <span className="nm">{w.name}</span>
      <span className="se">S{w.season} · {w.seasonName}</span>
    </>
  );
}

export function Matchup({ cur, other, flip, onPick, onSkip }) {
  const side = (w, code, winCode) => (
    <div className="rk-card">
      <button className="rk-pick" style={{ borderLeftColor: tribeHex(w) }} onClick={() => onPick(winCode)}>
        <div className="nm">{w.name}</div>
        <div className="se">Season {w.season} · {w.seasonName}</div>
      </button>
      <button className="rk-link" onClick={() => onSkip(code)}>Haven't seen this season</button>
    </div>
  );
  // Which side each winner lands on is random (seeded by the engine).
  const curLeft = flip;
  const a = curLeft ? side(cur, "sc", "w") : side(other, "so", "l");
  const b = curLeft ? side(other, "so", "l") : side(cur, "sc", "w");
  return (
    <>
      <div className="rk-q">Who's the better winner?</div>
      <div className="rk-vs">{a}{b}</div>
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
          <li key={id} className="rk-item" style={{ borderLeftColor: tribeHex(w) }}>
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

export function Leaderboard({ bySeason }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = failed
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    fetchRankLeaderboard().then(d => { if (live) setData(d); });
    return () => { live = false; };
  }, []);

  if (data === undefined) return <div className="rk-note">Loading the consensus…</div>;
  if (data === null) return <div className="rk-note">Leaderboard unavailable right now.</div>;
  if (!data.rows.length) return <div className="rk-note">No rankings yet. Be the first!</div>;

  const rows = data.rows.filter(r => bySeason.has(r.season));
  const shown = all ? rows : rows.slice(0, 10);
  const ids = shown.map(r => bySeason.get(r.season).id);
  const lookup = new Map(shown.map(r => [bySeason.get(r.season).id, bySeason.get(r.season)]));
  const scores = shown.map(r => `${Math.round((1 - r.avgPct) * 100)}`);

  return (
    <>
      <RankList ids={ids} byId={lookup} scores={scores} />
      <div className="rk-note">
        Consensus score out of 100 · based on {data.total.toLocaleString()} ranking{data.total === 1 ? "" : "s"}
      </div>
      {rows.length > 10 && (
        <div className="rk-row">
          <button className="rk-btn small" onClick={() => setAll(a => !a)}>{all ? "Show top 10" : `Show all ${rows.length}`}</button>
        </div>
      )}
    </>
  );
}
