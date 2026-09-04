import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  getDailyConnectionsPuzzle, getConnectionsPuzzleByDate, getPastConnectionsPuzzles,
  getDisplayDateForConnections, CONNECTIONS_MAX_MISTAKES,
} from "../shared/connectionsLogic";
import { loadCustomPuzzle } from "../shared/customConnections";
import { logConnectionsEvent } from "../shared/supabase";
import {
  loadTodayConnectionsGame, saveConnectionsMidGame, saveConnectionsCompletedGame,
  loadConnectionsStats, loadCustomConnectionsHistory, deleteCustomConnectionsFromHistory,
} from "../shared/storage";
import { msUntilMidnightET } from "../shared/gameLogic";
import ConnectionsGame from "../components/ConnectionsGame";
import CustomPuzzleForm from "../components/CustomPuzzleForm";
import useSEO from "../shared/useSEO";

// ── Daily mode ─────────────────────────────────────────────────────────────────
function ConnectionsDaily({ colorblind }) {
  const navigate = useNavigate();
  const puzzle = useMemo(() => getDailyConnectionsPuzzle(), []);
  const puzzleKey = puzzle?.date;
  const [saved] = useState(() => puzzleKey ? loadTodayConnectionsGame(puzzleKey) : null);

  // Auto-refresh at midnight ET (only actually changes puzzle on a day a new one goes live)
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), msUntilMidnightET());
    return () => clearTimeout(timer);
  }, []);

  function handleMidGame({ guesses, solvedGroups, mistakes }) {
    saveConnectionsMidGame({ weekNum: puzzleKey, guesses, solvedGroups, mistakes });
  }

  function handleComplete({ won, mistakes, guesses, solvedGroups }) {
    saveConnectionsCompletedGame({ weekNum: puzzleKey, won, mistakes, guesses, solvedGroups });
    // solve_order is the difficulty (1-4) of each group in the order it was
    // solved, e.g. [2,1,4,3] — mistakes here is exactly what's on the board
    // at the moment the loss/win is recorded, before any "keep going" bonus
    // play, which is intentionally never logged.
    const solveOrder = solvedGroups.map(gi => puzzle.groups[gi]?.difficulty).filter(Boolean);
    logConnectionsEvent({ weekNum: puzzle.puzzleNumber, won, mistakes, solveOrder });
  }

  if (!puzzle) {
    return (
      <p className="modal-body" style={{ textAlign: "center" }}>
        No puzzle has gone live yet — check back soon!
      </p>
    );
  }

  return (
    <>
      <div className="mode-banner">
        <div className="mode-banner-left">
          <span className="mode-banner-label">Connections Weekly</span>
          <span className="mode-banner-title">⛓️ Puzzle #{puzzle.puzzleNumber}{puzzle.title ? ` - ${puzzle.title}` : ""}</span>
        </div>
      </div>
      <ConnectionsGame
        key={puzzleKey}
        puzzle={puzzle}
        mode="connections_daily"
        weekNum={puzzle.puzzleNumber}
        colorblind={colorblind}
        onMidGame={handleMidGame}
        onComplete={handleComplete}
        onNavigateStats={() => navigate("/connections/stats")}
        initialGuessHistory={saved?.guessObjects || []}
        initialSolvedGroups={saved?.solvedGroups || []}
        initialMistakes={saved?.mistakes || 0}
        initialGameOver={saved?.gameOver || false}
        initialWon={saved?.won || false}
      />
    </>
  );
}

