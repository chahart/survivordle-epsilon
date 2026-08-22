import { useState, useEffect, useMemo, useRef } from "react";
import { CONNECTIONS_MAX_MISTAKES, checkGuess, shuffleTiles } from "../shared/connectionsLogic";

const DIFF_LABEL = { 1: "Straightforward", 2: "Medium", 3: "Tricky", 4: "Tough" };
const DIFF_EMOJI = { 1: "🟨", 2: "🟩", 3: "🟦", 4: "🟪" };

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
  const [locked, setLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef(null);

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

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function toggleTile(item) {
    if (gameOver || locked || solvedItemSet.has(item)) return;
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

  function submitGuess() {
    if (selected.length !== 4 || gameOver || locked) return;
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

    if (result.correct) {
      setFlashGroupIndex(result.groupIndex);
      setTimeout(() => {
        const newSolved = [...solvedGroups, result.groupIndex];
        setSolvedGroups(newSolved);
        setSelected([]);
        setFlashGroupIndex(null);
        setLocked(false);
        if (newSolved.length === 4) {
          finish(newSolved, true, mistakes);
        } else {
          onMidGame?.({ weekNum, guesses: newHistory, solvedGroups: newSolved, mistakes });
        }
      }, 700);
      return;
    }

    // Wrong guess
    setShakeGroup(selected);
    if (result.oneAway) showToast("One away…");
    const newMistakes = mistakes + 1;
    setTimeout(() => {
      setShakeGroup(null);
      setLocked(false);
      setMistakes(newMistakes);
      if (newMistakes >= CONNECTIONS_MAX_MISTAKES) {
        const allGroupIdx = groups.map((_, i) => i).filter(i => !solvedGroups.includes(i));
        setSolvedGroups([...solvedGroups, ...allGroupIdx]);
        setSelected([]);
        finish([...solvedGroups, ...allGroupIdx], false, newMistakes);
      } else {
        setSelected([]);
        onMidGame?.({ weekNum, guesses: newHistory, solvedGroups, mistakes: newMistakes });
      }
    }, 500);
  }

  function handleShuffle() {
    setTileOrder(shuffleTiles(tileOrder));
  }

  function handleDeselectAll() {
    setSelected([]);
  }

  function handleShare() {
    const label = mode === "connections_archive"
      ? `Survivordle Connections Archive #${weekNum}`
      : `Survivordle Connections #${weekNum}`;
    const rows = guessHistory.map(g => {
      const diffs = g.map(item => {
        const gi = groups.findIndex(grp => grp.items.includes(item));
        return groups[gi].difficulty;
      });
      return diffs.map(d => DIFF_EMOJI[d]).join("");
    });
    const text = `${label} — ${won ? `${mistakes} mistake${mistakes !== 1 ? "s" : ""}` : "X"}\n${rows.join("\n")}\nsurvivordle.com/connections`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const bannerLabel = mode === "connections_archive"
    ? `Connections Archive`
    : `Connections #${weekNum}`;

  const orderedSolved = [...solvedGroups].sort((a, b) => groups[a].difficulty - groups[b].difficulty);

  return (
    <div>
      {puzzle.title && (
        <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "13px", marginBottom: "10px" }}>
          {puzzle.title}
        </p>
      )}

      {/* Solved groups, revealed in difficulty order */}
      {orderedSolved.map(gi => {
        const g = groups[gi];
        return (
          <div key={gi} className={`cx-solved-row cx-diff-${g.difficulty}`}>
            <span className="cx-solved-badge">
              {colorblind && <strong>{g.difficulty}&nbsp;· </strong>}
              {DIFF_LABEL[g.difficulty]}
            </span>
            <span className="cx-solved-category">{g.category}</span>
            <span className="cx-solved-items">{g.items.join(", ")}</span>
          </div>
        );
      })}

      {/* Tile grid */}
      {remainingTiles.length > 0 && (
        <div className="cx-grid">
          {remainingTiles.map(item => {
            const isSelected = selected.includes(item);
            const isShaking = shakeGroup?.includes(item);
            const flashClass = flashGroupIndex !== null && groups[flashGroupIndex].items.includes(item)
              ? ` cx-diff-${groups[flashGroupIndex].difficulty}-flash`
              : "";
            return (
              <div
                key={item}
                className={`cx-tile${isSelected ? " cx-selected" : ""}${isShaking ? " cx-shake" : ""}${flashClass}`}
                onClick={() => toggleTile(item)}
              >
                {item}
              </div>
            );
          })}
        </div>
      )}

      {toast && <div className="cx-toast">{toast}</div>}

      {!gameOver && (
        <>
          <div className="cx-mistakes">
            Mistakes:
            {Array.from({ length: CONNECTIONS_MAX_MISTAKES }, (_, i) => (
              <span key={i} className={`cx-mistake-dot${i < mistakes ? " cx-used" : ""}`} />
            ))}
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
          </div>
        </>
      )}

      {gameOver && (
        <div className={`status-banner ${won ? "win" : "lose"}`}>
          {won
            ? <>⛓️ {bannerLabel} — solved with {mistakes} mistake{mistakes !== 1 ? "s" : ""}!</>
            : <>{bannerLabel} — out of guesses.</>
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
