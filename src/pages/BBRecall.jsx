import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  saveBBRecallUnlimitedGame, loadAllBBRecallDailyResults, loadBBRecallUnlimitedHistory,
  loadBBRecallResult, saveBBRecallResult,
} from "../shared/storage";
import { logBBRecallEvent } from "../shared/supabase";
import {
  scoreSeason, scorePlacement, scoreAge, scoreCompWins, getGrade,
  buildStintMap, pickRandom,
  getBBRecallDailyAnswer, getBBRecallAnswerForPuzzle,
  getPastBBRecallPuzzleNumbers, getDateForBBRecallPuzzle, getBBRecallPuzzleNumber,
  computeGPA, computeGradeDist,
} from "../shared/bbRecallLogic";
import useSEO from "../shared/useSEO";
import { isRankUnlocked } from "../shared/rankStorage";
import ResultCard from "../components/ResultCard";

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
  .bb-theme .ul-subtab.active,
  .bb-theme .mode-banner-title,
  .bb-theme .archive-item-num,
  .bb-theme .stats-grid-num,
  .bb-theme .status-name,
  .bb-theme .recall-castaway-name,
  .bb-theme .recall-info-heading {
    color: #5aaedd;
  }
  .bb-theme .ul-subtab.active {
    background: #5aaedd22;
    border-color: #5aaedd;
  }
  .bb-theme .share-btn:hover,
  .bb-theme .recall-again-btn:hover,
  .bb-theme .recall-info-btn:hover {
    border-color: #5aaedd;
    color: #5aaedd;
  }
  .bb-theme .recall-info-btn:hover {
    background: rgba(90,174,221,0.08);
  }
  .bb-theme .recall-input:focus,
  .bb-theme .recall-select-wrap:focus-within {
    border-color: #5aaedd;
  }
  .bb-theme .recall-submit-btn {
    background: linear-gradient(135deg, #1a6fbf, #5aaedd);
  }
  .bb-theme .stat-bar {
    background: linear-gradient(90deg, #1a6fbf, #5aaedd);
  }
  .bb-theme .archive-play-btn {
    background: linear-gradient(135deg, #1a6fbf, #5aaedd);
  }
`;

// ── Shared helpers ─────────────────────────────────────────────────────────────
function gradeColor(grade) {
  if (grade === "A+" || grade === "A" || grade === "A-") return "#4aaa4a";
  if (grade === "F") return "#aa4a4a";
  return "#e8742a";
}

// Build display name with quoted nickname when showName differs from the legal name
function buildDisplayName(houseguest, stintLabel) {
  const { name, showName } = houseguest;
  let formatted = name;
  if (showName && !name.toLowerCase().includes(showName.toLowerCase())) {
    const spaceIdx = name.indexOf(" ");
    if (spaceIdx === -1) {
      formatted = `${name} "${showName}"`;
    } else {
      const first     = name.slice(0, spaceIdx);
      const remainder = name.slice(spaceIdx + 1);
      formatted = `${first} "${showName}" ${remainder}`;
    }
  }
  return stintLabel ? `${formatted} (${stintLabel})` : formatted;
}

// ── Name shuffle animation ─────────────────────────────────────────────────────
// phase: "loading" | "shuffling" | "revealed"
function useNameReveal(houseguest, eligiblePool, skip) {
  const [phase,       setPhase]       = useState(skip ? "revealed" : "loading");
  const [shuffleName, setShuffleName] = useState("");
  const [settling,    setSettling]    = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (skip) { setPhase("revealed"); setSettling(false); return; }

    setPhase("loading");
    setShuffleName("");
    setSettling(false);

    const others = eligiblePool.filter(c => c.id !== houseguest.id);
    const fakes = [];
    const usedIdx = new Set();
    while (fakes.length < 3 && fakes.length < others.length) {
      const idx = Math.floor(Math.random() * others.length);
      if (!usedIdx.has(idx)) { usedIdx.add(idx); fakes.push(others[idx].name); }
    }

    const schedule = (fn, delay) => {
      const id = setTimeout(fn, delay);
      timersRef.current.push(id);
      return id;
    };

    let t = 400;
    schedule(() => setPhase("shuffling"), 0);
    const durations = [180, 140, 100];
    fakes.forEach((name, i) => {
      schedule(() => setShuffleName(name), t);
      t += durations[i];
    });
    schedule(() => {
      setPhase("revealed");
      setSettling(true);
      schedule(() => setSettling(false), 200);
    }, t);

    return () => { timersRef.current.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseguest.id]);

  return { phase, shuffleName, settling };
}

// ── Flip card result display ───────────────────────────────────────────────────
const FLIP_RESULT_COLOR = {
  correct: "#4aaa4a",
  close:   "#e8742a",
  wrong:   "#e05040",
};
const FLIP_RESULT_BG = {
  correct: "rgba(74,170,74,0.12)",
  close:   "rgba(232,116,42,0.12)",
  wrong:   "rgba(224,80,64,0.12)",
};

function flipScoreClass(pts, max) {
  if (pts === max) return "correct";
  if (pts > 0)     return "close";
  return "wrong";
}

function FlipCard({ label, guessDisplay, answerDisplay, pts, maxPts, flipped }) {
  const cls       = flipScoreClass(pts, maxPts);
  const textColor = FLIP_RESULT_COLOR[cls];
  const bgColor   = FLIP_RESULT_BG[cls];

  return (
    <div className="rfc-perspective">
      <div className={`rfc-inner${flipped ? " rfc-flipped" : ""}`}>

        {/* Face */}
        <div className="rfc-face rfc-face--front">
          <span className="rfc-label">{label}</span>
          <span className="rfc-guess-main">{guessDisplay}</span>
        </div>

        {/* Back */}
        <div className="rfc-face rfc-face--back" style={{ background: bgColor, borderColor: textColor }}>
          <span className="rfc-label">{label}</span>
          <span className="rfc-back-guess">{guessDisplay}</span>
          <span className="rfc-answer" style={{ color: textColor }}>{answerDisplay}</span>
          <span className="rfc-pts" style={{ color: textColor }}>+{pts} / {maxPts}</span>
        </div>

      </div>
    </div>
  );
}

function FlipResults({
  skipAnimation,
  seasonVal, placementVal, ageVal, compWinsVal,
  houseguest,
  seasonPts, placementPts, agePts, compWinsPts, total, grade,
  onShare, copied,
  mode, isDaily, onNavigateStats,
}) {
  const navigate = useNavigate();
  const ALL_FLIPPED = [true, true, true, true];
  const [flipped,      setFlipped]      = useState(skipAnimation ? ALL_FLIPPED : [false, false, false, false]);
  const [scoreVisible, setScoreVisible] = useState(skipAnimation);
  const timersRef = useRef([]);

  useEffect(() => {
    if (skipAnimation) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const schedule = (fn, delay) => {
      const id = setTimeout(fn, delay);
      timersRef.current.push(id);
    };

    [0, 1, 2, 3].forEach(i => {
      schedule(() => {
        setFlipped(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * 600);
    });

    schedule(() => setScoreVisible(true), 1800 + 400);

    return () => { timersRef.current.forEach(clearTimeout); };
  // Only runs once on mount — intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="recall-results">
      <div className="rfc-grid">
        <FlipCard
          label="Season"
          guessDisplay={`S${seasonVal}`}
          answerDisplay={`S${houseguest.season}`}
          pts={seasonPts} maxPts={40}
          flipped={flipped[0]}
        />
        <FlipCard
          label="Placement"
          guessDisplay={`#${placementVal}`}
          answerDisplay={`#${houseguest.placement}`}
          pts={placementPts} maxPts={40}
          flipped={flipped[1]}
        />
        <FlipCard
          label="Age"
          guessDisplay={ageVal}
          answerDisplay={String(houseguest.age ?? "?")}
          pts={agePts} maxPts={12}
          flipped={flipped[2]}
        />
        <FlipCard
          label="Comp Wins"
          guessDisplay={compWinsVal}
          answerDisplay={String(houseguest.COMP_wins ?? "?")}
          pts={compWinsPts} maxPts={8}
          flipped={flipped[3]}
        />
      </div>

      {isRankUnlocked() ? (
        <div className={`rfc-summary${scoreVisible ? " rfc-summary--visible" : ""}`}>
          {scoreVisible && (
            <ResultCard
              show="bb" won={grade !== "F"} accent={gradeColor(grade)}
              title={<span className="rc-score"><span>{total}<span className="rc-of">/100</span></span><span className="rc-grade">{grade}</span></span>}
              meta="Big Brotherdle Recall"
              onShare={onShare} copied={copied} onStats={onNavigateStats}
              note={isDaily ? "New houseguest at midnight ET" : null}
            />
          )}
        </div>
      ) : (
      <div className={`rfc-summary${scoreVisible ? " rfc-summary--visible" : ""}`}>
        <div className="recall-score-banner">
          <div className="recall-score-total">{total} / 100</div>
          <div className="recall-score-grade" style={{ color: gradeColor(grade) }}>{grade}</div>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="share-btn" onClick={onShare}>
            {copied ? "✓ Copied!" : "📋 Share Result"}
          </button>
          {onNavigateStats && (
            <button className="share-btn" onClick={onNavigateStats}>
              📊 Recall Stats
            </button>
          )}
          <button className="share-btn" onClick={() => navigate("/bb")}>
            👁 Daily
          </button>
          <button className="share-btn" onClick={() => navigate("/bb/sandwich")}>
            🥪 Sandwich
          </button>
        </div>
        {isDaily && (
          <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
            Come back tomorrow for a new houseguest!
          </p>
        )}
      </div>
      )}
    </div>
  );
}

// ── BB Recall game form ─────────────────────────────────────────────────────────
const RECALL_SHARE_EMOJI = { correct: "🟩", close: "🟨", wrong: "🟥" };

function recallShareEmoji(pts, max) {
  if (pts === max) return RECALL_SHARE_EMOJI.correct;
  if (pts > 0)     return RECALL_SHARE_EMOJI.close;
  return RECALL_SHARE_EMOJI.wrong;
}

function BBRecallGame({ houseguest, stintMap, eligiblePool, onComplete, savedResult, mode, puzzleNum, onNavigateStats }) {
  const stintLabel   = stintMap[houseguest.id];
  const displayName  = buildDisplayName(houseguest, stintLabel);

  const skipFlipRef = useRef(!!savedResult);
  const skipFlip = skipFlipRef.current;
  const { phase, shuffleName, settling } = useNameReveal(houseguest, eligiblePool, skipFlip);

  const [submitted,     setSubmitted]     = useState(!!savedResult);
  const [seasonVal,     setSeasonVal]     = useState(savedResult ? String(savedResult.seasonVal)    : "");
  const [placementVal,  setPlacementVal]  = useState(savedResult ? String(savedResult.placementVal) : "");
  const [ageVal,        setAgeVal]        = useState(savedResult ? String(savedResult.ageVal)       : "");
  const [compWinsVal,   setCompWinsVal]   = useState(savedResult ? String(savedResult.compWinsVal)  : "");
  const [error,         setError]         = useState("");
  const [copied,        setCopied]        = useState(false);

  const seasonPts    = submitted ? scoreSeason(Number(seasonVal),       houseguest.season)    : null;
  const placementPts = submitted ? scorePlacement(Number(placementVal), houseguest.placement) : null;
  const agePts        = submitted ? scoreAge(Number(ageVal),             houseguest.age)       : null;
  const compWinsPts   = submitted ? scoreCompWins(Number(compWinsVal),   houseguest.COMP_wins) : null;
  const total         = submitted ? (seasonPts + placementPts + agePts + compWinsPts)          : null;
  const grade         = submitted ? getGrade(total)                                            : null;

  function handleSubmit() {
    if (!seasonVal || !placementVal || !ageVal || !compWinsVal) {
      setError("Please fill in all four fields before submitting.");
      return;
    }
    setError("");
    setSubmitted(true);
    const sP  = scoreSeason(Number(seasonVal),       houseguest.season);
    const plP = scorePlacement(Number(placementVal), houseguest.placement);
    const aP  = scoreAge(Number(ageVal),             houseguest.age);
    const cP  = scoreCompWins(Number(compWinsVal),   houseguest.COMP_wins);
    const tot = sP + plP + aP + cP;
    const g   = getGrade(tot);
    logBBRecallEvent({
      puzzle: `${houseguest.name} - ${houseguest.seasonNameFull}`,
      mode,
      guess_season:     Number(seasonVal),
      guess_placement:  Number(placementVal),
      guess_age:        Number(ageVal),
      guess_comp_wins:  Number(compWinsVal),
      pts_season:       sP,
      pts_placement:    plP,
      pts_age:          aP,
      pts_comp_wins:    cP,
      score:            tot,
      grade:            g,
    });
    onComplete({
      puzzle: `${houseguest.name} - ${houseguest.seasonNameFull}`,
      seasonVal, placementVal, ageVal, compWinsVal,
      total: tot, grade: g,
      pts_season: sP, pts_placement: plP, pts_age: aP, pts_comp_wins: cP,
    });
  }

  function handleShare() {
    const label = mode === "bb_recall_daily"
      ? `Big Brotherdle Recall #${puzzleNum}: ${grade}`
      : mode === "bb_recall_archive"
      ? `Big Brotherdle Recall Archive: ${grade}`
      : `Big Brotherdle Recall Unlimited: ${grade}`;
    const emojiRow = [
      recallShareEmoji(seasonPts,    40),
      recallShareEmoji(placementPts, 40),
      recallShareEmoji(agePts,       12),
      recallShareEmoji(compWinsPts,   8),
    ].join("");
    const text = `${label}\n${emojiRow}\nbigbrotherdle.com/bb/recall`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const nameInCard = phase === "loading"
    ? "…"
    : phase === "shuffling"
    ? shuffleName
    : displayName;

  const nameStyle = {
    transition: settling ? "color 0.2s ease, transform 0.2s ease" : "none",
    display: "inline-block",
    transform: settling ? "scale(1.04)" : "scale(1)",
    color: settling ? "#5aaedd" : undefined,
  };

  const isAnimating = phase !== "revealed";

  return (
    <>
      <div className="recall-card">
        <div className="recall-castaway-label">
          {phase === "loading" ? "Finding your houseguest…" : "Who is this houseguest?"}
        </div>
        <div className="recall-castaway-name" style={{ minHeight: "1.2em" }}>
          <span style={nameStyle}>{nameInCard}</span>
        </div>
        {!isAnimating && (
          <div className="recall-castaway-sub">Fill in their stats from memory, then submit.</div>
        )}
      </div>

      {!isAnimating && !submitted && (
        <div className="recall-form">
          <div className="recall-fields">
            <div className="recall-field">
              <label className="recall-field-label">Season Number</label>
              <input className="recall-input" type="number" min="1" max="27" placeholder="1-27"
                value={seasonVal} onChange={e => setSeasonVal(e.target.value)} />
            </div>
            <div className="recall-field">
              <label className="recall-field-label">Placement</label>
              <input className="recall-input" type="number" min="1" max="20" placeholder="1-20"
                value={placementVal} onChange={e => setPlacementVal(e.target.value)} />
            </div>
            <div className="recall-field">
              <label className="recall-field-label">Age (during season)</label>
              <input className="recall-input" type="number" min="1" max="100" placeholder="e.g. 26"
                value={ageVal} onChange={e => setAgeVal(e.target.value)} />
            </div>
            <div className="recall-field">
              <label className="recall-field-label">Comp Wins (HOH + Veto)</label>
              <input className="recall-input" type="number" min="0" max="15" placeholder="e.g. 4"
                value={compWinsVal} onChange={e => setCompWinsVal(e.target.value)} />
            </div>
          </div>
          {error && <div className="recall-error">{error}</div>}
          <button className="recall-submit-btn" onClick={handleSubmit}>Submit Answers</button>
        </div>
      )}

      {!isAnimating && submitted && (
        <FlipResults
          skipAnimation={skipFlip}
          seasonVal={seasonVal}
          placementVal={placementVal}
          ageVal={ageVal}
          compWinsVal={compWinsVal}
          houseguest={houseguest}
          seasonPts={seasonPts}
          placementPts={placementPts}
          agePts={agePts}
          compWinsPts={compWinsPts}
          total={total}
          grade={grade}
          onShare={handleShare}
          copied={copied}
          mode={mode}
          isDaily={mode === "bb_recall_daily"}
          onNavigateStats={onNavigateStats}
        />
      )}
    </>
  );
}

// ── Daily mode ─────────────────────────────────────────────────────────────────
function BBRecallDaily({ houseguests, stintMap, eligiblePool, onNavigateStats }) {
  const puzzleNum = getBBRecallPuzzleNumber();
  const houseguest = useMemo(() => getBBRecallDailyAnswer(houseguests), [houseguests]);
  const savedKey = `bb_recall_daily_${puzzleNum}`;
  const [saved, setSaved] = useState(() => loadBBRecallResult("bb_recall_daily", puzzleNum));

  function handleComplete(result) {
    saveBBRecallResult("bb_recall_daily", puzzleNum, result);
    setSaved(result);
  }

  if (!houseguest) return <div className="loading">👁 Loading…</div>;

  return (
    <div className="recall-page">
      <div className="mode-banner">
        <div className="mode-banner-left">
          <span className="mode-banner-label">Recall Daily</span>
          <span className="mode-banner-title">👁 Today's houseguest</span>
        </div>
      </div>

      <BBRecallGame
        key={savedKey}
        houseguest={houseguest}
        stintMap={stintMap}
        eligiblePool={eligiblePool}
        onComplete={handleComplete}
        savedResult={saved}
        mode="bb_recall_daily"
        puzzleNum={puzzleNum}
        onNavigateStats={onNavigateStats}
      />
    </div>
  );
}

// ── Unlimited mode ─────────────────────────────────────────────────────────────
function BBRecallUnlimited({ stintMap, eligiblePool, onNavigateStats }) {
  const [seenIds,   setSeenIds]   = useState(() => new Set());
  const [houseguest, setHouseguest] = useState(() => pickRandom(eligiblePool, new Set()));
  const [gameKey,   setGameKey]   = useState(0);
  const [done,      setDone]      = useState(false);

  function handleComplete(result) {
    saveBBRecallUnlimitedGame({
      puzzle:           result.puzzle,
      total_score:      result.total,
      grade:            result.grade,
      season_score:     result.pts_season,
      placement_score:  result.pts_placement,
      age_score:        result.pts_age,
      comp_wins_score:  result.pts_comp_wins,
    });
    setDone(true);
  }

  function handlePlayAgain() {
    const newSeen = new Set(seenIds);
    newSeen.add(houseguest.id);
    let next = pickRandom(eligiblePool, newSeen);
    if (!next) { newSeen.clear(); next = pickRandom(eligiblePool, newSeen); }
    setSeenIds(newSeen);
    setHouseguest(next);
    setGameKey(k => k + 1);
    setDone(false);
  }

  if (!houseguest) return <div className="loading">👁 Loading…</div>;

  return (
    <div className="recall-page">
      <div className="mode-banner">
        <div className="mode-banner-left">
          <span className="mode-banner-label">Recall Unlimited</span>
          <span className="mode-banner-title">♾️ Random houseguest every round</span>
        </div>
        {done && (
          <button className="archive-play-btn" onClick={handlePlayAgain}>🔀 Play Again</button>
        )}
      </div>

      <BBRecallGame
        key={gameKey}
        houseguest={houseguest}
        stintMap={stintMap}
        eligiblePool={eligiblePool}
        onComplete={handleComplete}
        savedResult={null}
        mode="bb_recall_unlimited"
        puzzleNum={null}
        onNavigateStats={onNavigateStats}
      />
    </div>
  );
}

// ── Archive mode ───────────────────────────────────────────────────────────────
function BBRecallArchive({ stintMap, eligiblePool, onNavigateStats }) {
  const pastNums = useMemo(() => getPastBBRecallPuzzleNumbers(), []);
  const [selectedNum, setSelectedNum] = useState(null);
  const [saved,        setSaved]       = useState(null);

  function selectEntry(num) {
    const existing = loadBBRecallResult("bb_recall_archive", num);
    setSaved(existing);
    setSelectedNum(num);
  }

  function handleComplete(result) {
    saveBBRecallResult("bb_recall_archive", selectedNum, result);
    setSaved(result);
  }

  if (selectedNum) {
    const houseguest = getBBRecallAnswerForPuzzle(eligiblePool, selectedNum);
    return (
      <div className="recall-page">
        <div className="mode-banner">
          <div className="mode-banner-left">
            <span className="mode-banner-label">Recall Archive</span>
            <span className="mode-banner-title">#{selectedNum} · {getDateForBBRecallPuzzle(selectedNum)}</span>
          </div>
          <button
            className="archive-play-btn"
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600 }}
            onClick={() => { setSelectedNum(null); setSaved(null); }}
          >
            ← Back
          </button>
        </div>

        <BBRecallGame
          key={selectedNum}
          houseguest={houseguest}
          stintMap={stintMap}
          eligiblePool={eligiblePool}
          onComplete={handleComplete}
          savedResult={saved}
          mode="bb_recall_archive"
          puzzleNum={selectedNum}
          onNavigateStats={onNavigateStats}
        />
      </div>
    );
  }

  return (
    <div className="recall-page">
      <p className="modal-body" style={{ textAlign: "center", marginBottom: "20px" }}>
        Play any past Recall puzzle. Archive games don't affect your stats.
      </p>

      {pastNums.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "14px" }}>
          No past puzzles yet — check back tomorrow!
        </p>
      ) : (
        <div className="archive-list">
          {pastNums.map(num => {
            const prev = loadBBRecallResult("bb_recall_archive", num);
            return (
              <div key={num} className="archive-item" onClick={() => selectEntry(num)}>
                <div className="archive-item-left">
                  <span className="archive-item-num">#{num}</span>
                  <span className="archive-item-date">{getDateForBBRecallPuzzle(num)}</span>
                </div>
                {prev ? (
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "18px", color: gradeColor(prev.grade), letterSpacing: "1px" }}>
                    {prev.grade} &nbsp;·&nbsp; {prev.total}/100
                  </span>
                ) : (
                  <button className="archive-play-btn">Play</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Grade color helpers ────────────────────────────────────────────────────────
const GRADE_BAR_COLORS = {
  A: { bg: "#1a4d1a", border: "#4aaa4a" },
  B: { bg: "#4a2a05", border: "#f09030" },
  C: { bg: "#1a2a4a", border: "#4a8aff" },
  D: { bg: "#3a3a10", border: "#aaaa4a" },
  F: { bg: "#4a1a1a", border: "#aa4a4a" },
};

function GradeDistBars({ dist }) {
  const max = Math.max(...Object.values(dist), 1);
  return (
    <>
      <div className="sp-sub-title" style={{ marginTop: "20px" }}>Grade Distribution</div>
      {["A", "B", "C", "D", "F"].map(letter => {
        const count = dist[letter] || 0;
        const w = count > 0 ? `${Math.max(Math.round((count / max) * 100), 4)}%` : "0%";
        const { bg, border } = GRADE_BAR_COLORS[letter];
        return (
          <div key={letter} className="stat-row">
            <span className="stat-label">{letter}</span>
            <div className="stat-bar-wrap">
              <div className="stat-bar" style={{ width: w, background: bg, border: `1px solid ${border}` }}>
                {count > 0 && <span className="stat-bar-count">{count}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function BBRecallMyStats() {
  const dailyResults = loadAllBBRecallDailyResults();
  const unlimHistory = loadBBRecallUnlimitedHistory();

  function StatsSection({ results, label, scoreField = "total" }) {
    if (!results.length) {
      return (
        <div style={{ marginBottom: "28px" }}>
          <div className="sp-sub-title">{label}</div>
          <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "13px", marginTop: "12px" }}>
            No games yet
          </p>
        </div>
      );
    }
    const grades  = results.map(r => r.grade);
    const gpa     = computeGPA(grades);
    const scores  = results.map(r => r[scoreField] ?? r.total ?? r.total_score ?? 0);
    const avgPct  = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const best    = scores.length ? Math.max(...scores) : 0;
    const dist    = computeGradeDist(grades);

    return (
      <div style={{ marginBottom: "32px" }}>
        <div className="sp-sub-title">{label}</div>
        <div className="stats-grid" style={{ marginTop: "12px", marginBottom: "12px" }}>
          {[
            [results.length, "Played"],
            [`${avgPct}%`,   "Avg Score"],
            [gpa ?? "—",     "GPA"],
            [best,           "Best Score"],
          ].map(([val, lbl]) => (
            <div className="stats-grid-item" key={lbl}>
              <span className="stats-grid-num">{val}</span>
              <span className="stats-grid-label">{lbl}</span>
            </div>
          ))}
        </div>
        <GradeDistBars dist={dist} />
      </div>
    );
  }

  return (
    <div>
      <StatsSection results={dailyResults} label="Daily" />
      <StatsSection results={unlimHistory} label="Unlimited" scoreField="total_score" />
    </div>
  );
}

function BBRecallComingSoonStats({ label }) {
  return (
    <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "14px", marginTop: "24px" }}>
      {label} stats coming soon — check back once Big Brotherdle stats tracking is live.
    </p>
  );
}

function BBRecallInlineStats() {
  const [sub, setSub] = useState("mystats");

  return (
    <div className="recall-page">
      <div className="ul-subtabs" style={{ marginBottom: "20px", marginTop: "0" }}>
        <button className={`ul-subtab${sub === "mystats" ? " active" : ""}`} onClick={() => setSub("mystats")}>My Stats</button>
        <button className={`ul-subtab${sub === "daily"   ? " active" : ""}`} onClick={() => setSub("daily")}>Daily</button>
        <button className={`ul-subtab${sub === "global"  ? " active" : ""}`} onClick={() => setSub("global")}>Global</button>
      </div>
      {sub === "mystats" && <BBRecallMyStats />}
      {sub === "daily"   && <BBRecallComingSoonStats label="Daily" />}
      {sub === "global"  && <BBRecallComingSoonStats label="Global" />}
    </div>
  );
}

// ── "What is Recall?" info popover ────────────────────────────────────────────
function BBRecallInfoPopover() {
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
        aria-label="What is Recall?"
        aria-expanded={open}
      >
        ⓘ <span className="recall-info-label">What is Recall?</span>
      </button>

      {open && (
        <div className="recall-info-popover" role="dialog" aria-label="What is Recall?">
          <p className="recall-info-heading">The reverse of Big Brotherdle.</p>
          <p className="recall-info-body">
            You're shown a houseguest's name, and have to guess their Season, Placement, Age, and Comp Wins
            from memory. Earn up to 100 points and a letter grade from A+ down to F.
          </p>
          <div className="recall-info-scoring">
            <div className="recall-info-score-row">
              <span className="recall-info-field">Season</span>
              <span className="recall-info-pts">40 pts, −4 per season off</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Placement</span>
              <span className="recall-info-pts">40 pts, −4 per place off</span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Age</span>
              <span className="recall-info-pts">
                12 pts if within 3 years<br />
                8 pts if within 5 years<br />
                4 pts if within 10 years<br />
                0 pts otherwise
              </span>
            </div>
            <div className="recall-info-score-row">
              <span className="recall-info-field">Comp Wins</span>
              <span className="recall-info-pts">8 pts if within 1, 4 pts if within 2, 0 pts otherwise</span>
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

// ── Root BB Recall page ─────────────────────────────────────────────────────────
export default function BBRecall({ colorblind }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [houseguests, setHouseguests] = useState([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: "Big Brotherdle Recall: Name the Houseguest's Stats",
    description: "The reverse of Big Brotherdle: you see the houseguest's name, you recall their stats from memory.",
    canonical: "https://survivordle.com/bb/recall",
    image: "https://survivordle.com/Big_Brotherdle_Thumbnail.png",
  });

  useEffect(() => {
    fetch("/bb_contestants.json")
      .then(r => r.json())
      .then(data => { setHouseguests(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const stintMap = useMemo(() => buildStintMap(houseguests), [houseguests]);

  const path = location.pathname.replace(/\/$/, "");
  const activeTab = path === "/bb/recall/archive"   ? "archive"
                  : path === "/bb/recall/unlimited" ? "unlimited"
                  : path === "/bb/recall/stats"     ? "stats"
                  : "daily";

  if (loading) return (
    <div className="bb-theme">
      <style>{BB_HEADER_CSS}</style>
      <div className="loading">👁 Loading…</div>
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
        <div className="tagline">Recall Mode &nbsp;·&nbsp; Remember the stats</div>
      </header>

      <div className="ul-tabs" style={{ position: "relative" }}>
        <button className={`ul-tab${activeTab === "daily"     ? " active" : ""}`} onClick={() => navigate("/bb/recall")}>
          👁 Daily
        </button>
        <button className={`ul-tab${activeTab === "archive"   ? " active" : ""}`} onClick={() => navigate("/bb/recall/archive")}>
          📁 Archive
        </button>
        <button className={`ul-tab${activeTab === "unlimited" ? " active" : ""}`} onClick={() => navigate("/bb/recall/unlimited")}>
          ♾️ Unlimited
        </button>
        {!isRankUnlocked() && (
        <button className={`ul-tab${activeTab === "stats"     ? " active" : ""}`} onClick={() => navigate("/bb/recall/stats")}>
          📊 Stats
        </button>
        )}
        <BBRecallInfoPopover />
      </div>

      {activeTab === "daily"     && <BBRecallDaily     houseguests={houseguests} stintMap={stintMap} eligiblePool={houseguests} onNavigateStats={() => navigate("/bb/recall/stats")} />}
      {activeTab === "archive"   && <BBRecallArchive   stintMap={stintMap} eligiblePool={houseguests} onNavigateStats={() => navigate("/bb/recall/stats")} />}
      {activeTab === "unlimited" && <BBRecallUnlimited stintMap={stintMap} eligiblePool={houseguests} onNavigateStats={() => navigate("/bb/recall/stats")} />}
      {activeTab === "stats"     && <BBRecallInlineStats />}
    </div>
  );
}
