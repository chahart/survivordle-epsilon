import { useState, useEffect, useMemo, useRef } from "react";
import { CONNECTIONS_MAX_MISTAKES, checkGuess, shuffleTiles } from "../shared/connectionsLogic";
import { getCustomPuzzleUrl } from "../shared/customConnections";

const DIFF_EMOJI = { 1: "🟩", 2: "🟧", 3: "🟪", 4: "🟥" };

export default function ConnectionsGame({
  puzzle,
  mode,
  weekNum,
  customCode,
  colorblind,
  onComplete,
  onMidGame,
  onNavigateStats,
  onNavigateDaily,
  initialSolvedGroups,
  initialMistakes,
  initialGuessHistory,
  initialGameOver,
  initialWon,
}) {
  const groups = puzzle.groups;
  const allItems = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // Dedupe and drop any out-of-range indices from restored/saved state so a
  // corrupted save can never hide a real group or leave the board stuck.
  function sanitizeSolved(idxList) {
    const seen = new Set();
    const clean = [];
    for (const gi of idxList || []) {
      if (groups[gi] && !seen.has(gi)) {
        seen.add(gi);
        clean.push(gi);
      }
    }
    return clean;
  }

  const [tileOrder, setTileOrder] = useState(() => shuffleTiles(allItems));
  const [solvedGroups, setSolvedGroups] = useState(() => sanitizeSolved(initialSolvedGroups));
  const [selected, setSelected] = useState([]);
  const [mistakes, setMistakes] = useState(initialMistakes || 0);
  const [guessHistory, setGuessHistory] = useState(initialGuessHistory || []);
  const [gameOver, setGameOver] = useState(initialGameOver || false);
  const [won, setWon] = useState(initialWon || false);
  const [toast, setToast] = useState("");
  const [shakeGroup, setShakeGroup] = useState(null);
  const [flashGroupIndex, setFlashGroupIndex] = useState(null);
  const [bounceGroup, setBounceGroup] = useState(null);
  const [locked, setLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [askContinue, setAskContinue] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [bonusMode, setBonusMode] = useState(false);
  const [bonusSolved, setBonusSolved] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const toastTimer = useRef(null);
  const revealTimer = useRef(null);
  const shuffleTimer = useRef(null);

  const solvedItemSet = useMemo(
    () => new Set(solvedGroups.flatMap(gi => groups[gi]?.items || [])),
    [solvedGroups, groups]
  );
  const remainingTiles = tileOrder.filter(item => !solvedItemSet.has(item));

  function showToast(msg, ms = 1500) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), ms);
  }

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(revealTimer.current);
    clearTimeout(shuffleTimer.current);
  }, []);

  // If a saved game was restored already over (e.g. the page closed mid-reveal
  // or mid bonus-round) but some groups never got shown, reveal them now so a
  // finished game never leaves any group hidden.
  useEffect(() => {
    const cleanInitial = sanitizeSolved(initialSolvedGroups);
    if (initialGameOver && cleanInitial.length < groups.length) {
      revealRemaining();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTile(item) {
    if ((gameOver && !bonusMode) || locked || askContinue || revealing || solvedItemSet.has(item)) return;
    setSelected(sel => {
      if (sel.includes(item)) return sel.filter(x => x !== item);
      if (sel.length >= 4) return sel;
      return [...sel, item];
    });
  }

  function finish(newSolvedGroups, didWin, finalMistakes, finalGuesses) {
    setGameOver(true);
    setWon(didWin);
    onComplete?.({
      weekNum,
      won: didWin,
      mistakes: finalMistakes,
      guesses: finalGuesses,
      solvedGroups: newSolvedGroups,
    });
  }

  // Reveal the remaining unsolved groups one at a time, slowly —
  // a pause, then a group, then a pause, then the next group, and so on.
  // Each tick re-derives "what's still missing" from live state rather than
  // trusting a fixed snapshot, so it's immune to being called more than once
  // (StrictMode double-invoking effects, a stray double-click, etc.) — extra
  // calls just converge on the same end state instead of dropping a group.
  const REVEAL_FIRST_GAP_MS = 1000;
  const REVEAL_GAP_MS = 2000;
  const revealInFlight = useRef(false);
  // A reveal chain, once started, owns the pacing until it's genuinely done.
  // A repeat call while one is already running (StrictMode's double effect
  // invocation, a stray double-click, etc.) is a plain no-op — the running
  // chain re-derives "what's missing" from live state on every tick, so it
  // will still reveal everything correctly on its own steady cadence.
  function revealRemaining() {
    if (revealInFlight.current) return;
    revealInFlight.current = true;
    setRevealing(true);

    function scheduleNext(delay) {
      revealTimer.current = setTimeout(() => {
        setSolvedGroups(prev => {
          const missing = groups.map((_, i) => i).find(i => !prev.includes(i));
          const next = missing === undefined ? prev : [...prev, missing];
          if (next.length < groups.length) {
            scheduleNext(REVEAL_GAP_MS);
          } else {
            revealInFlight.current = false;
            setRevealing(false);
          }
          return next;
        });
      }, delay);
    }
    scheduleNext(REVEAL_FIRST_GAP_MS);
  }

  function handleKeepGoing() {
    setAskContinue(false);
    setBonusMode(true);
  }

  function handleStopHere() {
    setAskContinue(false);
    revealRemaining();
  }

  function handleGiveUp() {
    setBonusMode(false);
    setSelected([]);
    revealRemaining();
  }

  function submitGuess() {
    if (selected.length !== 4 || locked || revealing || askContinue) return;
    if (gameOver && !bonusMode) return;
    const alreadyGuessed = guessHistory.some(
      g => g.length === 4 && g.every(x => selected.includes(x))
    );
    if (alreadyGuessed) {
      showToast("Already guessed that group!");
      return;
    }

    const result = checkGuess(selected, groups);
    const newHistory = [...guessHistory, selected];
    setGuessHistory(newHistory);
    setLocked(true);

    // Phase 1: confirm the submit with a staggered per-tile bounce (~ 4 * 90ms + settle)
    setBounceGroup(selected);
    const BOUNCE_MS = 620;

    if (result.correct) {
      setTimeout(() => {
        setBounceGroup(null);
        setFlashGroupIndex(result.groupIndex);
        setTimeout(() => {
          const newSolved = [...solvedGroups, result.groupIndex];
          setSolvedGroups(newSolved);
          setSelected([]);
          setFlashGroupIndex(null);
          setLocked(false);
          if (bonusMode) {
            // Result was already recorded as a loss — bonus play doesn't touch stats.
            if (newSolved.length === 4) {
              setBonusMode(false);
              setBonusSolved(true);
            }
          } else if (newSolved.length === 4) {
            finish(newSolved, true, mistakes, newHistory);
          } else {
            onMidGame?.({ weekNum, guesses: newHistory, solvedGroups: newSolved, mistakes });
          }
        }, 700);
      }, BOUNCE_MS);
      return;
    }

    // Wrong guess
    setTimeout(() => {
      setBounceGroup(null);
      setShakeGroup(selected);
      if (result.oneAway) showToast("One away…");
      const newMistakes = mistakes + 1;
      setTimeout(() => {
        setShakeGroup(null);
        setLocked(false);
        setMistakes(newMistakes);
        if (bonusMode) {
          // Bonus play is untracked — don't persist over the already-recorded loss.
        } else if (newMistakes >= CONNECTIONS_MAX_MISTAKES) {
          // Loss is recorded now — continuing past this point (if they choose to)
          // is untracked bonus play and won't change this result.
          finish(solvedGroups, false, newMistakes, newHistory);
          setAskContinue(true);
        } else {
          onMidGame?.({ weekNum, guesses: newHistory, solvedGroups, mistakes: newMistakes });
        }
      }, 500);
    }, BOUNCE_MS);
  }

  function handleShuffle() {
    setTileOrder(shuffleTiles(tileOrder));
    setShuffling(true);
    clearTimeout(shuffleTimer.current);
    shuffleTimer.current = setTimeout(() => setShuffling(false), 300);
  }

  function handleDeselectAll() {
    setSelected([]);
  }

  function handleShare() {
    const label = mode === "connections_archive"
      ? `Survivordle Connections Archive #${weekNum}`
      : mode === "connections_custom"
      ? `Survivordle Connections (Custom)`
      : `Survivordle Connections #${weekNum}`;
    const link = mode === "connections_custom" && customCode
      ? getCustomPuzzleUrl(customCode)
      : "survivordle.com/connections";

    // Clean win within the 4-mistake limit: NYT-style emoji grid, one row
    // per guess, colored by which group each tile actually belongs to.
    // Anything else (a loss, or solved only after burning all 4 mistakes
    // and continuing on bonus guesses) shows a plain guess count instead —
    // the emoji grid only makes sense when every guess counted the same way.
    const resultLine = won
      ? guessHistory.map(g =>
          g.map(item => {
            const gi = groups.findIndex(grp => grp.items.includes(item));
            return DIFF_EMOJI[groups[gi]?.difficulty] || "⬜";
          }).join("")
        ).join("\n")
      : `Number of guesses: ${guessHistory.length}`;

    const text = `${label}\n${resultLine}\n${link}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const bannerLabel = mode === "connections_archive"
    ? `Connections Archive`
    : mode === "connections_custom"
    ? `Connections Custom`
    : `Connections #${weekNum}`;

  return (
    <div className="cx-board" style={{ position: "relative" }}>

      {/* Solved groups, in the order they were guessed */}
      {solvedGroups.map(gi => {
        const g = groups[gi];
        if (!g) return null;
        return (
          <div key={gi} className={`cx-solved-row cx-diff-${g.difficulty}`}>
            <span className="cx-solved-category">
              {colorblind && <strong>{g.difficulty}&nbsp;· </strong>}
              {g.category}
            </span>
            <span className="cx-solved-items">{g.items.join(", ")}</span>
          </div>
        );
      })}

      {/* Tile grid */}
      {remainingTiles.length > 0 && (
        <div className="cx-grid">
          {remainingTiles.map((item, idx) => {
            const isSelected = selected.includes(item);
            const isShaking = shakeGroup?.includes(item);
            const bounceIdx = bounceGroup?.indexOf(item);
            const isBouncing = bounceIdx > -1;
            const flashClass = flashGroupIndex !== null && groups[flashGroupIndex].items.includes(item)
              ? ` cx-diff-${groups[flashGroupIndex].difficulty}-flash`
              : "";
            const style = isBouncing
              ? { animationDelay: `${bounceIdx * 90}ms` }
              : shuffling
              ? { animationDelay: `${(idx % 4) * 25}ms` }
              : undefined;
            const lengthClass = item.length > 24 ? " cx-tile-xs" : item.length > 16 ? " cx-tile-sm" : "";
            return (
              <div
                key={item}
                className={`cx-tile${lengthClass}${isSelected ? " cx-selected" : ""}${isShaking ? " cx-shake" : ""}${isBouncing ? " cx-bounce" : ""}${shuffling ? " cx-shuffle" : ""}${flashClass}`}
                style={style}
                onClick={() => toggleTile(item)}
              >
                {item}
              </div>
            );
          })}
        </div>
      )}

      {toast && <div className="cx-toast">{toast}</div>}

      {askContinue && (
        <div className="cx-continue-overlay">
          <div className="cx-continue-prompt">
            <p className="cx-continue-text">Out of guesses! Want to keep going with unlimited guesses?</p>
            <div className="cx-actions">
              <button className="cx-action-btn cx-submit" onClick={handleKeepGoing}>
                Yes, keep going
              </button>
              <button className="cx-action-btn" onClick={handleStopHere}>
                No, reveal the answers
              </button>
            </div>
          </div>
        </div>
      )}

      {(!gameOver || bonusMode) && !askContinue && (
        <>
          <div className="cx-mistakes">
            {bonusMode ? "Bonus guesses:" : "Mistakes:"}
            {bonusMode
              ? <span className="cx-mistake-count">{mistakes}</span>
              : Array.from({ length: CONNECTIONS_MAX_MISTAKES }, (_, i) => (
                  <span key={i} className={`cx-mistake-dot${i < mistakes ? " cx-used" : ""}`} />
                ))
            }
          </div>
          <div className="cx-actions">
            <button className="cx-action-btn" onClick={handleShuffle} disabled={locked}>
              🔀 Shuffle
            </button>
            <button className="cx-action-btn" onClick={handleDeselectAll} disabled={locked || selected.length === 0}>
              Deselect All
            </button>
            <button className="cx-action-btn cx-submit" onClick={submitGuess} disabled={locked || selected.length !== 4}>
              Submit
            </button>
            {bonusMode && (
              <button className="cx-action-btn cx-give-up" onClick={handleGiveUp} disabled={locked}>
                Give Up
              </button>
            )}
          </div>
        </>
      )}

      {gameOver && !askContinue && !revealing && !bonusMode && (
        <div className={`status-banner ${won ? "win" : "lose"}`}>
          {won
            ? <>⛓️ {bannerLabel} solved with {mistakes} mistake{mistakes !== 1 ? "s" : ""}!</>
            : <>{bannerLabel}: out of guesses. {bonusSolved ? "Solved it anyway on bonus guesses!" : ""}</>
          }
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
            {onNavigateDaily && (
              <button className="share-btn" onClick={onNavigateDaily}>
                ⛓️ Daily
              </button>
            )}
          </div>
          {mode === "connections_daily" && (
            <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "13px", marginTop: "10px" }}>
              Come back soon for the next puzzle!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
