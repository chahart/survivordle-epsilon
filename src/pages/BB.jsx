import { useState, useEffect, useMemo, useRef } from "react";
import { isRankUnlocked } from "../shared/rankStorage";
import ModeTabs from "../components/ModeTabs";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  BB_PRELAUNCH, BB_LAUNCH, BB_MAX_GUESSES,
  getDailyBBAnswer, getBBAnswerForPuzzle, getBBPuzzleNumber,
  getDateForBBPuzzle, getRandomBBAnswer,
} from "../shared/bbLogic";
import {
  loadTodayBBGame, saveBBMidGame, saveBBCompletedGame,
  loadBBStorage, saveBBStorage, saveBBUnlimitedGame,
} from "../shared/storage";
import { msUntilMidnightET } from "../shared/gameLogic";
import BBGameBoard from "../components/BBGameBoard";
import useSEO from "../shared/useSEO";

function getTimeLeft() {
  const diff = BB_LAUNCH - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
  };
}

const BB_CSS = `
  .bb-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1.2rem;
    padding: 2rem 1rem;
    text-align: center;
  }

  .bb-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(3rem, 12vw, 7rem);
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
    font-size: clamp(3.5rem, 13vw, 8rem);
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

  .bb-coming-soon {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(1.2rem, 4vw, 2rem);
    letter-spacing: 0.2em;
    color: var(--text2);
  }

  .bb-countdown {
    display: flex;
    gap: 1.5rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .bb-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.5rem;
  }

  .bb-unit-value {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(2rem, 8vw, 3.5rem);
    line-height: 1;
    color: var(--text);
  }

  .bb-unit-label {
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text3);
    margin-top: 0.25rem;
  }

  .bb-divider {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(2rem, 8vw, 3.5rem);
    line-height: 1;
    color: var(--text4);
    align-self: flex-start;
    padding-top: 0;
  }

  .bb-back-link {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: var(--text3);
    text-decoration: none;
  }

  .bb-back-link:hover {
    color: var(--text2);
  }

  .bb-header {
    text-align: center;
    margin-bottom: 4px;
  }

  .bb-header .bb-title {
    font-size: clamp(2.2rem, 8vw, 4rem);
  }

  .bb-header .bb-title-eye {
    font-size: clamp(2.6rem, 9vw, 4.6rem);
  }
`;

// ── Coming Soon (pre-launch countdown) ─────────────────────────────────────────
function BBComingSoon() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bb-page">
      <div className="bb-title">
        <span className="bb-title-left">BIG BR</span>
        <span className="bb-title-eye">👁</span>
        <span className="bb-title-right">THERDLE</span>
      </div>
      <div className="bb-coming-soon">Coming Soon</div>

      {timeLeft ? (
        <div className="bb-countdown">
          <div className="bb-unit">
            <span className="bb-unit-value">{String(timeLeft.days).padStart(2, "0")}</span>
            <span className="bb-unit-label">Days</span>
          </div>
          <span className="bb-divider">:</span>
          <div className="bb-unit">
            <span className="bb-unit-value">{String(timeLeft.hours).padStart(2, "0")}</span>
            <span className="bb-unit-label">Hours</span>
          </div>
          <span className="bb-divider">:</span>
          <div className="bb-unit">
            <span className="bb-unit-value">{String(timeLeft.minutes).padStart(2, "0")}</span>
            <span className="bb-unit-label">Minutes</span>
          </div>
          <span className="bb-divider">:</span>
          <div className="bb-unit">
            <span className="bb-unit-value">{String(timeLeft.seconds).padStart(2, "0")}</span>
            <span className="bb-unit-label">Seconds</span>
          </div>
        </div>
      ) : (
        <div className="bb-coming-soon">Now Live!</div>
      )}

      <Link to="/" className="bb-back-link">← Back to Survivordle</Link>
    </div>
  );
}

