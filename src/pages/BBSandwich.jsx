import { useState, useMemo, useEffect, useRef } from "react";
import ModeTabs from "../components/ModeTabs";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getDailyBBSandwichAnswer, getBBSandwichAnswerForPuzzle, getBBSandwichPuzzleNumber,
  getDateForBBSandwichPuzzle, getBBSandwichUnlimitedPool, getRandomBBSandwichAnswer,
  BB_SANDWICH_MAX_GUESSES,
} from "../shared/bbSandwichLogic";
import {
  loadTodayBBSandwichGame, saveBBSandwichMidGame, saveBBSandwichCompletedGame,
  loadBBSandwichStats, loadBBSandwichUnlimitedStats, saveBBSandwichUnlimitedGame,
} from "../shared/storage";
import { msUntilMidnightET } from "../shared/gameLogic";
import BBSandwichGame from "../components/BBSandwichGame";
import useSEO from "../shared/useSEO";

const BB_HEADER_CSS = `
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
     Semantic colors (correct/close/wrong) are left untouched. */
  .bb-theme .ul-tab.active,
  .bb-theme .mode-banner-title,
  .bb-theme .archive-item-num,
  .bb-theme .stats-grid-num,
  .bb-theme .status-name,
  .bb-theme .sw-mystery,
  .bb-theme .recall-info-heading {
    color: #5aaedd;
  }
  .bb-theme .share-btn:hover,
  .bb-theme .recall-info-btn:hover {
    border-color: #5aaedd;
    color: #5aaedd;
  }
  .bb-theme .recall-info-btn:hover {
    background: rgba(90,174,221,0.08);
  }
  .bb-theme .stat-bar {
    background: linear-gradient(90deg, #1a6fbf, #5aaedd);
  }
  .bb-theme .archive-play-btn {
    background: linear-gradient(135deg, #1a6fbf, #5aaedd);
  }
`;

// ── Daily mode ─────────────────────────────────────────────────────────────────
function BBSandwichDaily({ contestants, colorblind }) {
  const navigate = useNavigate();
  const puzzleNum = getBBSandwichPuzzleNumber();
  const answer = useMemo(() => getDailyBBSandwichAnswer(contestants), [contestants]);
  const [saved] = useState(() => loadTodayBBSandwichGame(puzzleNum));

  // Auto-refresh at midnight ET
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), msUntilMidnightET());
    return () => clearTimeout(timer);
  }, []);

  function handleMidGame({ guesses }) {
    saveBBSandwichMidGame({ puzzleNum, guesses });
  }

  function handleComplete({ won, guessCount, guesses }) {
    saveBBSandwichCompletedGame({ puzzleNum, won, guessCount, guesses });
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
      <BBSandwichGame
        key={puzzleNum}
        answer={answer}
        mode="bb_sandwich_daily"
        puzzleNum={puzzleNum}
        contestants={contestants}
        colorblind={colorblind}
        onMidGame={handleMidGame}
        onComplete={handleComplete}
        onNavigateStats={() => navigate("/bb/sandwich/stats")}
        onNavigateDaily={() => navigate("/bb")}
        onNavigateRecall={() => navigate("/bb/recall")}
        initialGuesses={saved?.guessObjects || []}
        initialGameOver={saved?.gameOver    || false}
        initialWon={saved?.won              || false}
      />
    </>
  );
}

