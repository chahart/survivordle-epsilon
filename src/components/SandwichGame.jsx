import { useState, useEffect, useMemo } from "react";
import { normalize } from "../shared/gameLogic";
import { SANDWICH_MAX_GUESSES, getNeighborPlacements } from "../shared/sandwichLogic";
import { logSandwichEvent } from "../shared/supabase";

const TRIBE_COLOR_MAP = {
  "Black":       "#333333",
  "Blue/Teal":   "#1a7abf",
  "Brown":       "#8b5e3c",
  "Green":       "#2e8b57",
  "Magenta":     "#c0306a",
  "Orange":      "#e8742a",
  "Purple":      "#7b2d8b",
  "Red":         "#c0392b",
  "Yellow/Gold": "#d4a017",
};

function TribeDot({ color, size = 12 }) {
  const hex = TRIBE_COLOR_MAP[color] || "#888";
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: hex, border: "1px solid rgba(255,255,255,0.15)",
      flexShrink: 0, verticalAlign: "middle", marginRight: 6,
    }} />
  );
}

const SANDWICH_SHARE_EMOJI = { correct: "🟩", wrong: "🟥" };

export default function SandwichGame({
  answer,
  mode,
  puzzleNum,
  contestants,
  colorblind,
  onComplete,
  onMidGame,
  onNavigateStats,
  onNavigateConnections,
  onNavigateDaily,
  initialGuesses,
  initialGameOver,
  initialWon,
}) {
  const [guesses,        setGuesses]        = useState(initialGuesses  || []);
  const [gameOver,       setGameOver]       = useState(initialGameOver || false);
  const [won,            setWon]            = useState(initialWon      || false);
  const [query,          setQuery]          = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIdx,      setActiveIdx]      = useState(-1);
  const [error,          setError]          = useState("");
  const [copied,         setCopied]         = useState(false);
  const [settling,       setSettling]       = useState(false);
  const [hintsVisible,   setHintsVisible]   = useState(initialGuesses?.length > 0 ? initialGuesses.length : 0);

  // Debounce search input — only filter after 150ms pause in typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const suggestions = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = normalize(debouncedQuery);
    return contestants
      .filter(c =>
        (c.nameNorm || normalize(c.name)).includes(q) ||
        (c.showNameNorm || normalize(c.showName)).includes(q)
      )
      .sort((a, b) => {
        const aShow = normalize(a.showName).startsWith(q);
        const bShow = normalize(b.showName).startsWith(q);
        if (aShow && !bShow) return -1;
        if (!aShow && bShow) return 1;
        return 0;
      })
      .slice(0, 10);
  }, [debouncedQuery, contestants]);

  const isCorrect = c => c.castaway_id === answer.castaway_id;
  const missCount = guesses.length - (won ? 1 : 0);
  const remaining = SANDWICH_MAX_GUESSES - guesses.length;
  const neighbors = useMemo(() => getNeighborPlacements(contestants, answer), [contestants, answer]);

  function finish(newGuesses, didWin) {
    logSandwichEvent({
      puzzle: `${answer.name} - ${answer.seasonNameFull}`,
      season: answer.season,
      placedBefore: answer.placedBefore,
      placedAfter: answer.placedAfter,
      guesses: newGuesses.length,
      won: didWin,
      mode,
      firstGuess: newGuesses[0] ? `${newGuesses[0].name} - ${newGuesses[0].seasonNameFull}` : null,
      secondGuess: newGuesses[1] ? `${newGuesses[1].name} - ${newGuesses[1].seasonNameFull}` : null,
    });
    onComplete?.({ won: didWin, guessCount: newGuesses.length, guesses: newGuesses });
  }

  function submitGuess(c) {
    if (!c || gameOver || settling) return;
    if (guesses.some(g => g.id === c.id)) {
      setError("Already guessed that appearance!");
      return;
    }
    setError("");
    const newGuesses = [...guesses, c];
    setGuesses(newGuesses);
    setQuery(""); setDebouncedQuery(""); setActiveIdx(-1);
    const didWin  = isCorrect(c);
    const didFail = !didWin && newGuesses.length >= SANDWICH_MAX_GUESSES;
    if (didWin || didFail) {
      setSettling(true);
      setTimeout(() => {
        if (didWin) setWon(true);
        setGameOver(true);
        setSettling(false);
        finish(newGuesses, didWin);
      }, 1000);
    } else {
      setSettling(true);
      setTimeout(() => {
        setHintsVisible(newGuesses.length);
        setSettling(false);
      }, 400);
      onMidGame?.({ guesses: newGuesses });
    }
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") { const t = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0]; if (t) submitGuess(t); }
    else if (e.key === "Escape") { setQuery(""); }
  }

  function handleShare() {
    const label = mode === "sandwich_unlimited"
      ? "Sandwich 🥪 Unlimited"
      : mode === "sandwich_archive"
      ? `Sandwich 🥪 Archive #${puzzleNum}`
      : `Sandwich 🥪 #${puzzleNum}`;
    const squares = guesses.map(g => isCorrect(g) ? SANDWICH_SHARE_EMOJI.correct : SANDWICH_SHARE_EMOJI.wrong).join("");
    const text = `${label} — ${won ? guesses.length : "X"}/${SANDWICH_MAX_GUESSES}\n${squares}\nsurvivordle.com/sandwich`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const bannerLabel = mode === "sandwich_unlimited"
    ? "Sandwich Unlimited"
    : mode === "sandwich_archive"
    ? `Sandwich Archive #${puzzleNum}`
    : `Sandwich #${puzzleNum}`;

  const cbStyle = colorblind ? `
    .sw-guess-row.correct { background: #0a2a5a; border: 1px solid #4a8aff; color: #b0d0ff; }
    .status-banner.win    { background: #0a1a3a; border: 1px solid #4a8aff; color: #b0d0ff; }
  ` : "";

  const showPlacements = hintsVisible >= 1 || gameOver;

  return (
    <div>
      {cbStyle && <style>{cbStyle}</style>}

      {/* The sandwich */}
      <div className="sw-card">
        <div className="sw-label">Who placed between these two castaways?</div>
        <div className="sw-sub-label">Top = better placement &nbsp;·&nbsp; Bottom = worse placement</div>
        <div className="sw-name">
          {neighbors.beforeShowName}
          {showPlacements && <span className="sw-place">#{neighbors.before}</span>}
        </div>
        <div className={`sw-name sw-mystery${gameOver ? " sw-revealed" : ""}`}>
          {gameOver ? answer.name : "???"}
          {showPlacements && <span className="sw-place">#{answer.placement}</span>}
        </div>
        <div className="sw-name">
          {neighbors.afterShowName}
          {showPlacements && <span className="sw-place">#{neighbors.after}</span>}
        </div>
      </div>

      {/* Hints revealed after each miss — staggered via hintsVisible */}
      {hintsVisible >= 1 && (
        <div className="hint-panels">
          <div className="hint-panel">
            <div className="hint-panel-label">Season</div>
            <div className="hint-panel-value">{answer.seasonNameFull}</div>
          </div>
          {hintsVisible >= 2 && (
            <div className="hint-panel">
              <div className="hint-panel-label">Starting Tribe</div>
              <div className="hint-panel-value">
                <TribeDot color={answer.tribe_color} />
                {answer.startingTribe} ({answer.tribe_color})
              </div>
            </div>
          )}
          {hintsVisible >= 3 && (
            <div className="hint-panel">
              <div className="hint-panel-label">Age &amp; Gender</div>
              <div className="hint-panel-value">{answer.age ?? "?"} · {answer.gender}</div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {!gameOver && (
        <div className="input-area">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder={settling ? "..." : "Search by castaway name…"}
              value={query}
              autoComplete="off"
              disabled={settling}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1); }}
              onKeyDown={handleKeyDown}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="autocomplete">
              {suggestions.map((c, i) => (
                <div
                  key={c.id}
                  className={`ac-item${i === activeIdx ? " active" : ""}`}
                  onMouseDown={() => submitGuess(c)}
                >
                  <span className="ac-name">{c.name}</span>
                  <span className="ac-meta">{c.seasonNameFull} · S{c.season}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {!gameOver && (
        <div className="guess-counter">
          {guesses.length === 0
            ? `${SANDWICH_MAX_GUESSES} guesses — a hint after each miss`
            : `${remaining} guess${remaining !== 1 ? "es" : ""} remaining`}
        </div>
      )}

      {/* Game over banner */}
      {gameOver && (
        <div className={`status-banner ${won ? "win" : "lose"}`}>
          {won
            ? <>🥪 {bannerLabel} — got it in {guesses.length}!</>
            : <>{bannerLabel} — the tribe has voted you out.</>
          }
          <span className="status-name">{answer.name}</span>
          <span className="status-sub">{answer.seasonNameFull} · {answer.result}</span>
          <br />
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "10px", flexWrap: "wrap" }}>
            <button className="share-btn" onClick={handleShare}>
              {copied ? "✓ Copied!" : "📋 Share"}
            </button>
            {onNavigateStats && (
              <button className="share-btn" onClick={onNavigateStats}>
                📊 Stats
              </button>
            )}
            {onNavigateConnections && (
              <button className="share-btn" onClick={onNavigateConnections}>
                ⛓️ Connections
              </button>
            )}
            {onNavigateDaily && (
              <button className="share-btn" onClick={onNavigateDaily}>
                {mode === "sandwich_unlimited" ? "🔥 Daily" : "🥪 Daily"}
              </button>
            )}
          </div>
          {mode === "sandwich_daily" && (
            <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "13px", marginTop: "10px" }}>
              Come back tomorrow for Sandwich #{puzzleNum + 1}!
            </p>
          )}
        </div>
      )}

      {/* Past guesses */}
      {guesses.length > 0 && (
        <div className="sw-guesses">
          {guesses.map((g, i) => (
            <div key={g.id} className={`sw-guess-row ${isCorrect(g) ? "correct" : "wrong"}`}>
              <span className="sw-guess-num">{i + 1}</span>
              <span className="sw-guess-name">{g.name}</span>
              <span className="sw-guess-emoji">{isCorrect(g) ? "✓" : "✗"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