// ── Daily mode ─────────────────────────────────────────────────────────────────
function BBDaily({ contestants, colorblind }) {
  const navigate = useNavigate();
  const puzzleNum = getBBPuzzleNumber();
  const answer = useMemo(() => getDailyBBAnswer(contestants), [contestants]);
  const [saved] = useState(() => loadTodayBBGame(puzzleNum));

  // Auto-refresh at midnight ET
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), msUntilMidnightET());
    return () => clearTimeout(timer);
  }, []);

  function handleMidGame({ guesses, results, hintEpisode, hintNeighbors }) {
    saveBBMidGame({ puzzleNum, guesses, results, hintEpisode, hintNeighbors });
  }

  function handleComplete({ won, guessCount, emojiGrid, guesses, results, gaveUp }) {
    saveBBCompletedGame({ puzzleNum, won, gaveUp, guessCount, emojiGrid });
    const s = loadBBStorage();
    saveBBStorage({ ...s, guessObjects: guesses, resultObjects: results });
  }

  if (!answer) return <div className="loading">👁 Loading the house…</div>;

  return (
    <>
      <div className="mode-banner">
        <div className="mode-banner-left">
          <span className="mode-banner-label">Big Brotherdle Daily</span>
          <span className="mode-banner-title">👁 Puzzle #{puzzleNum}</span>
        </div>
      </div>
      <BBGameBoard
        key={puzzleNum}
        answer={answer}
        mode="bb"
        puzzleNum={puzzleNum}
        contestants={contestants}
        onMidGame={handleMidGame}
        onNavigateStats={() => navigate("/bb/stats")}
        onNavigateRecall={() => navigate("/bb/recall")}
        onNavigateSandwich={() => navigate("/bb/sandwich")}
        onNavigateHome={() => navigate("/")}
        onComplete={handleComplete}
        colorblind={colorblind}
        initialGuesses={saved?.guessObjects   || []}
        initialResults={saved?.resultObjects  || []}
        initialGameOver={saved?.gameOver      || false}
        initialWon={saved?.won                || false}
        initialGaveUp={saved?.gaveUp          || false}
        initialHintEpisode={saved?.hintEpisode     || false}
        initialHintNeighbors={saved?.hintNeighbors || false}
      />
    </>
  );
}

