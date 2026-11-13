import { Component, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  winnersOf, seasonItems, newSession, syncSession, replay, choose, undo,
  currentRanking, moveItem, seasonsOf, isDone, toSortSession, playersOf, shuffledIds,
} from "../shared/rank";
import {
  loadRankSession, saveRankSession, clearRankSession,
  getRankAnonId, getSubmittedSig, setSubmittedSig,
} from "../shared/rankStorage";
import { submitRankRemote } from "../shared/rankApi";
import { RANK_CSS, Matchup, RankList, Leaderboard, SeasonPicker, ShareButtons } from "../components/RankParts";
import RankBlind from "../components/RankBlind";
import RankTiers from "../components/RankTiers";

const MIN_SUBMIT = 10; // must match rank_submissions.sql

const KINDS = {
  winners: {
    title: "Rank the Winners",
    blurb: "Pick the better winner, head to head, until you've built your own board.",
    question: "Who's the better winner?",
    noun: "Survivor winners",
    setup: "Which seasons have you watched? You'll only be asked about their winners.",
    line: w => `${w.name} (S${w.season})`,
  },
  seasons: {
    title: "Rank the Seasons",
    blurb: "Pick the better season, head to head, until you've built your own board.",
    question: "Which season is better?",
    noun: "Survivor seasons",
    setup: "Which seasons have you watched? You'll only be asked about those.",
    line: w => `${w.name} (S${w.season})`,
  },
};

// Shows a crash on the page (instead of a blank screen) and lets the user reset saved state.
class RankBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("Rank crashed:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rk-note" style={{ whiteSpace: "pre-wrap" }}>
        Something went wrong on this page.{" "}{String(this.state.error?.stack || this.state.error).slice(0, 600)}
      </div>
    );
  }
}

// Hidden page: reached only by typing /rank (gated by RankGate in App.jsx).
export default function Rank(props) {
  return <RankBoundary><RankPage {...props} /></RankBoundary>;
}

function RankPage({ contestants }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Keep the page out of search results while it's under wraps.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const lists = useMemo(() => ({ winners: winnersOf(contestants), seasons: seasonItems(contestants) }), [contestants]);

  const [, kind, step, arg] = pathname.split("/").filter(Boolean);
  // "s50" = the individual players of season 50 (ranked by 1v1 or drag-and-drop).
  const sn = /^s(\d+)$/.exec(kind || "")?.[1];
  const players = useMemo(() => (sn ? playersOf(contestants, +sn) : []), [sn, contestants]);
  const cfg = sn
    ? {
      title: `${players[0]?.label} Players`,
      blurb: "Rank this season's cast, one matchup at a time or by dragging them into order.",
      question: "Who's the better player?",
      noun: `${players[0]?.label} players`,
      line: w => w.name,
      sortable: true,
    }
    : KINDS[kind];

  return (
    <>
      <style>{RANK_CSS}</style>
      <div className="rk">
        {cfg && (sn ? players : lists[kind]).length
          ? <Board key={kind} kind={kind} cfg={cfg} items={sn ? players : lists[kind]} seasonList={lists.seasons} step={step} arg={arg} navigate={navigate} />
          : kind === "players"
            ? <PlayerSeasons navigate={navigate} seasons={lists.seasons} />
            : <Chooser navigate={navigate} lists={lists} />}
      </div>
    </>
  );
}

