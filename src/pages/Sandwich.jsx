import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getDailySandwichAnswer, getSandwichAnswerForPuzzle, getSandwichPuzzleNumber,
  getDateForSandwichPuzzle, getSandwichUnlimitedPool, getRandomSandwichAnswer,
  SANDWICH_MAX_GUESSES,
} from "../shared/sandwichLogic";
import {
  loadTodaySandwichGame, saveSandwichMidGame, saveSandwichCompletedGame,
  loadSandwichStats, loadSandwichUnlimitedStats, saveSandwichUnlimitedGame,
} from "../shared/storage";
import { msUntilMidnightET } from "../shared/gameLogic";
import SandwichGame from "../components/SandwichGame";
import useSEO from "../shared/useSEO";

// ── Daily mode ─────────────────────────────────────────────────────────────────
function SandwichDaily({ contestants, colorblind }) {
  const navigate = useNavigate();
  const puzzleNum = getSandwichPuzzleNumber();
  const answer = useMemo(() => getDailySandwichAnswer(contestants), [contestants]);
  const [saved] = useState(() => loadTodaySandwichGame(puzzleNum));

  // Auto-refresh at midnight ET
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), msUntilMidnightET());
    return () => clearTimeout(timer);
  }, []);

  function handleMidGame({ guesses }) {
    saveSandwichMidGame({ puzzleNum, guesses });
  }

  function handleComplete({ won, guessCount, guesses }) {
    saveSandwichCompletedGame({ puzzleNum, won, guessCount, guesses });
  }

  if (!answer) return <div className="loading">🥪 Loading the sandwich…</div>;

  return (
    <>
      <div className="mode-banner">
        <div className="mode-banner-left">
          <span className="mode-banner-label">Sandwich Daily</span>
          <span className="mode-banner-title">🥪 Puzzle #{puzzleNum}</span>
        </div>
      </div>
      <SandwichGame
        key={puzzleNum}
        answer={answer}
        mode="sandwich_daily"
        puzzleNum={puzzleNum}
        contestants={contestants}
        colorblind={colorblind}
        onMidGame={handleMidGame}
        onComplete={handleComplete}
        onNavigateStats={() => navigate("/sandwich/stats")}
        onNavigateConnections={() => navigate("/connections")}
        initialGuesses={saved?.guessObjects || []}
        initialGameOver={saved?.gameOver    || false}
        initialWon={saved?.won              || false}
      />
    </>
  );
}