// ── Archive mode ───────────────────────────────────────────────────────────────
function BBArchive({ contestants, colorblind }) {
  const navigate = useNavigate();
  const [selectedPuzzle, setSelectedPuzzle] = useState(null);
  const puzzleNum = getBBPuzzleNumber();
  const pastPuzzles = Array.from({ length: puzzleNum - 1 }, (_, i) => puzzleNum - 1 - i);

  const selectedAnswer = selectedPuzzle !== null ? getBBAnswerForPuzzle(contestants, selectedPuzzle) : null;

  if (selectedPuzzle !== null && selectedAnswer) {
    return (
      <>
        <div className="mode-banner">
          <div className="mode-banner-left">
            <span className="mode-banner-label">Big Brotherdle Archive</span>
            <span className="mode-banner-title">Puzzle #{selectedPuzzle} · {getDateForBBPuzzle(selectedPuzzle)}</span>
          </div>
          <button className="archive-play-btn" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600 }} onClick={() => setSelectedPuzzle(null)}>
            ← Back to Archive
          </button>
        </div>
        <BBGameBoard
          key={selectedPuzzle}
          answer={selectedAnswer}
          mode="bb_archive"
          puzzleNum={selectedPuzzle}
          contestants={contestants}
          colorblind={colorblind}
          onNavigateStats={() => navigate("/bb/stats")}
        />
      </>
    );
  }

  return (
    <>
      <p className="modal-body" style={{ textAlign: "center", marginBottom: "20px" }}>
        Play any past puzzle. Archive games don't affect your stats or streak.
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
                <span className="archive-item-date">{getDateForBBPuzzle(n)}</span>
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
function BBUnlimited({ contestants, colorblind }) {
  const navigate = useNavigate();
  const [answer,   setAnswer]   = useState(() => getRandomBBAnswer(contestants));
  const [gameKey,  setGameKey]  = useState(0);
  const [gameOver, setGameOver] = useState(false);

  function handleComplete({ won, guessCount }) {
    saveBBUnlimitedGame({ won, guessCount });
    setGameOver(true);
  }

  function newGame() {
    setAnswer(getRandomBBAnswer(contestants));
    setGameKey(k => k + 1);
    setGameOver(false);
    window.ramp?.que?.push(() => window.ramp.spaNewPage(window.location.pathname));
  }

  if (!answer) return <div className="loading">👁 Loading the house…</div>;

  return (
    <>
      <div className="mode-banner">
        <div className="mode-banner-left">
          <span className="mode-banner-label">Big Brotherdle Unlimited</span>
          <span className="mode-banner-title">♾️ Random houseguest every game</span>
        </div>
        {gameOver && (
          <button className="archive-play-btn" onClick={newGame}>
            🔀 New Game
          </button>
        )}
      </div>
      <BBGameBoard
        key={gameKey}
        answer={answer}
        mode="bb_unlimited"
        puzzleNum={null}
        contestants={contestants}
        onComplete={handleComplete}
        colorblind={colorblind}
        onNavigateStats={() => navigate("/bb/stats")}
      />
    </>
  );
}

// ── "How to play" info popover ─────────────────────────────────────────────────
function BBInfoPopover() {
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
        aria-label="How to play"
        aria-expanded={open}
      >
        ⓘ <span className="recall-info-label">How to play</span>
      </button>

      {open && (
        <div className="recall-info-popover" role="dialog" aria-label="How to play">
          <p className="recall-info-heading">Guess the houseguest</p>
          <p className="recall-info-body">
            Guess the Big Brother houseguest in <strong>{BB_MAX_GUESSES} tries</strong>.
            Each guess reveals how close you are on every column. 🟩 exact match, 🟧 close, ⬛ no match.
          </p>
          <div className="recall-info-scoring">
            <div className="recall-info-score-row">
              <span className="recall-info-field">Season</span>
              <span className="recall-info-pts">🟧 if within 2 seasons</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Placement</span>
              <span className="recall-info-pts">🟧 if within 3 places</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Comp Wins</span>
              <span className="recall-info-pts">Total HOH + Veto wins — 🟧 if within 2</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Age</span>
              <span className="recall-info-pts">🟧 if within 5 years</span>
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

// ── Root BB page ───────────────────────────────────────────────────────────────
export default function BB({ colorblind }) {
  const location = useLocation();
  const [houseguests, setHouseguests] = useState([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: "Big Brotherdle: Daily Big Brother Houseguest Puzzle",
    description: "Guess today's Big Brother houseguest in 8 tries. A new puzzle every day. Test your Big Brother knowledge!",
    canonical: "https://survivordle.com/bb",
    image: "https://survivordle.com/Big_Brotherdle_Thumbnail.png",
  });

  useEffect(() => {
    fetch("/bb_contestants.json")
      .then(r => r.json())
      .then(data => { setHouseguests(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (BB_PRELAUNCH) {
    return (
      <>
        <style>{BB_CSS}</style>
        <BBComingSoon />
      </>
    );
  }

  const path = location.pathname.replace(/\/$/, "");
  const activeTab = path === "/bb/archive"   ? "archive"
                  : path === "/bb/unlimited" ? "unlimited"
                  : "daily";

  if (loading) return (
    <>
      <style>{BB_CSS}</style>
      <div className="loading">👁 Loading the house…</div>
    </>
  );

  return (
    <>
      <style>{BB_CSS}</style>
      <header className="header bb-header">
        <div className="bb-title">
          <span className="bb-title-left">BIG BR</span>
          <span className="bb-title-eye">👁</span>
          <span className="bb-title-right">THERDLE</span>
        </div>
        <div className="tagline">Guess the Big Brother Houseguest</div>
      </header>

      {isRankUnlocked() ? (
        <ModeTabs base="/bb" legacy={false}><BBInfoPopover /></ModeTabs>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <BBInfoPopover />
        </div>
      )}

      {activeTab === "daily"     && <BBDaily     contestants={houseguests} colorblind={colorblind} />}
      {activeTab === "archive"   && <BBArchive   contestants={houseguests} colorblind={colorblind} />}
      {activeTab === "unlimited" && <BBUnlimited contestants={houseguests} colorblind={colorblind} />}
    </>
  );
}