function Chooser({ navigate, lists }) {
  // Winners are masked ("Winner of …") so the front page doesn't name anyone.
  const maps = useMemo(() => ({
    winners: new Map(lists.winners.map(w => [w.season, { ...w, name: `Winner of ${w.seasonName}`, sub: `Season ${w.season}` }])),
    seasons: new Map(lists.seasons.map(s => [s.season, s])),
  }), [lists]);
  const [peek, setPeek] = useState("winners");
  const card = (to, t, d) => (
    <button className="rk-big" onClick={() => navigate(to)}>
      <div className="t">{t}</div>
      <div className="d">{d}</div>
    </button>
  );
  return (
    <>
      <h1>Rank</h1>
      <div className="rk-sub">What do you want to rank?</div>
      <div className="rk-cards">
        {card("/rank/winners", "Winners", "Who's the best Sole Survivor?")}
        {card("/rank/seasons", "Seasons", "Which seasons are the greatest?")}
        {card("/rank/players", "Players", "Rank the cast of any season.")}
      </div>
      <div className="rk-note"><b>⚠ Heavy spoiler warning</b></div>
      <div className="rk-h2">Consensus top 5</div>
      <div className="rk-row">
        <div className="rk-seg">
          <button className={peek === "winners" ? "on" : ""} onClick={() => setPeek("winners")}>Winners</button>
          <button className={peek === "seasons" ? "on" : ""} onClick={() => setPeek("seasons")}>Seasons</button>
        </div>
      </div>
      <Leaderboard key={peek} kind={peek} bySeason={maps[peek]} top={5} />
    </>
  );
}

function PlayerSeasons({ navigate, seasons }) {
  return (
    <>
      <button className="rk-link" onClick={() => navigate("/rank")}>← All rankings</button>
      <h1>Players</h1>
      <div className="rk-sub">Pick a season to rank its cast.</div>
      <div className="rk-chips">
        {seasons.map(x => (
          <button key={x.season} className="rk-chip" onClick={() => navigate(`/rank/s${x.season}`)}>
            <b>{x.season}</b> {x.seasonName}
          </button>
        ))}
      </div>
    </>
  );
}

