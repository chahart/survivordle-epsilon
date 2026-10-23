import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  winnersOf, seasonItems, newSession, syncSession, replay, choose, undo,
  currentRanking, moveItem, seasonsOf,
} from "../shared/rank";
import {
  loadRankSession, saveRankSession, clearRankSession,
  getRankAnonId, getSubmittedSig, setSubmittedSig,
} from "../shared/rankStorage";
import { submitRankRemote } from "../shared/rankApi";
import { RANK_CSS, Matchup, RankList, Leaderboard, SeasonPicker, ShareButtons } from "../components/RankParts";
import RankBlind from "../components/RankBlind";

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

// Hidden page: reached only by typing /rank (gated by RankGate in App.jsx).
export default function Rank({ contestants }) {
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
  const cfg = KINDS[kind];

  return (
    <>
      <style>{RANK_CSS}</style>
      <div className="rk">
        {cfg && lists[kind].length
          ? <Board key={kind} kind={kind} cfg={cfg} items={lists[kind]} seasonList={lists.seasons} step={step} arg={arg} navigate={navigate} />
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
  return (
    <>
      <h1>Rank</h1>
      <div className="rk-sub">What do you want to rank?</div>
      <div className="rk-note"><b>⚠ Heavy spoiler warning</b></div>
      <button className="rk-big" onClick={() => navigate("/rank/winners")}>
        <div className="t">Winners</div>
        <div className="d">Who's the best Sole Survivor?</div>
      </button>
      <div className="rk-label">Consensus top 5</div>
      <Leaderboard kind="winners" bySeason={maps.winners} top={5} />
      <button className="rk-big" onClick={() => navigate("/rank/seasons")}>
        <div className="t">Seasons</div>
        <div className="d">Which seasons are the greatest?</div>
      </button>
      <div className="rk-label">Consensus top 5</div>
      <Leaderboard kind="seasons" bySeason={maps.seasons} top={5} />
    </>
  );
}

function Board({ kind, cfg, items, seasonList, step, arg, navigate }) {
  const byId = useMemo(() => new Map(items.map(w => [w.id, w])), [items]);
  const bySeason = useMemo(() => new Map(items.map(w => [w.season, w])), [items]);
  const ids = useMemo(() => items.map(w => w.id), [items]);

  const [session, setSession] = useState(() => loadRankSession(kind));
  const [selected, setSelected] = useState(() => seasonList.map(x => x.season));

  // Pick up items added by a data update (new seasons) without losing progress.
  const activeSession = useMemo(() => (session ? syncSession(session, ids) : session), [session, ids]);
  useEffect(() => {
    if (activeSession && activeSession !== session) saveRankSession(kind, activeSession);
  }, [activeSession, session, kind]);

  function update(next) {
    saveRankSession(kind, next);
    setSession(next);
  }

  function start() {
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
        <div className="rk-sub">{cfg.setup}</div>
        <SeasonPicker seasons={seasonList} selected={selected} onChange={setSelected} />
        <div className="rk-row">
          <button className="rk-btn primary" disabled={selected.length < 2} onClick={start}>Start ranking</button>
        </div>
      </>
    );
  }
  if (step === "blind") {
    return <RankBlind kind={kind} cfg={cfg} items={items} byId={byId} n={arg === "10" ? 10 : 5} navigate={navigate} base={base} />;
  }
  if (step === "play" || step === "results") {
    if (!activeSession) return <Redirect to={base} navigate={navigate} />;
    return step === "play"
      ? <Play cfg={cfg} session={activeSession} byId={byId} update={update} navigate={navigate} base={base} />
      : <Results kind={kind} cfg={cfg} session={activeSession} byId={byId} update={update} navigate={navigate} base={base} />;
  }
  return <Home cfg={cfg} kind={kind} session={activeSession} bySeason={bySeason} startOver={startOver} navigate={navigate} base={base} />;
}

function Redirect({ to, navigate }) {
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return null;
}

function Home({ cfg, kind, session, bySeason, startOver, navigate, base }) {
  const done = session ? replay(session).done : false;
  return (
    <>
      <button className="rk-link" onClick={() => navigate("/rank")}>← All rankings</button>
      <h1>{cfg.title}</h1>
      <div className="rk-sub">{cfg.blurb}</div>
      <div className="rk-row">
        {!session && <button className="rk-btn primary" onClick={() => navigate(`${base}/setup`)}>Start ranking</button>}
        {session && !done && (
          <>
            <button className="rk-btn primary" onClick={() => navigate(`${base}/play`)}>Resume</button>
            <button className="rk-btn" onClick={() => navigate(`${base}/results`)}>My board so far</button>
          </>
        )}
        {done && <button className="rk-btn primary" onClick={() => navigate(`${base}/results`)}>View my ranking</button>}
        {session && <button className="rk-btn" onClick={startOver}>Start over</button>}
      </div>
      <div className="rk-row">
        <button className="rk-btn" onClick={() => navigate(`${base}/blind/5`)}>Blind ranking · 5</button>
        <button className="rk-btn" onClick={() => navigate(`${base}/blind/10`)}>Blind ranking · 10</button>
      </div>
      <div className="rk-h2">Consensus Ranking</div>
      <Leaderboard kind={kind} bySeason={bySeason} />
    </>
  );
}

function Play({ cfg, session, byId, update, navigate, base }) {
  const state = useMemo(() => replay(session), [session]);

  useEffect(() => {
    if (state.done) navigate(`${base}/results`, { replace: true });
  }, [state.done, navigate, base]);

  if (state.done) return null;
  const cur = byId.get(state.cur);
  const other = byId.get(state.other);
  if (!cur || !other) return null;

  return (
    <>
      <Matchup
        cur={cur}
        other={other}
        flip={state.flip}
        question={cfg.question}
        onChoose={code => update(choose(session, code))}
      />
      <div className="rk-row" style={{ marginTop: 18 }}>
        <button className="rk-btn" disabled={!session.choices.length} onClick={() => update(undo(session))}>↶ Undo</button>
        <button className="rk-btn" onClick={() => navigate(`${base}/results`)}>Stop &amp; see my board</button>
      </div>
    </>
  );
}

function Results({ kind, cfg, session, byId, update, navigate, base }) {
  const state = useMemo(() => replay(session), [session]);
  const ranking = useMemo(() => currentRanking(session), [session]);

  // Send the ranking to the consensus once it's big enough. Debounced so
  // reordering doesn't fire a request per click; skipped if unchanged.
  useEffect(() => {
    const seasons = seasonsOf(ranking, byId);
    if (seasons.length < MIN_SUBMIT) return;
    const sig = seasons.join(",");
    if (sig === getSubmittedSig(kind)) return;
    const t = setTimeout(async () => {
      if (await submitRankRemote(getRankAnonId(), kind, seasons)) setSubmittedSig(kind, sig);
    }, 1500);
    return () => clearTimeout(t);
  }, [ranking, byId, kind]);

  return (
    <>
      <h1>My Ranking</h1>
      {!state.done && (
        <>
          <div className="rk-sub">{ranking.length} placed so far. You can keep going any time.</div>
          <div className="rk-row">
            <button className="rk-btn primary" onClick={() => navigate(`${base}/play`)}>Keep ranking</button>
          </div>
        </>
      )}
      {state.done && <div className="rk-sub">Use the arrows to fine-tune your order.</div>}
      {ranking.length === 0
        ? <div className="rk-note">Nothing ranked yet.</div>
        : <RankList ids={ranking} byId={byId} onMove={state.done ? (from, to) => update({ ...session, manual: moveItem(ranking, from, to) }) : null} />}
      {ranking.length >= 2 && <ShareButtons ranking={ranking} byId={byId} cfg={cfg} kind={kind} />}
      <div className="rk-row">
        <button className="rk-btn" onClick={() => navigate(base)}>Consensus ranking</button>
      </div>
    </>
  );
}
