import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useSEO from "../shared/useSEO";
import { fetchDailyStats, fetchGlobalStats, fetchBBDailyStats, fetchBBGlobalStats, fetchDailyAvgGuesses } from "../shared/supabase";
import {
  loadStorage, loadUnlimitedStats, loadSandwichStats, loadSandwichUnlimitedStats,
  loadBBStats, loadBBUnlimitedStats, loadBBSandwichStats, loadBBSandwichUnlimitedStats,
  loadConnectionsStats,
} from "../shared/storage";
import { RecallStatsTab, RecallRankings } from "../shared/recallStats";

const BB_CSS = `
  .bb-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(2.2rem, 8vw, 4rem);
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: 0;
  }
  .bb-title-left {
    background: linear-gradient(to right, #1a6fbf 0%, #5aaedd 60%, #b8e4f5 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    vertical-align: middle;
  }
  .bb-title-eye {
    font-size: clamp(2.6rem, 9vw, 4.6rem);
    line-height: 1;
    display: inline-block;
    -webkit-text-fill-color: initial;
    vertical-align: middle;
    margin: 0 0.02em;
  }
  .bb-title-right {
    background: linear-gradient(to right, #b8e4f5 0%, #5aaedd 40%, #1a6fbf 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    vertical-align: middle;
  }
  .bb-header { text-align: center; margin-bottom: 4px; }

  /* Recolor Survivordle-orange brand accents to BB blue on this page.
     Semantic colors (correct/close/wrong, difficulty easy/hard) are left untouched. */
  .bb-theme .ul-tab.active,
  .bb-theme .sp-section-title,
  .bb-theme .stats-grid-num,
  .bb-theme .sp-fg-name {
    color: #5aaedd;
  }
  .bb-theme .stat-bar {
    background: linear-gradient(90deg, #1a6fbf, #5aaedd);
  }
  .bb-theme .sp-fg-bar {
    background: linear-gradient(90deg, #1a6fbf99, #5aaedd99);
  }
`;