function Board({ kind, cfg, items, seasonList, step, arg, navigate }) {
  const byId = useMemo(() => new Map(items.map(w => [w.id, w])), [items]);
  const bySeason = useMemo(() => new Map(items.map(w => [w.season, w])), [items]);
  const ids = useMemo(() => items.map(w => w.id), [items]);

  const [session, setSession] = useState(() => loadRankSession(kind));
  const [selected, setSelected] = useState(() => seasonList.map(x => x.season));
  const [mode, setMode] = useState("1v1");
  const [placementStart, setPlacementStart] = useState(true);

  // Pick up items added by a data update (new seasons) without losing progress.
  const activeSession = useMemo(() => (session ? syncSession(session, ids) : session), [session, ids]);
  useEffect(() => {
    if (activeSession && activeSession !== session) saveRankSession(kind, activeSession);
  }, [activeSession, session, kind]);

  function update(next) {
    saveRankSession(kind, next);
    setSession(next);
  }

  function toSort() {
    if (!window.confirm("Switch to quick sort? You can't go back to 1v1 for this ranking.")) return;
    update(toSortSession(session, ids));
    navigate(`${base}/results`);
  }

  function start() {
    if (cfg.sortable) {
      const s = newSession(ids);
      if (mode === "sort") {
        update({ ...s, mode: "sort", manual: placementStart ? ids : shuffledIds(ids, s.seed) });
        navigate(`${base}/results`);
      } else {
        update(s);
        navigate(`${base}/play`);
      }
      return;
    }
    const picked = new Set(selected);
    update(newSession(ids, items.filter(w => picked.has(w.season)).map(w => w.id)));
    navigate(`/rank/${kind}/play`);
  }

  function startOver() {
    if (!window.confirm("Start over? Your current ranking will be erased.")) return;
    clearRankSession(kind);
    setSession(null);
    navigate(`/rank/${kind}/setup`);
  }

  const base = `/rank/${kind}`;
  if (step === "setup") {
    return (
      <>
        <button className="rk-link" onClick={() => navigate(base)}>← Back</button>
        <h1>{cfg.title}</h1>
        {cfg.sortable ? (
          <>
            <div className="rk-row">
              <div className="rk-seg">
                <button className={mode === "1v1" ? "on" : ""} onClick={() => setMode("1v1")}>1v1</button>
                <button className={mode === "sort" ? "on" : ""} onClick={() => setMode("sort")}>Quick sort</button>
              </div>
            </div>
            <div className="rk-sub">
              {mode === "1v1"
                ? "Pick the better player, head to head. You can switch to quick sort later."
                : "Drag everyone into your order."}
            </div>
            {mode === "sort" && (
              <div className="rk-row">
                <div className="rk-seg">
                  <button className={placementStart ? "on" : ""} onClick={() => setPlacementStart(true)}>Start in placement order</button>
                  <button className={placementStart ? "" : "on"} onClick={() => setPlacementStart(false)}>Start random</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="rk-sub">{cfg.setup}</div>
            <SeasonPicker seasons={seasonList} selected={selected} onChange={setSelected} />
          </>
        )}
        <div className="rk-row">
          <button className="rk-btn primary" disabled={!cfg.sortable && selected.length < 2} onClick={start}>Start ranking</button>
        </div>
      </>
    );
  }
  if (step === "tiers") {
    return <RankTiers kind={kind} cfg={cfg} items={items} byId={byId} navigate={navigate} base={base} />;
  }
  if (step === "blind") {
    return <RankBlind kind={kind} cfg={cfg} items={items} byId={byId} n={arg === "10" ? 10 : 5} navigate={navigate} base={base} />;
  }
  if (step === "play" || step === "results") {
    if (!activeSession) return <Redirect to={base} navigate={navigate} />;
    return step === "play"
      ? <Play cfg={cfg} session={activeSession} byId={byId} update={update} navigate={navigate} base={base} toSort={cfg.sortable ? toSort : null} />
      : <Results kind={kind} cfg={cfg} session={activeSession} byId={byId} update={update} navigate={navigate} base={base} toSort={cfg.sortable ? toSort : null} />;
  }
  return <Home cfg={cfg} kind={kind} session={activeSession} bySeason={bySeason} startOver={startOver} navigate={navigate} base={base} />;
}

function Redirect({ to, navigate }) {
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return null;
}

function Home({ cfg, kind, session, bySeason, startOver, navigate, base }) {
  const done = session ? isDone(session) : false;
  return (
    <>
      <button className="rk-link" onClick={() => navigate("/rank")}>← All rankings</button>
      <h1>{cfg.title}</h1>
      <div className="rk-sub">{cfg.blurb}</div>
      <div className="rk-row">
        {!session && <button className="rk-btn primary big" onClick={() => navigate(`${base}/setup`)}>Start ranking</button>}
        {session && !done && <button className="rk-btn primary big" onClick={() => navigate(`${base}/play`)}>Resume ranking</button>}
        {done && <button className="rk-btn primary big" onClick={() => navigate(`${base}/results`)}>View my ranking</button>}
      </div>
      {session && (
        <div className="rk-row">
          {!done && <button className="rk-btn small" onClick={() => navigate(`${base}/results`)}>My board so far</button>}
          <button className="rk-btn small" onClick={startOver}>Start over</button>
        </div>
      )}
      <div className="rk-label">More ways to play</div>
      <div className="rk-cards">
        <button className="rk-big" onClick={() => navigate(`${base}/tiers`)}>
          <div className="t">Tier list</div>
          <div className="d">Sort them into S to F tiers.</div>
        </button>
        {!cfg.sortable && (
          <>
            <button className="rk-big" onClick={() => navigate(`${base}/blind/5`)}>
              <div className="t">Blind · 5</div>
              <div className="d">Rank 5 without knowing who's next.</div>
            </button>
            <button className="rk-big" onClick={() => navigate(`${base}/blind/10`)}>
              <div className="t">Blind · 10</div>
              <div className="d">Same, but 10 and harder.</div>
            </button>
          </>
        )}
      </div>
      <div className="rk-h2">Consensus Ranking</div>
      <Leaderboard kind={kind} bySeason={bySeason} />
    </>
  );
}

function Play({ cfg, session, byId, update, navigate, base, toSort }) {
  const state = useMemo(() => replay(session), [session]);
  const done = isDone(session);

  useEffect(() => {
    if (done) navigate(`${base}/results`, { replace: true });
  }, [done, navigate, base]);

  if (done) return null;
  const cur = byId.get(state.cur);
  const other = byId.get(state.other);
  if (!cur || !other) return null;

  const total = session.order.length;
  return (
    <>
      <div className="rk-prog" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={state.ranked.length}>
        <i style={{ width: `${(state.ranked.length / total) * 100}%` }} />
      </div>
      <div className="rk-note">{state.ranked.length} of {total} placed</div>
      <Matchup
        key={`${cur.id}|${other.id}|${session.choices.length}`}
        cur={cur}
        other={other}
        flip={state.flip}
        question={cfg.question}
        onChoose={code => update(choose(session, code))}
      />
      <div className="rk-row" style={{ marginTop: 18 }}>
        <button className="rk-btn" disabled={!session.choices.length} onClick={() => update(undo(session))}>↶ Undo</button>
        <button className="rk-btn" onClick={() => navigate(`${base}/results`)}>Stop &amp; see my board</button>
        {toSort && <button className="rk-btn" onClick={toSort}>Switch to quick sort</button>}
      </div>
    </>
  );
}

function Results({ kind, cfg, session, byId, update, navigate, base, toSort }) {
  const done = isDone(session);
  const ranking = useMemo(() => currentRanking(session), [session]);
  const [sentSig, setSentSig] = useState(() => getSubmittedSig(kind));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mySig = seasonsOf(ranking, byId).join(",");

  async function submitNow() {
    setBusy(true);
    setFailed(false);
    if (await submitRankRemote(getRankAnonId(), kind, seasonsOf(ranking, byId))) {
      setSubmittedSig(kind, mySig);
      setSentSig(mySig);
    } else setFailed(true);
    setBusy(false);
  }

  // Send the ranking to the consensus once it's big enough. Debounced so
  // reordering doesn't fire a request per click; skipped if unchanged.
  useEffect(() => {
    const seasons = seasonsOf(ranking, byId);
    if (seasons.length < MIN_SUBMIT) return;
    if (session.mode === "sort") return; // quick sort is only sent when the user presses the button
    const sig = seasons.join(",");
    if (sig === getSubmittedSig(kind)) return;
    const t = setTimeout(async () => {
      if (await submitRankRemote(getRankAnonId(), kind, seasons)) setSubmittedSig(kind, sig);
    }, 1500);
    return () => clearTimeout(t);
  }, [ranking, byId, kind, session.mode]);

  return (
    <>
      <h1>My Ranking</h1>
      {!done && (
        <>
          <div className="rk-sub">{ranking.length} placed so far. You can keep going any time.</div>
          <div className="rk-row">
            <button className="rk-btn primary" onClick={() => navigate(`${base}/play`)}>Keep ranking</button>
            {toSort && <button className="rk-btn" onClick={toSort}>Switch to quick sort</button>}
          </div>
        </>
      )}
      {done && <div className="rk-sub">{cfg.sortable ? "Drag the handles (or use the arrows) to set your order." : "Use the arrows to fine-tune your order."}</div>}
      {ranking.length === 0
        ? <div className="rk-note">Nothing ranked yet.</div>
        : <RankList ids={ranking} byId={byId} drag={cfg.sortable} onMove={done ? (from, to) => update({ ...session, manual: moveItem(ranking, from, to) }) : null} />}
      {session.mode === "sort" && (
        <div className="rk-row">
          <button key={sentSig === mySig} className={`rk-btn primary${sentSig === mySig ? " rk-pop" : ""}`} disabled={busy || sentSig === mySig} onClick={submitNow}>
            {sentSig === mySig ? "Submitted to consensus ✓" : busy ? "Submitting…" : "Submit to consensus"}
          </button>
          {failed && <div className="rk-note">Couldn't submit. Try again.</div>}
        </div>
      )}
      {ranking.length >= 2 && <ShareButtons ranking={ranking} byId={byId} cfg={cfg} kind={kind} />}
      <div className="rk-row">
        <button className="rk-btn" onClick={() => navigate(base)}>Consensus ranking</button>
      </div>
    </>
  );
}
