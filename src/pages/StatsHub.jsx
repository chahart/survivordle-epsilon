import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useSEO from "../shared/useSEO";
import { RecallStatsTab, RecallRankings, RecallRankCol } from "../shared/recallStats";
import { fetchConnectionsGlobalStats } from "../shared/supabase";
import { getDailyConnectionsPuzzle, getPastConnectionsPuzzles } from "../shared/connectionsLogic";
// New stats hub (Rank testers only for now). One place for every stat:
// pick a show, a game, then You (this device) or Everyone.
// ?tab=<game>&view=all deep-links; old ?tab values (my/daily/global) still land somewhere sensible.
const LEGACY = { my: ["wordle", "you"], daily: ["wordle", "all"], global: ["wordle", "all"] };

// Panels come from Stats.jsx so the numbers stay identical to the classic page.
export default function StatsHub({ show, SHOWS, MyStatsTab, DailyTab, GlobalTab, SandwichGlobal, ConnectionsTab }) {
  const cfg = SHOWS[show];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const games = [
    ["wordle", "Daily"], ["recall", "Recall"], ["sandwich", "Sandwich"],
    ...(show === "sv" ? [["connections", "Connections"]] : []),
  ];
  const [legacyGame, legacyView] = LEGACY[params.get("tab")] || [];
  const game = legacyGame || (games.some(([k]) => k === params.get("tab")) ? params.get("tab") : "wordle");
  const view = legacyView || (params.get("view") === "all" ? "all" : "you");

  const [dailyData,     setDailyData]     = useState(null);
  const [globalData,    setGlobalData]    = useState(null);
  const [loadingDaily,  setLoadingDaily]  = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  function loadDaily()  { setLoadingDaily(true);  cfg.fetchDaily().then(d  => { setDailyData(d);  setLoadingDaily(false);  }); }
  function loadGlobal() { setLoadingGlobal(true); cfg.fetchGlobal().then(d => { setGlobalData(d); setLoadingGlobal(false); }); }
  useEffect(() => { loadDaily(); loadGlobal(); }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  useSEO({ title: cfg.seoTitle, description: cfg.seoDesc, canonical: `https://survivordle.com${cfg.path}` });

  const query = (g, v) => ({ ...(g !== "wordle" && { tab: g }), ...(v === "all" && { view: "all" }) });
  const go = (g, v) => setParams(query(g, v), { replace: true });
  const swapShow = to => {
    const q = new URLSearchParams(query(to === "bb" && game === "connections" ? "wordle" : game, view)).toString();
    navigate(`${SHOWS[to].path}${q ? `?${q}` : ""}`);
  };

  let panel;
  if (view === "you") {
    panel = game === "wordle"   ? <MyStatsTab cfg={cfg} part="wordle" plain />
          : game === "recall"   ? <RecallStatsTab show={show} />
          : game === "sandwich" ? <MyStatsTab cfg={cfg} part="sandwich" plain />
          :                       <ConnectionsTab plain />;
  } else {
    panel = game === "wordle" ? (
      <>
        <DailyTab cfg={cfg} data={dailyData} loading={loadingDaily} onRetry={loadDaily} />
        <div className="stats-divider" />
        <GlobalTab show={show} data={globalData} loading={loadingGlobal} onRetry={loadGlobal} dailyOnly />
      </>
    ) : game === "recall"   ? <div className="stats-page-body"><RecallRankings show={show} /></div>
      : game === "sandwich" ? <div className="stats-page-body"><SandwichGlobal show={show} plain /></div>
      : <ConnectionsGlobal />;
  }

  return (
    <div className={`sx${show === "bb" ? " bb-theme" : ""}`}>
      <style>{SX_CSS}</style>
      <header className="sx-head">
        <h1 className="sx-title">Stats</h1>
        <p className="sx-blurb">How you stack up against everyone</p>
      </header>

      <Seg label="Show" className="sx-show" value={show} options={[["sv", "Survivor"], ["bb", "Big Brother"]]}
        onChange={k => k !== show && swapShow(k)} />

      <nav className="sx-games" role="tablist" aria-label="Game">
        {games.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={game === k} className={game === k ? "on" : ""}
            onClick={() => go(k, view)}>{label}</button>
        ))}
      </nav>

      <div className="sx-scope">
        <Seg label="Whose stats" className="sx-view" value={view} options={[["you", "You"], ["all", "Everyone"]]}
          onChange={k => go(game, k)} />
        <span className="sx-scope-note">{view === "you" ? "Saved on this device" : "Every player, all time"}</span>
      </div>

      <div className="sx-panel" key={`${show}-${game}-${view}`}>{panel}</div>
    </div>
  );
}