// Everything that differs between the two shows lives here.
const SHOWS = {
  sv: {
    emoji: "🔥", accent: "#e8742a", path: "/stats", dailyMode: "daily",
    loadDaily:    () => loadStorage().stats,
    loadUnlimited: loadUnlimitedStats,
    loadSwDaily:  loadSandwichStats,
    loadSwUnlim:  loadSandwichUnlimitedStats,
    fetchDaily: fetchDailyStats, fetchGlobal: fetchGlobalStats,
    seoTitle: "Stats | Survivordle", seoDesc: "Survivordle statistics: your personal stats, today's difficulty rating, and global player data.",
  },
  bb: {
    emoji: "👁", accent: "#5aaedd", path: "/bb/stats", dailyMode: "bb",
    loadDaily:    loadBBStats,
    loadUnlimited: loadBBUnlimitedStats,
    loadSwDaily:  loadBBSandwichStats,
    loadSwUnlim:  loadBBSandwichUnlimitedStats,
    fetchDaily: fetchBBDailyStats, fetchGlobal: fetchBBGlobalStats,
    seoTitle: "Stats | Big Brotherdle", seoDesc: "Big Brotherdle statistics: your personal stats, today's difficulty rating, and global player data.",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function friendlyCount(n) {
  const num = Number(n);
  if (isNaN(num)) return "—";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${Math.floor(num / 1000)}K`;
  return num.toLocaleString();
}

function difficultyLabel(avg, sampleOk, easyThreshold, hardThreshold, cfg = SHOWS.sv) {
  if (!sampleOk) return { label: "Still calculating…", color: "var(--text3)", emoji: "⏳" };
  if (avg <= easyThreshold) return { label: "Easier than usual", color: "#4aaa4a", emoji: "😊" };
  if (avg >= hardThreshold) return { label: "Harder than usual", color: "#e05040", emoji: "💀" };
  return                            { label: "Typical difficulty", color: cfg.accent, emoji: cfg.emoji };
}

function getThresholds(chartDays) {
  if (chartDays.length < 3) return { easy: -Infinity, hard: Infinity };
  const sorted = [...chartDays].sort((a, b) => Number(a.avg_guesses) - Number(b.avg_guesses));
  const n = sorted.length; // should be 7
  // bottom 2 = easy, middle 3 = typical, top 2 = hard
  const easyThreshold = Number(sorted[Math.floor(n * 2 / 7) - 1]?.avg_guesses ?? sorted[1].avg_guesses);
  const hardThreshold = Number(sorted[n - Math.floor(n * 2 / 7)]?.avg_guesses ?? sorted[n - 2].avg_guesses);
  return { easy: easyThreshold, hard: hardThreshold };
}

function pct(count, total) {
  if (!total) return 0;
  return Math.round((Number(count) / Number(total)) * 100);
}

// ── My Stats Tab ───────────────────────────────────────────────────────────────
function MyStatsTab({ cfg, part }) {
  const [globalAvg, setGlobalAvg] = useState(null);
  useEffect(() => {
    if (part === "wordle") fetchDailyAvgGuesses(cfg.dailyMode).then(d => setGlobalAvg(d?.avg_guesses ?? null));
  }, [cfg, part]);
  const unlim    = cfg.loadUnlimited();
  const swDaily  = cfg.loadSwDaily();
  const swUnlim  = cfg.loadSwUnlim();
  const dStats   = cfg.loadDaily() || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
  const dPct     = dStats.played > 0 ? Math.round((dStats.wins / dStats.played) * 100) : 0;
  const dDist    = dStats.dist || {};
  const dMax     = Math.max(...Object.values(dDist).map(Number), 1);
  const dBest    = Object.entries(dDist).sort((a,b) => b[1]-a[1])[0]?.[0];
  const uPct     = unlim.played > 0 ? Math.round((unlim.wins / unlim.played) * 100) : 0;
  const uDist    = unlim.dist || {};
  const uMax     = Math.max(...Object.values(uDist).map(Number), 1);
  const uBest    = Object.entries(uDist).sort((a,b) => b[1]-a[1])[0]?.[0];
  const swDPct   = swDaily.played > 0 ? Math.round((swDaily.wins / swDaily.played) * 100) : 0;
  const swDDist  = swDaily.dist || {};
  const swDMax   = Math.max(...Object.values(swDDist).map(Number), 1);
  const swDBest  = Object.entries(swDDist).sort((a,b) => b[1]-a[1])[0]?.[0];
  const swUPct   = swUnlim.played > 0 ? Math.round((swUnlim.wins / swUnlim.played) * 100) : 0;
  const swUDist  = swUnlim.dist || {};
  const swUMax   = Math.max(...Object.values(swUDist).map(Number), 1);
  const swUBest  = Object.entries(swUDist).sort((a,b) => b[1]-a[1])[0]?.[0];

  return (
    <div className="stats-page-body">
      {part === "wordle" && (
        <>
      {/* Daily personal */}
      <div className="sp-section-title">{cfg.emoji} Daily</div>
      <div className="stats-grid" style={{ marginBottom: "16px" }}>
        {[
          [dStats.played,         "Played"],
          [`${dPct}%`,            "Solved"],
          [dStats.currentStreak,  "Streak"],
          [dStats.maxStreak,      "Best Streak"],
        ].map(([val, lbl]) => (
          <div className="stats-grid-item" key={lbl}>
            <span className="stats-grid-num">{val}</span>
            <span className="stats-grid-label">{lbl}</span>
          </div>
        ))}
      </div>

      {dStats.wins > 0 && (
        <>
          <p style={{ textAlign:"center", fontSize:"13px", color:"var(--text2)", marginBottom:"16px" }}>
            Avg guesses per win — You: <strong>{(Object.entries(dDist).reduce((t,[n,c])=>t+Number(n)*c,0)/dStats.wins).toFixed(2)}</strong>
            {globalAvg != null && <> · Everyone: <strong>{Number(globalAvg).toFixed(2)}</strong></>}
          </p>
          <div className="sp-sub-title">Guess Distribution</div>
          {[1,2,3,4,5,6,7,8].map(n => {
            const count = Number(dDist[n] || 0);
            const w = count > 0 ? `${Math.max(Math.round((count/dMax)*100), 4)}%` : "0%";
            return (
              <div key={n} className="stat-row">
                <span className="stat-label">{n}</span>
                <div className="stat-bar-wrap">
                  <div className={`stat-bar${String(n)===String(dBest)?" best":""}`} style={{ width: w }}>
                    {count > 0 && <span className="stat-bar-count">{Math.round((count/dStats.wins)*100)}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="stats-divider" />

      {/* Unlimited personal */}
      <div className="sp-section-title">♾️ Unlimited</div>
      <div className="stats-grid" style={{ marginBottom: "16px" }}>
        {[
          [unlim.played,          "Played"],
          [`${uPct}%`,            "Solved"],
          [unlim.wins,            "Wins"],
          [unlim.played > 0 && unlim.wins > 0
            ? (Object.entries(uDist).reduce((s,[n,c])=>s+Number(n)*c,0)/unlim.wins).toFixed(1)
            : "—",                "Avg Guesses"],
        ].map(([val, lbl]) => (
          <div className="stats-grid-item" key={lbl}>
            <span className="stats-grid-num">{val}</span>
            <span className="stats-grid-label">{lbl}</span>
          </div>
        ))}
      </div>

      {unlim.wins > 0 && (
        <>
          <div className="sp-sub-title">Guess Distribution</div>
          {[1,2,3,4,5,6,7,8].map(n => {
            const count = Number(uDist[n] || 0);
            const w = count > 0 ? `${Math.max(Math.round((count/uMax)*100), 4)}%` : "0%";
            return (
              <div key={n} className="stat-row">
                <span className="stat-label">{n}</span>
                <div className="stat-bar-wrap">
                  <div className={`stat-bar${String(n)===String(uBest)?" best":""}`} style={{ width: w }}>
                    {count > 0 && <span className="stat-bar-count">{Math.round((count/unlim.wins)*100)}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
        </>
      )}

      {part === "sandwich" && (
        <>
      {/* Sandwich Daily */}
      <div className="sp-section-title">🥪 Sandwich Daily</div>
      {swDaily.played === 0 ? (
        <p style={{ textAlign:"center", color:"var(--text3)", fontSize:"13px", marginBottom:"16px" }}>No games yet</p>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: "16px" }}>
            {[
              [swDaily.played,        "Played"],
              [`${swDPct}%`,          "Solved"],
              [swDaily.currentStreak, "Streak"],
              [swDaily.maxStreak,     "Best Streak"],
            ].map(([val, lbl]) => (
              <div className="stats-grid-item" key={lbl}>
                <span className="stats-grid-num">{val}</span>
                <span className="stats-grid-label">{lbl}</span>
              </div>
            ))}
          </div>
          {swDaily.wins > 0 && (
            <>
              <div className="sp-sub-title">Guess Distribution</div>
              {[1,2,3,4].map(n => {
                const count = Number(swDDist[n] || 0);
                const w = count > 0 ? `${Math.max(Math.round((count/swDMax)*100), 4)}%` : "0%";
                return (
                  <div key={n} className="stat-row">
                    <span className="stat-label">{n}</span>
                    <div className="stat-bar-wrap">
                      <div className={`stat-bar${String(n)===String(swDBest)?" best":""}`} style={{ width: w }}>
                        {count > 0 && <span className="stat-bar-count">{Math.round((count/swDaily.wins)*100)}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      <div className="stats-divider" />

      {/* Sandwich Unlimited */}
      <div className="sp-section-title">🥪 Sandwich Unlimited</div>
      {swUnlim.played === 0 ? (
        <p style={{ textAlign:"center", color:"var(--text3)", fontSize:"13px", marginBottom:"16px" }}>No games yet</p>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: "16px" }}>
            {[
              [swUnlim.played, "Played"],
              [`${swUPct}%`,   "Solved"],
              [swUnlim.wins,   "Wins"],
              [swUnlim.played - swUnlim.wins, "Losses"],
            ].map(([val, lbl]) => (
              <div className="stats-grid-item" key={lbl}>
                <span className="stats-grid-num">{val}</span>
                <span className="stats-grid-label">{lbl}</span>
              </div>
            ))}
          </div>
          {swUnlim.wins > 0 && (
            <>
              <div className="sp-sub-title">Guess Distribution</div>
              {[1,2,3,4].map(n => {
                const count = Number(swUDist[n] || 0);
                const w = count > 0 ? `${Math.max(Math.round((count/swUMax)*100), 4)}%` : "0%";
                return (
                  <div key={n} className="stat-row">
                    <span className="stat-label">{n}</span>
                    <div className="stat-bar-wrap">
                      <div className={`stat-bar${String(n)===String(swUBest)?" best":""}`} style={{ width: w }}>
                        {count > 0 && <span className="stat-bar-count">{Math.round((count/swUnlim.wins)*100)}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
        </>
      )}

      {part === "wordle" && dStats.played === 0 && unlim.played === 0 && (
        <p style={{ textAlign:"center", color:"var(--text3)", marginTop:"40px" }}>
          Play some games to see your stats here!
        </p>
      )}
    </div>
  );
}

// ── Daily Tab ──────────────────────────────────────────────────────────────────
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function DailyTab({ data, loading, onRetry, cfg }) {
  if (loading) return <div className="loading">Loading daily stats…</div>;
  if (!data)   return (
    <div style={{ textAlign:"center", marginTop:"40px" }}>
      <p style={{ color:"var(--text3)", marginBottom:"12px" }}>Could not load daily stats.</p>
      <button className="ul-subtab" onClick={onRetry}>Retry</button>
    </div>
  );

  const lastSeven  = data.last_seven || [];

  // Deduplicate by day (take the entry with most solves), sort ascending
  const dayMap = {};
  for (const row of lastSeven) {
    const key = row.day;
    if (!dayMap[key] || Number(row.solve_count) > Number(dayMap[key].solve_count)) {
      dayMap[key] = row;
    }
  }
  const chartDays = Object.values(dayMap).sort((a,b) => new Date(a.day) - new Date(b.day));
  const chartMax  = Math.max(...chartDays.map(d => Number(d.avg_guesses)), 8);

  // today card — use SQL result or fall back to most recent chart day
  const today      = data.today || [...chartDays].sort((a,b) => new Date(b.day) - new Date(a.day))[0];
  const sampleOk   = today && Number(today.solve_count) >= 100;
  const avgGuesses = today ? Number(today.avg_guesses) : null;
  const { easy: easyThresh, hard: hardThresh } = getThresholds(chartDays);
  const diff       = difficultyLabel(avgGuesses, sampleOk, easyThresh, hardThresh, cfg);

  return (
    <div className="stats-page-body">

      {/* Today's difficulty */}
      <div className="sp-section-title">Today's Puzzle</div>
      <div className="sp-difficulty-card">
        <span className="sp-diff-emoji">{diff.emoji}</span>
        <div className="sp-diff-right">
          <span className="sp-diff-label" style={{ color: diff.color }}>{diff.label}</span>
          {avgGuesses && sampleOk && (
            <span className="sp-diff-sub">
              Average solve: {Number(avgGuesses).toFixed(2)} guesses &nbsp;
            </span>
          )}
          {!sampleOk && (
            <span className="sp-diff-sub">Need 100+ solves to calculate — check back later</span>
          )}
        </div>
      </div>

      {/* 7-day chart */}
      {chartDays.length > 0 && (
        <>
          <div className="stats-divider" />
          <div className="sp-section-title">Last 7 Days</div>
          <div className="sp-chart">
            {chartDays.map((row, i) => {
              const avg     = Number(row.avg_guesses);
              const d       = difficultyLabel(avg, Number(row.solve_count) >= 100, easyThresh, hardThresh, cfg);
              const barPct  = Math.round((avg / 8) * 100);
              const date    = new Date(row.day + "T12:00:00Z");
              const dayName = DAY_LABELS[date.getUTCDay()];
              return (
                <div key={i} className="sp-chart-col">
                  <span className="sp-chart-val">{avg.toFixed(2)}</span>
                  <div className="sp-chart-bar-wrap">
                    <div
                      className="sp-chart-bar"
                      style={{
                        height: `${Math.max(barPct, 8)}%`,
                        background: d.color === "#4aaa4a" ? "#1a4d1a"
                                  : d.color === "#e05040" ? "#4a1010"
                                  : cfg === SHOWS.bb ? "#0a2a4a" : "#4a2a05",
                        borderColor: d.color,
                      }}
                      title={`${avg} avg guesses`}
                    />
                  </div>
                  <span className="sp-chart-label">{dayName}</span>
                  <span className="sp-chart-emoji">{d.emoji}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Global Tab ─────────────────────────────────────────────────────────────────
function GlobalTab({ data, loading, onRetry, show }) {
  if (loading) return <div className="loading">Loading global stats…</div>;
  if (!data)   return (
    <div style={{ textAlign:"center", marginTop:"40px" }}>
      <p style={{ color:"var(--text3)", marginBottom:"12px" }}>Could not load global stats.</p>
      <button className="ul-subtab" onClick={onRetry}>Retry</button>
    </div>
  );

  const totalGames   = Number(data.total_games   || 0);
  const totalWins    = Number(data.total_wins     || 0);
  const totalGuesses = Number(data.total_guesses_approx || 0);
  const unlimTotal   = Number(data.unlimited_total || 0);
  const solveRate    = pct(totalWins, totalGames);
  const dist         = data.dist || {};
  const distMax      = Math.max(...Object.values(dist).map(Number), 1);
  const topFG        = data.top_first_guesses || [];

  return (
    <div className="stats-page-body">

      {/* Summary */}
      <div className="sp-section-title">All Time</div>
      <div className="stats-grid sp-4col" style={{ marginBottom: "20px" }}>
        <div className="stats-grid-item">
          <span className="stats-grid-num">{friendlyCount(totalGames)}</span>
          <span className="stats-grid-label">Games Played</span>
        </div>
        <div className="stats-grid-item">
          <span className="stats-grid-num">{solveRate}%</span>
          <span className="stats-grid-label">Solve Rate</span>
        </div>
        <div className="stats-grid-item">
          <span className="stats-grid-num">{friendlyCount(totalGuesses)}</span>
          <span className="stats-grid-label">Guesses Made</span>
        </div>
        <div className="stats-grid-item">
          <span className="stats-grid-num">{friendlyCount(unlimTotal)}</span>
          <span className="stats-grid-label">Unlimited Plays</span>
        </div>
      </div>

      {/* Distribution */}
      {totalWins > 0 && (
        <>
          <div className="stats-divider" />
          <div className="sp-section-title">Guess Distribution (Wins)</div>
          {[1,2,3,4,5,6,7,8].map(n => {
            const count   = Number(dist[n] || 0);
            const freq    = totalWins > 0 ? Math.round((count/totalWins)*100) : 0;
            const barW    = count > 0 ? `${Math.max(Math.round((count/distMax)*100), 4)}%` : "0%";
            const isBest  = count === Math.max(...Object.values(dist).map(Number));
            return (
              <div key={n} className="stat-row">
                <span className="stat-label">{n}</span>
                <div className="stat-bar-wrap">
                  <div className={`stat-bar${isBest?" best":""}`} style={{ width: barW }}>
                    {count > 0 && <span className="stat-bar-count">{freq}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Top first guesses */}
      {topFG.length > 0 && (
        <>
          <div className="stats-divider" />
          <div className="sp-section-title">Most Common First Guesses</div>
          {topFG.map((row, i) => {
            const maxCount = Number(topFG[0].count);
            const barW = `${Math.max(Math.round((Number(row.count)/maxCount)*100), 4)}%`;
            return (
              <div key={row.first_guess} className="sp-fg-row">
                <span className="sp-fg-rank">#{i+1}</span>
                <div className="sp-fg-bar-wrap">
                  <div className="sp-fg-bar" style={{ width: barW }} />
                  <span className="sp-fg-name">{row.first_guess}</span>
                </div>
              </div>
            );
          })}
        </>
      )}

      <RecallRankings show={show} />
    </div>
  );
}

// ── Connections (Survivordle only) ─────────────────────────────────────────────
function ConnectionsTab() {
  const st = loadConnectionsStats();
  const winPct = st.played ? Math.round((st.wins / st.played) * 100) : 0;
  return (
    <div className="stats-page-body">
      <div className="sp-section-title">🧩 Connections (Weekly)</div>
      {st.played === 0 ? (
        <p style={{ textAlign:"center", color:"var(--text3)", fontSize:"13px" }}>No games yet</p>
      ) : (
        <div className="stats-grid">
          {[[st.played, "Played"], [`${winPct}%`, "Win %"], [st.currentStreak, "Streak"], [st.maxStreak, "Max Streak"]].map(([val, lbl]) => (
            <div className="stats-grid-item" key={lbl}>
              <span className="stats-grid-num">{val}</span>
              <span className="stats-grid-label">{lbl}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Stats Page ────────────────────────────────────────────────────────────
// One page for both shows. /stats = Survivordle, /bb/stats = Big Brotherdle.
// ?tab= selects the tab so game pages can deep-link (my, recall, sandwich, connections, daily, global).
export default function Stats({ show = "sv" }) {
  const cfg = SHOWS[show];
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabs = [
    ["my", "My Stats"], ["recall", "Recall"], ["sandwich", "Sandwich"],
    ...(show === "sv" ? [["connections", "Connections"]] : []),
    ["daily", "Daily"], ["global", "Global"],
  ];
  const requested = params.get("tab");
  const activeTab = tabs.some(([k]) => k === requested) ? requested : "my";

  const [dailyData,     setDailyData]     = useState(null);
  const [globalData,    setGlobalData]    = useState(null);
  const [loadingDaily,  setLoadingDaily]  = useState(true);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  function loadDaily() {
    setLoadingDaily(true);
    cfg.fetchDaily().then(d  => { setDailyData(d);  setLoadingDaily(false);  });
  }
  function loadGlobal() {
    setLoadingGlobal(true);
    cfg.fetchGlobal().then(d => { setGlobalData(d); setLoadingGlobal(false); });
  }

  useEffect(() => { loadDaily(); loadGlobal(); }, [show]);

  useSEO({
    title: cfg.seoTitle,
    description: cfg.seoDesc,
    canonical: `https://survivordle.com${cfg.path}`,
  });

  const switchShow = to => navigate(`${SHOWS[to].path}${activeTab === "my" ? "" : `?tab=${activeTab}`}`);
  const pill = (k, label) => (
    <button className={`ul-subtab${show === k ? " active" : ""}`} onClick={() => show !== k && switchShow(k)}>{label}</button>
  );

  return (
    <div className={show === "bb" ? "bb-theme" : undefined}>
      {show === "bb" && <style>{BB_CSS}</style>}
      <header className={`header${show === "bb" ? " bb-header" : ""}`}>
        {show === "bb" ? (
          <div className="bb-title">
            <span className="bb-title-left">BIG BR</span>
            <span className="bb-title-eye">👁</span>
            <span className="bb-title-right">THERDLE</span>
          </div>
        ) : (
          <>
            <div className="logo">
              <span className="logo-surv">SURV</span>
              <span className="logo-torch">
                <span className="logo-torch-flame">🔥</span>
                <span className="logo-torch-stem" />
              </span>
              <span className="logo-vor">VOR</span>
              <span className="logo-dle">DLE</span>
            </div>
            <div className="torch-row">
              <div className="torch-line" />
              <div className="torch-line r" />
            </div>
          </>
        )}
        <div className="tagline">Statistics</div>
      </header>

      <div className="ul-subtabs" style={{ justifyContent: "center", marginBottom: "12px" }}>
        {pill("sv", "Survivordle")}
        {pill("bb", "Big Brotherdle")}
      </div>

      <div className="ul-tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={`ul-tab${activeTab === k ? " active" : ""}`}
            onClick={() => setParams(k === "my" ? {} : { tab: k }, { replace: true })}>{label}</button>
        ))}
      </div>

      {activeTab === "my"          && <MyStatsTab cfg={cfg} part="wordle" />}
      {activeTab === "recall"      && <RecallStatsTab show={show} />}
      {activeTab === "sandwich"    && <MyStatsTab cfg={cfg} part="sandwich" />}
      {activeTab === "connections" && <ConnectionsTab />}
      {activeTab === "daily"       && <DailyTab  cfg={cfg} data={dailyData}  loading={loadingDaily}  onRetry={loadDaily}  />}
      {activeTab === "global"      && <GlobalTab show={show} data={globalData} loading={loadingGlobal} onRetry={loadGlobal} />}
    </div>
  );
}
