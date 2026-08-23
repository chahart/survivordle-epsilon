import { useState, useEffect, useMemo, useRef } from "react";
import { CONNECTIONS_MAX_MISTAKES, checkGuess, shuffleTiles } from "../shared/connectionsLogic";

export default function ConnectionsGame({
  puzzle,
  mode,
  weekNum,
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

  const [tileOrder, setTileOrder] = useState(() => shuffleTiles(allItems));
  const [solvedGroups, setSolvedGroups] = useState(initialSolvedGroups || []);
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
  const [shuffling, setShuffling] = useState(false);
  const toastTimer = useRef(null);
  const revealTimer = useRef(null);
  const shuffleTimer = useRef(null);

  const solvedItemSet = useMemo(
    () => new Set(solvedGroups.flatMap(gi => groups[gi].items)),
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
    if (initialGameOver && (initialSolvedGroups?.length || 0) < groups.length) {
      revealRemaining(initialSolvedGroups || []);
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

  function finish(newSolvedGroups, didWin, finalMistakes) {
    setGameOver(true);
    setWon(didWin);
    onComplete?.({
      weekNum,
      won: didWin,
      mistakes: finalMistakes,
      guesses: guessHistory,
      solvedGroups: newSolvedGroups,
    });
  }

  // Reveal the remaining unsolved groups one at a time, slowly —
  // a pause, then a group, then a pause, then the next group, and so on.
  const REVEAL_FIRST_GAP_MS = 1000;
  const REVEAL_GAP_MS = 2000;
  function revealRemaining(currentSolved) {
    const remainingIdx = groups.map((_, i) => i).filter(i => !currentSolved.includes(i));
    if (remainingIdx.length === 0) return;
    setRevealing(true);
    let step = 0;
    function revealNext() {
      setSolvedGroups(prev => prev.includes(remainingIdx[step]) ? prev : [...prev, remainingIdx[step]]);
      step += 1;
      if (step < remainingIdx.length) {
        revealTimer.current = setTimeout(revealNext, REVEAL_GAP_MS);
      } else {
        setRevealing(false);
      }
    }
    revealTimer.current = setTimeout(revealNext, REVEAL_FIRST_GAP_MS);
  }

  function handleKeepGoing() {
    setAskContinue(false);
    setBonusMode(true);
  }

  function handleStopHere() {
    setAskContinue(false);
    revealRemaining(solvedGroups);
  }

  function handleGiveUp() {
    setBonusMode(false);
    setSelected([]);
    revealRemaining(solvedGroups);
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
            if (newSolved.length === 4) setBonusMode(false);
          } else if (newSolved.length === 4) {
            finish(newSolved, true, mistakes);
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
          finish(solvedGroups, false, newMistakes);
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
      : `Survivordle Connections #${weekNum}`;
    const text = `${label}\nNumber of guesses: ${guessHistory.length}\nSurvivordle.com/connections`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const bannerLabel = mode === "connections_archive"
    ? `Connections Archive`
    : `Connections #${weekNum}`;

  return (
    <div className="cx-board" style={{ position: "relative" }}>
      {puzzle.title && (
        <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "13px", marginBottom: "10px" }}>
          {puzzle.title}
        </p>
      )}

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
            return (
              <div
                key={item}
                className={`cx-tile${isSelected ? " cx-selected" : ""}${isShaking ? " cx-shake" : ""}${isBouncing ? " cx-bounce" : ""}${shuffling ? " cx-shuffle" : ""}${flashClass}`}
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
            ? <>⛓️ {bannerLabel} — solved with {mistakes} mistake{mistakes !== 1 ? "s" : ""}!</>
            : <>{bannerLabel} — out of guesses. {solvedGroups.length === 4 ? "Solved it anyway on bonus guesses!" : ""}</>
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
              Come back next week for Connections #{weekNum + 1}!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