// 21,755 → "21K", 1,250,000 → "1.3M" (same rounding as the other global stats).
function k(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${Math.floor(num / 1000)}K`;
  return num.toLocaleString();
}

// Difficulty → name + tile color, matching .cx-diff-1..4 in styles.js.
const CX_COLORS = [["1", "Green", "#4aaa4a"], ["2", "Orange", "#e8742a"], ["3", "Purple", "#9a5cc4"], ["4", "Red", "#b3392c"]];

// Weekly Connections, every player. Shows the "on the way" note until the SQL function exists.
function ConnectionsGlobal() {
  const [data, setData] = useState(undefined);
  useEffect(() => { fetchConnectionsGlobalStats().then(setData); }, []);
  if (data === undefined) return <div className="loading">Loading global stats…</div>;
  const games = Number(data?.total_games || 0);
  if (!games) return <p className="sx-empty">Global Connections stats are on the way.</p>;

  const wins = Number(data.total_wins || 0);
  const pct = n => `${Math.round((100 * Number(n)) / games)}%`;
  const dist = data.mistake_dist || {};
  const distMax = Math.max(...Object.values(dist).map(Number), 1);
  const live = getDailyConnectionsPuzzle();
  const titles = Object.fromEntries([...(live ? [live] : []), ...getPastConnectionsPuzzles()].map(p => [p.puzzleNumber, p.title]));
  // Easiest/hardest weekly puzzles by solve rate; 30+ plays so a tiny sample can't top the list.
  const ranked = (data.puzzles || []).filter(p => Number(p.plays) >= 30)
    .map(p => ({ puzzle: titles[p.week_num] || `Puzzle #${p.week_num}`, avg_score: Number(p.win_pct) }))
    .sort((a, b) => b.avg_score - a.avg_score);
  const easiest = ranked.slice(0, 3);
  const hardest = ranked.slice(easiest.length).reverse().slice(0, 3);
  const custom = data.custom || {};

  return (
    <div className="stats-page-body">
      <div className="sp-section-title">All time</div>
      <div className="stats-grid">
        {[
          [k(games), "Games Played"],
          [pct(wins), "Solve Rate"],
          [pct(data.perfect || 0), "No Mistakes"],
          [`${data.hint_pct ?? 0}%`, "Used a Hint"],
        ].map(([val, lbl]) => (
          <div className="stats-grid-item" key={lbl}>
            <span className="stats-grid-num">{val}</span>
            <span className="stats-grid-label">{lbl}</span>
          </div>
        ))}
      </div>
      {(() => {
        const first = data.first_dist || {};
        const total = Object.values(first).reduce((t, c) => t + Number(c), 0);
        if (!total) return null;
        const max = Math.max(...Object.values(first).map(Number), 1);
        return (
          <>
            <div className="sp-sub-title">First group found</div>
            {CX_COLORS.map(([d, name, color]) => {
              const count = Number(first[d] || 0);
              return (
                <div key={d} className="stat-row sx-cx-row">
                  <span className="sx-cx-label">{name}</span>
                  <div className="stat-bar-wrap">
                    <div className="stat-bar" style={{ width: count > 0 ? `${Math.max(Math.round((count / max) * 100), 4)}%` : "0%", background: color }}>
                      {count > 0 && <span className="stat-bar-count">{Math.round((100 * count) / total)}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        );
      })()}

      {wins > 0 && (
        <>
          <div className="sp-sub-title">Mistakes in a win</div>
          {[0, 1, 2, 3].map(n => {
            const count = Number(dist[n] || 0);
            return (
              <div key={n} className="stat-row">
                <span className="stat-label">{n}</span>
                <div className="stat-bar-wrap">
                  <div className={`stat-bar${count === distMax ? " best" : ""}`}
                    style={{ width: count > 0 ? `${Math.max(Math.round((count / distMax) * 100), 4)}%` : "0%" }}>
                    {count > 0 && <span className="stat-bar-count">{Math.round((100 * count) / wins)}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {easiest.length > 0 && (
        <>
          <div className="sp-sub-title">Solve rate by puzzle</div>
          <div className="sx-two">
            <RecallRankCol title="Easiest" rows={easiest} color="#4aaa4a" />
            {hardest.length > 0 && <RecallRankCol title="Hardest" rows={hardest} color="#e05040" />}
          </div>
        </>
      )}

      {Number(custom.created) > 0 && (
        <>
          <div className="stats-divider" />
          <div className="sp-section-title">Custom & community</div>
          <div className="stats-grid">
            {[
              [k(custom.created), "Puzzles Made"],
              [k(custom.community || 0), "In Community"],
              [k(custom.community_games || 0), "Community Plays"],
              [custom.games ? `${Math.round((100 * custom.wins) / custom.games)}%` : "—", "Solve Rate"],
            ].map(([val, lbl]) => (
              <div className="stats-grid-item" key={lbl}>
                <span className="stats-grid-num">{val}</span>
                <span className="stats-grid-label">{lbl}</span>
              </div>
            ))}
          </div>
          <div className="sx-two">
            <CommunityList title="Most played" rows={custom.most_played} />
            <CommunityList title="Toughest" rows={custom.hardest} stat={r => `${r.win_pct}% solved`} />
          </div>
        </>
      )}
    </div>
  );
}

// Community puzzle rows link straight to the puzzle.
function CommunityList({ title, rows, stat }) {
  if (!rows?.length) return null;
  return (
    <div>
      <div className="sp-sub-title">{title}</div>
      {rows.map(r => (
        <Link key={r.code} to={`/connections/custom/${r.code}`} className="sx-cm-row">
          <span className="sx-cm-title">{r.title || "Untitled"}{r.author && <span className="sx-cm-by"> by {r.author}</span>}</span>
          {stat && <span className="sx-cm-stat">{stat(r)}</span>}
        </Link>
      ))}
    </div>
  );
}

function Seg({ label, className, value, options, onChange }) {
  const i = options.findIndex(([k]) => k === value);
  return (
    <div className={`sx-seg ${className}`} role="tablist" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? "on" : ""}
          onClick={() => onChange(k)}>{text}</button>
      ))}
      <span className="sx-seg-pill" style={{ transform: `translateX(${i * 100}%)` }} />
    </div>
  );
}

const SX_CSS = `
  .sx { max-width: 680px; margin: 0 auto; padding: 8px 0 40px; }
  .sx-head { text-align: center; margin: 8px 0 18px; }
  .sx-title { margin: 0; font: 400 44px/1 'Bebas Neue', sans-serif; letter-spacing: 3px; color: var(--brand); }
  .sx-blurb { margin: 6px 0 0; font: 500 14px 'DM Sans', sans-serif; color: var(--text3); }

  /* Segmented controls (same feel as the menu sheet) */
  .sx-seg {
    position: relative; display: grid; grid-template-columns: 1fr 1fr;
    padding: 4px; border-radius: 12px; background: var(--bg3);
  }
  .sx-seg button {
    position: relative; z-index: 1; border: 0; background: none; padding: 9px 0; min-height: 40px;
    font: 600 14px 'DM Sans', sans-serif; color: var(--text3); cursor: pointer; transition: color .2s;
  }
  .sx-seg button.on { color: var(--text); }
  .sx-seg-pill {
    position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px);
    border-radius: 9px; background: var(--bg); box-shadow: 0 1px 4px var(--shadow);
    transition: transform .25s var(--press-ease);
  }
  .sx-show { max-width: 360px; margin: 0 auto 18px; }

  /* Game tabs: underline, scrolls sideways on small phones */
  .sx-games {
    display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
    border-bottom: 1px solid var(--border2); margin-bottom: 16px;
  }
  .sx-games::-webkit-scrollbar { display: none; }
  .sx-games button {
    flex: 1 0 auto; border: 0; background: none; cursor: pointer; padding: 12px 14px;
    font: 600 14px 'DM Sans', sans-serif; color: var(--text3);
    border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s, border-color .15s;
  }
  .sx-games button:hover { color: var(--text); }
  .sx-games button.on { color: var(--brand); border-bottom-color: var(--brand); }

  .sx-scope { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .sx-view { width: 220px; flex-shrink: 0; }
  .sx-view button.on { color: var(--brand); }
  .sx-scope-note { font: 500 12.5px 'DM Sans', sans-serif; color: var(--text3); }

  .sx-panel { animation: sx-in .22s var(--press-ease) both; }
  @keyframes sx-in { from { opacity: 0; transform: translateY(4px); } }
  .sx-cx-label { width: 52px; flex-shrink: 0; text-align: right; font: 600 11px 'DM Sans', sans-serif; letter-spacing: .8px; text-transform: uppercase; color: var(--text3); }
  .sx-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 479px) { .sx-two { grid-template-columns: 1fr; gap: 4px; } }
  .sx-cm-row {
    display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
    padding: 7px 0; border-bottom: 1px solid var(--border2); text-decoration: none;
  }
  .sx-cm-row:hover .sx-cm-title { color: var(--brand); }
  .sx-cm-title { font: 500 13px 'DM Sans', sans-serif; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sx-cm-by { color: var(--text3); }
  .sx-cm-stat { font: 600 12px 'DM Sans', sans-serif; color: var(--text3); white-space: nowrap; }
  .sx-empty { text-align: center; color: var(--text3); font: 400 14px 'DM Sans', sans-serif; margin-top: 32px; }

  /* Restyle the shared stat pieces, scoped to the hub */
  .sx .stats-page-body { max-width: none; }
  .sx .stats-page-body > .stats-divider:first-child { display: none; }
  .sx .sp-section-title {
    font: 600 11px 'DM Sans', sans-serif; letter-spacing: 1.6px; text-transform: uppercase;
    color: var(--text2); margin: 4px 0 12px; display: flex; align-items: center; gap: 8px;
  }
  .sx .sp-section-title::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--brand); }
  .sx .sp-sub-title { font: 600 11px 'DM Sans', sans-serif; letter-spacing: 1.4px; color: var(--text3); margin: 18px 0 10px; }
  .sx .stats-divider { background: var(--border2); margin: 24px 0; }

  .sx .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px !important; }
  @media (max-width: 479px) { .sx .stats-grid { grid-template-columns: repeat(2, 1fr); } }
  .sx .stats-grid-item {
    padding: 14px 8px 12px; border-radius: 14px; gap: 6px;
    background: var(--bg2); border: 1px solid var(--border2);
  }
  .sx .stats-grid-num { font: 400 34px/1 'Bebas Neue', sans-serif !important; letter-spacing: 1px; color: var(--brand); }
  .sx .stats-grid-label { font: 600 10.5px 'DM Sans', sans-serif; letter-spacing: 1.2px; color: var(--text3); }

  .sx .stat-row { gap: 10px; margin-bottom: 6px; }
  .sx .stat-bar-wrap { height: 26px; border-radius: 8px; background: var(--bg2); border: 1px solid var(--border2); }
  .sx .stat-bar { border-radius: 7px; min-width: 32px; background: color-mix(in srgb, var(--brand) 45%, var(--bg3)); }
  .sx .stat-bar.best { background: var(--brand); }
  .sx .stat-bar-count { font: 700 11.5px 'DM Sans', sans-serif; }

  .sx .sp-difficulty-card { border-radius: 14px; border-color: var(--border2); padding: 18px 20px; }
  .sx .sp-diff-emoji, .sx .sp-chart-emoji { display: none; }
  .sx .sp-diff-label { font-size: 28px; }
  .sx .sp-chart { height: 160px; padding: 16px 14px 12px; border-radius: 14px; background: var(--bg2); border: 1px solid var(--border2); }
  .sx .sp-chart-bar { border-radius: 6px 6px 2px 2px; }
  .sx .sp-fg-bar-wrap { border-radius: 10px; background: var(--bg2); border: 1px solid var(--border2); height: 36px; }
  .sx .sp-fg-bar { border-radius: 9px; background: color-mix(in srgb, var(--brand) 28%, transparent); }
  .sx .sp-fg-name { color: var(--text); }

  @media (max-width: 479px) {
    .sx-scope { flex-direction: column; align-items: stretch; gap: 6px; }
    .sx-view { width: auto; }
    .sx-scope-note { text-align: center; }
    .sx-games button { padding: 12px 10px; }
  }
  @media (prefers-reduced-motion: reduce) { .sx-panel, .sx-seg-pill { animation: none; transition: none; } }
`;