// ── Archive mode ───────────────────────────────────────────────────────────────
function BBSandwichArchive({ contestants, colorblind }) {
  const navigate = useNavigate();
  const [selectedPuzzle, setSelectedPuzzle] = useState(null);
  const puzzleNum = getBBSandwichPuzzleNumber();
  const pastPuzzles = Array.from({ length: Math.max(puzzleNum - 1, 0) }, (_, i) => puzzleNum - 1 - i);

  const selectedAnswer = selectedPuzzle !== null ? getBBSandwichAnswerForPuzzle(contestants, selectedPuzzle) : null;

  if (selectedPuzzle !== null && selectedAnswer) {
    return (
      <>
        <div className="mode-banner">
          <div className="mode-banner-left">
            <span className="mode-banner-label">Sandwich Archive</span>
            <span className="mode-banner-title">Puzzle #{selectedPuzzle} · {getDateForBBSandwichPuzzle(selectedPuzzle)}</span>
          </div>
          <button className="archive-play-btn" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600 }} onClick={() => setSelectedPuzzle(null)}>
            ← Back to Archive
          </button>
        </div>
        <BBSandwichGame
          key={selectedPuzzle}
          answer={selectedAnswer}
          mode="bb_sandwich_archive"
          puzzleNum={selectedPuzzle}
          contestants={contestants}
          colorblind={colorblind}
          onNavigateStats={() => navigate("/bb/sandwich/stats")}
          onNavigateDaily={() => navigate("/bb/sandwich")}
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
                <span className="archive-item-date">{getDateForBBSandwichPuzzle(n)}</span>
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
function BBSandwichUnlimited({ contestants, colorblind }) {
  const navigate = useNavigate();
  const pool = useMemo(() => getBBSandwichUnlimitedPool(contestants), [contestants]);
  const [answer,   setAnswer]   = useState(() => getRandomBBSandwichAnswer(pool));
  const [gameKey,  setGameKey]  = useState(0);
  const [gameOver, setGameOver] = useState(false);

  function handleComplete({ won, guessCount }) {
    saveBBSandwichUnlimitedGame({ won, guessCount });
    setGameOver(true);
  }

  function newGame() {
    setAnswer(getRandomBBSandwichAnswer(pool));
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
      <BBSandwichGame
        key={gameKey}
        answer={answer}
        mode="bb_sandwich_unlimited"
        puzzleNum={null}
        contestants={contestants}
        colorblind={colorblind}
        onComplete={handleComplete}
        onNavigateStats={() => navigate("/bb/sandwich/stats")}
        onNavigateDaily={() => navigate("/bb")}
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
      {Array.from({ length: BB_SANDWICH_MAX_GUESSES }, (_, i) => i + 1).map(n => {
        const count = dist[n] || 0;
        const w = count > 0 ? `${Math.max(Math.round((count / max) * 100), 4)}%` : "0%";
        return (
          <div key={n} className="stat-row">
            <span className="stat-label">{n}</span>
            <div className="stat-bar-wrap">
              <div className="stat-bar" style={{ width: w, background: "#0a2a5a", border: "1px solid #4a8aff" }}>
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

function BBSandwichStats() {
  const daily = loadBBSandwichStats();
  const unlimited = loadBBSandwichUnlimitedStats();

  return (
    <div>
      <StatsSection stats={daily} label="Daily" showStreak />
      <StatsSection stats={unlimited} label="Unlimited" />
    </div>
  );
}

// ── "What is Sandwich?" info popover ──────────────────────────────────────────
function BBSandwichInfoPopover() {
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
            You're shown two houseguests from the same season — one placed just above the answer,
            one just below. Name the houseguest sandwiched between them in <strong>4 guesses</strong>.
            Any season appearance of the right person counts.
          </p>
          <div className="recall-info-scoring">
            <div className="recall-info-score-row">
              <span className="recall-info-field">Miss 1</span>
              <span className="recall-info-pts">Season + placement numbers revealed</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Miss 2</span>
              <span className="recall-info-pts">Comp wins (HOH + Veto) revealed</span>
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
          <p className="recall-info-body" style={{ marginTop: "12px", marginBottom: 0, fontSize: "12px" }}>
            <strong>Seasons included:</strong> Big Brother 1–27 only. No Celebrity Big Brother, Reindeer Games, or Over the Top.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Root BB Sandwich page ───────────────────────────────────────────────────────
export default function BBSandwich({ colorblind }) {
  const location = useLocation();
  const [houseguests, setHouseguests] = useState([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: "Big Brotherdle Sandwich: Guess Who Placed Between",
    description: "Two houseguests, one mystery between them. Guess the Big Brother houseguest sandwiched between two placements in 4 tries.",
    canonical: "https://survivordle.com/bb/sandwich",
    image: "https://survivordle.com/Big_Brotherdle_Thumbnail.png",
  });

  useEffect(() => {
    fetch("/bb_contestants.json")
      .then(r => r.json())
      .then(data => { setHouseguests(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const path = location.pathname.replace(/\/$/, "");
  const activeTab = path === "/bb/sandwich/archive"   ? "archive"
                  : path === "/bb/sandwich/unlimited" ? "unlimited"
                  : path === "/bb/sandwich/stats"     ? "stats"
                  : "daily";

  if (loading) return (
    <div className="bb-theme">
      <style>{BB_HEADER_CSS}</style>
      <div className="loading">🥪 Loading the sandwich…</div>
    </div>
  );

  return (
    <div className="bb-theme">
      <style>{BB_HEADER_CSS}</style>
      <header className="header bb-header">
        <div className="bb-title">
          <span className="bb-title-left">BIG BR</span>
          <span className="bb-title-eye">👁</span>
          <span className="bb-title-right">THERDLE</span>
        </div>
        <div className="tagline">Sandwich Mode &nbsp;·&nbsp; Who placed between?</div>
      </header>

      <ModeTabs base="/bb/sandwich" icon="🥪">
        <BBSandwichInfoPopover />
      </ModeTabs>

      {activeTab === "daily"     && <BBSandwichDaily     contestants={houseguests} colorblind={colorblind} />}
      {activeTab === "archive"   && <BBSandwichArchive   contestants={houseguests} colorblind={colorblind} />}
      {activeTab === "unlimited" && <BBSandwichUnlimited contestants={houseguests} colorblind={colorblind} />}
      {activeTab === "stats"     && <BBSandwichStats />}
    </div>
  );
}