// ── Archive mode ───────────────────────────────────────────────────────────────
function ConnectionsArchive({ colorblind }) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(null);
  const pastPuzzles = useMemo(() => getPastConnectionsPuzzles(), []);

  const selectedPuzzle = selectedDate !== null ? getConnectionsPuzzleByDate(selectedDate) : null;

  if (selectedDate !== null && selectedPuzzle) {
    return (
      <>
        <div className="mode-banner">
          <div className="mode-banner-left">
            <span className="mode-banner-label">Connections Archive</span>
            <span className="mode-banner-title">Puzzle #{selectedPuzzle.puzzleNumber}{selectedPuzzle.title ? ` - ${selectedPuzzle.title}` : ""}</span>
          </div>
          <button className="archive-play-btn" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600 }} onClick={() => setSelectedDate(null)}>
            ← Back to Archive
          </button>
        </div>
        <ConnectionsGame
          key={selectedDate}
          puzzle={selectedPuzzle}
          mode="connections_archive"
          weekNum={selectedPuzzle.puzzleNumber}
          colorblind={colorblind}
          onNavigateStats={() => navigate("/connections/stats")}
          onNavigateDaily={() => navigate("/connections")}
        />
      </>
    );
  }

  return (
    <>
      <p className="modal-body" style={{ textAlign: "center", marginBottom: "20px" }}>
        Play any past Connections puzzle. Archive games don't affect your stats or streak.
      </p>

      {pastPuzzles.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "14px" }}>
          No past puzzles yet — check back soon!
        </p>
      ) : (
        <div className="archive-list">
          {pastPuzzles.map(p => (
            <div key={p.date} className="archive-item" onClick={() => setSelectedDate(p.date)}>
              <div className="archive-item-left">
                <span className="archive-item-num">#{p.puzzleNumber}{p.title ? ` - ${p.title}` : ""}</span>
                <span className="archive-item-date">{getDisplayDateForConnections(p.date)}</span>
              </div>
              <button className="archive-play-btn">Play</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Custom mode ────────────────────────────────────────────────────────────────
function ConnectionsCustom({ colorblind }) {
  const navigate = useNavigate();
  const { code } = useParams();
  const [history, setHistory] = useState(() => loadCustomConnectionsHistory());
  const [puzzle, setPuzzle] = useState(null);
  const [loadState, setLoadState] = useState(code ? "loading" : "idle"); // "loading" | "ready" | "notfound" | "idle"

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    loadCustomPuzzle(code).then(p => {
      if (cancelled) return;
      setPuzzle(p);
      setLoadState(p ? "ready" : "notfound");
    });
    return () => { cancelled = true; };
  }, [code]);

  // Reset to a fresh "loading" state whenever the code itself changes
  // (e.g. navigating from one custom puzzle link straight to another).
  const [lastCode, setLastCode] = useState(code);
  if (code !== lastCode) {
    setLastCode(code);
    setPuzzle(null);
    setLoadState(code ? "loading" : "idle");
  }

  if (code) {
    if (loadState === "loading") {
      return <div className="loading">⛓️ Loading the puzzle…</div>;
    }

    if (loadState === "notfound") {
      return (
        <>
          <p className="modal-body" style={{ textAlign: "center", marginBottom: "20px" }}>
            This puzzle link looks broken or incomplete — it may have been copied wrong.
          </p>
          <div style={{ textAlign: "center" }}>
            <button className="cx-action-btn cx-submit" onClick={() => navigate("/connections/custom")}>
              Make Your Own Puzzle
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="mode-banner">
          <div className="mode-banner-left">
            <span className="mode-banner-label">Connections Custom</span>
            <span className="mode-banner-title">{puzzle.title || "A custom puzzle"}</span>
          </div>
          <button className="archive-play-btn" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600 }} onClick={() => navigate("/connections/custom")}>
            ← Back
          </button>
        </div>
        <ConnectionsGame
          key={code}
          puzzle={puzzle}
          mode="connections_custom"
          weekNum={null}
          customCode={code}
          colorblind={colorblind}
          onNavigateDaily={() => navigate("/connections")}
        />
      </>
    );
  }

  function handleDelete(entryCode) {
    setHistory(deleteCustomConnectionsFromHistory(entryCode));
  }

  return (
    <>
      <p className="modal-body" style={{ textAlign: "center", marginBottom: "20px" }}>
        Build your own 4×4 puzzle and share the link with friends. Survivor-themed or not — up to you.
        Custom games don't affect your stats.
      </p>

      <CustomPuzzleForm onCreated={() => setHistory(loadCustomConnectionsHistory())} />

      {history.length > 0 && (
        <>
          <div className="cx-history-heading">Your Puzzles</div>
          <div className="archive-list">
            {history.map(entry => (
              <div key={entry.code} className="archive-item">
                <div className="archive-item-left" style={{ cursor: "pointer" }} onClick={() => navigate(`/connections/custom/${entry.code}`)}>
                  <span className="archive-item-num">{entry.title || "Untitled Puzzle"}</span>
                  <span className="archive-item-date">{new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <button className="cx-history-delete" onClick={() => handleDelete(entry.code)} aria-label="Delete from history">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function DistBars({ dist }) {
  const max = Math.max(...Object.values(dist), 1);
  return (
    <>
      <div className="sp-sub-title" style={{ marginTop: "20px" }}>Mistake Distribution</div>
      {Array.from({ length: CONNECTIONS_MAX_MISTAKES + 1 }, (_, i) => i).map(n => {
        const count = dist[n] || 0;
        const w = count > 0 ? `${Math.max(Math.round((count / max) * 100), 4)}%` : "0%";
        return (
          <div key={n} className="stat-row">
            <span className="stat-label">{n}</span>
            <div className="stat-bar-wrap">
              <div className="stat-bar" style={{ width: w, background: "#3a9188", border: "1px solid #6fc4b9" }}>
                {count > 0 && <span className="stat-bar-count">{count}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function StatsSection({ stats, label, showStreak }) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const cells = showStreak
    ? [[stats.played, "Played"], [`${winPct}%`, "Win %"], [stats.currentStreak, "Streak"], [stats.maxStreak, "Max Streak"]]
    : [[stats.played, "Played"], [`${winPct}%`, "Win %"], [stats.wins, "Wins"], [stats.played - stats.wins, "Losses"]];

  return (
    <div style={{ marginBottom: "32px" }}>
      <div className="sp-sub-title">{label}</div>
      {stats.played === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "13px", marginTop: "12px" }}>
          No games yet
        </p>
      ) : (
        <>
          <div className="stats-grid" style={{ marginTop: "12px", marginBottom: "12px" }}>
            {cells.map(([val, lbl]) => (
              <div className="stats-grid-item" key={lbl}>
                <span className="stats-grid-num">{val}</span>
                <span className="stats-grid-label">{lbl}</span>
              </div>
            ))}
          </div>
          {showStreak && <DistBars dist={stats.dist || {}} />}
        </>
      )}
    </div>
  );
}

function ConnectionsStats() {
  const daily = loadConnectionsStats();

  return (
    <div>
      <StatsSection stats={daily} label="Weekly" showStreak />
    </div>
  );
}

// ── "What is Connections?" info popover ───────────────────────────────────────
function ConnectionsInfoPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="recall-info-wrap" ref={ref}>
      <button
        className="recall-info-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="What is Connections?"
        aria-expanded={open}
      >
        ⓘ <span className="recall-info-label">What is Connections?</span>
      </button>

      {open && (
        <div className="recall-info-popover" role="dialog" aria-label="What is Connections?">
          <p className="recall-info-heading">Find the four groups</p>
          <p className="recall-info-body">
            16 tiles, 4 secret groups of 4. Select four tiles and hit <strong>Submit</strong> to guess
            a group. Categories range from straightforward to tricky — watch out for tiles that
            seem to fit more than one group.
          </p>
          <div className="recall-info-scoring">
            <div className="recall-info-score-row">
              <span className="recall-info-field">🟨 Straightforward</span>
              <span className="recall-info-pts">Easiest group</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">🟩 Medium</span>
              <span className="recall-info-pts">&nbsp;</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">🟦 Tricky</span>
              <span className="recall-info-pts">&nbsp;</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">🟪 Tough</span>
              <span className="recall-info-pts">Hardest group</span>
            </div>
          </div>
          <p className="recall-info-body" style={{ marginTop: "8px" }}>
            You get <strong>4 mistakes</strong> before the game ends.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Root Connections page ──────────────────────────────────────────────────────
export default function Connections({ colorblind }) {
  const navigate = useNavigate();
  const location = useLocation();

  useSEO({
    title: "Survivordle Connections: Group the Castaways",
    description: "Find four groups of four Survivor-themed tiles in this weekly Connections-style puzzle.",
    canonical: "https://survivordle.com/connections",
  });

  const path = location.pathname.replace(/\/$/, "");
  const activeTab = path === "/connections/archive"        ? "archive"
                  : path === "/connections/stats"          ? "stats"
                  : path.startsWith("/connections/custom")  ? "custom"
                  : "daily";

  return (
    <>
      <header className="header">
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
        <div className="tagline">Connections Mode &nbsp;·&nbsp; Find the four groups</div>
      </header>

      <div className="ul-tabs" style={{ position: "relative" }}>
        <button className={`ul-tab${activeTab === "daily"     ? " active" : ""}`} onClick={() => navigate("/connections")}>
          ⛓️ Weekly
        </button>
        <button className={`ul-tab${activeTab === "archive" ? " active" : ""}`} onClick={() => navigate("/connections/archive")}>
          📁 Archive
        </button>
        <button className={`ul-tab${activeTab === "custom"  ? " active" : ""}`} onClick={() => navigate("/connections/custom")}>
          ✏️ Custom
        </button>
        <button className={`ul-tab${activeTab === "stats"   ? " active" : ""}`} onClick={() => navigate("/connections/stats")}>
          📊 Stats
        </button>
        <ConnectionsInfoPopover />
      </div>

      {activeTab === "daily"   && <ConnectionsDaily   colorblind={colorblind} />}
      {activeTab === "archive" && <ConnectionsArchive colorblind={colorblind} />}
      {activeTab === "custom"  && <ConnectionsCustom  colorblind={colorblind} />}
      {activeTab === "stats"   && <ConnectionsStats />}
    </>
  );
}