// ── Archive mode ───────────────────────────────────────────────────────────────
function SandwichArchive({ contestants, colorblind }) {
  const navigate = useNavigate();
  const [selectedPuzzle, setSelectedPuzzle] = useState(null);
  const puzzleNum = getSandwichPuzzleNumber();
  const pastPuzzles = Array.from({ length: puzzleNum - 1 }, (_, i) => puzzleNum - 1 - i);

  const selectedAnswer = selectedPuzzle !== null ? getSandwichAnswerForPuzzle(contestants, selectedPuzzle) : null;

  if (selectedPuzzle !== null && selectedAnswer) {
    return (
      <>
        <div className="mode-banner">
          <div className="mode-banner-left">
            <span className="mode-banner-label">Sandwich Archive</span>
            <span className="mode-banner-title">Puzzle #{selectedPuzzle} · {getDateForSandwichPuzzle(selectedPuzzle)}</span>
          </div>
          <button className="archive-play-btn" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600 }} onClick={() => setSelectedPuzzle(null)}>
            ← Back to Archive
          </button>
        </div>
        <SandwichGame
          key={selectedPuzzle}
          answer={selectedAnswer}
          mode="sandwich_archive"
          puzzleNum={selectedPuzzle}
          contestants={contestants}
          colorblind={colorblind}
          onNavigateStats={() => navigate("/sandwich/stats")}
          onNavigateConnections={() => navigate("/connections")}
          onNavigateDaily={() => navigate("/sandwich")}
        />
      </>
    );
  }

  return (
    <>
      <p className="modal-body" style={{ textAlign: "center", marginBottom: "20px" }}>
        Play any past Sandwich puzzle. Archive games don't affect your stats or streak.
      </p>

      {pastPuzzles.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "14px" }}>
          No past puzzles yet — check back tomorrow!
        </p>
      ) : (
        <div className="archive-list">
          {pastPuzzles.map(n => (
            <div key={n} className="archive-item" onClick={() => setSelectedPuzzle(n)}>
              <div className="archive-item-left">
                <span className="archive-item-num">#{n}</span>
                <span className="archive-item-date">{getDateForSandwichPuzzle(n)}</span>
              </div>
              <button className="archive-play-btn">Play</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Unlimited mode ─────────────────────────────────────────────────────────────
function SandwichUnlimited({ contestants, colorblind }) {
  const navigate = useNavigate();
  const pool = useMemo(() => getSandwichUnlimitedPool(contestants), [contestants]);
  const [answer,   setAnswer]   = useState(() => getRandomSandwichAnswer(pool));
  const [gameKey,  setGameKey]  = useState(0);
  const [gameOver, setGameOver] = useState(false);

  function handleComplete({ won, guessCount }) {
    saveSandwichUnlimitedGame({ won, guessCount });
    setGameOver(true);
  }

  function newGame() {
    setAnswer(getRandomSandwichAnswer(pool));
    setGameKey(k => k + 1);
    setGameOver(false);
    window.ramp?.que?.push(() => window.ramp.spaNewPage(window.location.pathname));
  }

  if (!answer) return <div className="loading">🥪 Loading the sandwich…</div>;

  return (
    <>
      <div className="mode-banner">
        <div className="mode-banner-left">
          <span className="mode-banner-label">Sandwich Unlimited</span>
          <span className="mode-banner-title">♾️ Random sandwich every game</span>
        </div>
        {gameOver && (
          <button className="archive-play-btn" onClick={newGame}>
            🔀 Next Sandwich
          </button>
        )}
      </div>
      <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "12px", marginBottom: "16px" }}>
        Unlimited includes every season, note that these placements reflect *final* placements.
      </p>
      <SandwichGame
        key={gameKey}
        answer={answer}
        mode="sandwich_unlimited"
        puzzleNum={null}
        contestants={contestants}
        colorblind={colorblind}
        onComplete={handleComplete}
        onNavigateStats={() => navigate("/sandwich/stats")}
        onNavigateConnections={() => navigate("/connections")}
        onNavigateDaily={() => navigate("/")}
      />
    </>
  );
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function DistBars({ dist }) {
  const max = Math.max(...Object.values(dist), 1);
  return (
    <>
      <div className="sp-sub-title" style={{ marginTop: "20px" }}>Guess Distribution</div>
      {Array.from({ length: SANDWICH_MAX_GUESSES }, (_, i) => i + 1).map(n => {
        const count = dist[n] || 0;
        const w = count > 0 ? `${Math.max(Math.round((count / max) * 100), 4)}%` : "0%";
        return (
          <div key={n} className="stat-row">
            <span className="stat-label">{n}</span>
            <div className="stat-bar-wrap">
              <div className="stat-bar" style={{ width: w, background: "#1a4d1a", border: "1px solid #4aaa4a" }}>
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
          <DistBars dist={stats.dist || {}} />
        </>
      )}
    </div>
  );
}

function SandwichStats() {
  const daily = loadSandwichStats();
  const unlimited = loadSandwichUnlimitedStats();

  return (
    <div>
      <StatsSection stats={daily} label="Daily" showStreak />
      <StatsSection stats={unlimited} label="Unlimited" />
    </div>
  );
}

// ── "What is Sandwich?" info popover ──────────────────────────────────────────
function SandwichInfoPopover() {
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
        aria-label="What is Sandwich?"
        aria-expanded={open}
      >
        ⓘ <span className="recall-info-label">What is Sandwich?</span>
      </button>

      {open && (
        <div className="recall-info-popover" role="dialog" aria-label="What is Sandwich?">
          <p className="recall-info-heading">Who's in the middle?</p>
          <p className="recall-info-body">
            You're shown two castaways from the same season — one placed just above the answer,
            one just below. Name the castaway sandwiched between them in <strong>4 guesses</strong>.
            Any season appearance of the right person counts.
          </p>
          <div className="recall-info-scoring">
            <div className="recall-info-score-row">
              <span className="recall-info-field">Miss 1</span>
              <span className="recall-info-pts">Season + placement numbers revealed</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Miss 2</span>
              <span className="recall-info-pts">Starting tribe + tribe color revealed</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Miss 3</span>
              <span className="recall-info-pts">Age + gender revealed</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Miss 4</span>
              <span className="recall-info-pts">Game over — answer revealed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root Sandwich page ─────────────────────────────────────────────────────────
export default function Sandwich({ contestants, colorblind }) {
  const navigate = useNavigate();
  const location = useLocation();

  useSEO({
    title: "Survivordle Sandwich: Guess Who Placed Between",
    description: "Two castaways, one mystery between them. Guess the Survivor castaway sandwiched between two placements in 4 tries.",
    canonical: "https://survivordle.com/sandwich",
  });

  const path = location.pathname.replace(/\/$/, "");
  const activeTab = path === "/sandwich/archive"   ? "archive"
                  : path === "/sandwich/unlimited" ? "unlimited"
                  : path === "/sandwich/stats"     ? "stats"
                  : "daily";

  if (!contestants.length) return <div className="loading">🥪 Loading the sandwich…</div>;

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
        <div className="tagline">Sandwich Mode &nbsp;·&nbsp; Who placed between?</div>
      </header>

      <div className="ul-tabs" style={{ position: "relative" }}>
        <button className={`ul-tab${activeTab === "daily"     ? " active" : ""}`} onClick={() => navigate("/sandwich")}>
          🥪 Daily
        </button>
        <button className={`ul-tab${activeTab === "archive"   ? " active" : ""}`} onClick={() => navigate("/sandwich/archive")}>
          📁 Archive
        </button>
        <button className={`ul-tab${activeTab === "unlimited" ? " active" : ""}`} onClick={() => navigate("/sandwich/unlimited")}>
          ♾️ Unlimited
        </button>
        <button className={`ul-tab${activeTab === "stats"     ? " active" : ""}`} onClick={() => navigate("/sandwich/stats")}>
          📊 Stats
        </button>
        <SandwichInfoPopover />
      </div>

      {activeTab === "daily"     && <SandwichDaily     contestants={contestants} colorblind={colorblind} />}
      {activeTab === "archive"   && <SandwichArchive   contestants={contestants} colorblind={colorblind} />}
      {activeTab === "unlimited" && <SandwichUnlimited contestants={contestants} colorblind={colorblind} />}
      {activeTab === "stats"     && <SandwichStats />}
    </>
  );
}
