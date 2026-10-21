import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  winnersOf, newSession, syncSession, replay, choose, undo,
  currentRanking, moveItem, decodeRanking, seasonsOf,
} from "../shared/rank";
import {
  loadRankSession, saveRankSession, clearRankSession,
  getRankAnonId, getSubmittedSig, setSubmittedSig,
} from "../shared/rankStorage";
import { submitRankRemote } from "../shared/rankApi";
import { renderRankImage, shareOrDownloadImage } from "../shared/rankImage";
import { RANK_CSS, Matchup, RankList, Leaderboard } from "../components/RankParts";

const MIN_SUBMIT = 20; // must match rank_submissions.sql

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

  const winners = useMemo(() => winnersOf(contestants), [contestants]);
  const byId = useMemo(() => new Map(winners.map(w => [w.id, w])), [winners]);
  const bySeason = useMemo(() => new Map(winners.map(w => [w.season, w])), [winners]);
  const ids = useMemo(() => winners.map(w => w.id), [winners]);

  const [session, setSession] = useState(() => loadRankSession());

  // Pick up winners added by a data update (new seasons) without losing progress.
  const activeSession = useMemo(() => (session ? syncSession(session, ids) : session), [session, ids]);
  useEffect(() => {
    if (activeSession && activeSession !== session) saveRankSession(activeSession);
  }, [activeSession, session]);

  function update(next) {
    saveRankSession(next);
    setSession(next);
  }

  function start() {
    update(newSession(ids));
    navigate("/rank/play");
  }

  function startOver() {
    if (!window.confirm("Start over? Your current ranking will be erased.")) return;
    clearRankSession();
    setSession(null);
    navigate("/rank");
  }

  if (!winners.length) return null;

  let view;
  if (pathname.startsWith("/rank/r/")) {
    view = <SharedView code={pathname.slice("/rank/r/".length).replace(/\/$/, "")} bySeason={bySeason} byId={byId} navigate={navigate} />;
  } else if (pathname.startsWith("/rank/play")) {
    view = activeSession
      ? <Play session={activeSession} byId={byId} update={update} navigate={navigate} total={ids.length} />
      : <Redirect to="/rank" navigate={navigate} />;
  } else if (pathname.startsWith("/rank/results")) {
    view = activeSession
      ? <Results session={activeSession} byId={byId} update={update} navigate={navigate} total={ids.length} />
      : <Redirect to="/rank" navigate={navigate} />;
  } else {
    view = <Home session={activeSession} bySeason={bySeason} start={start} startOver={startOver} navigate={navigate} total={ids.length} />;
  }

  return (
    <>
      <style>{RANK_CSS}</style>
      <div className="rk">{view}</div>
    </>
  );
}

function Redirect({ to, navigate }) {
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return null;
}

function Home({ session, bySeason, start, startOver, navigate, total }) {
  const state = session ? replay(session) : null;
  const inProgress = state && !state.done;
  return (
    <>
      <h1>Rank the Winners</h1>
      <div className="rk-sub">Pick the better winner, head to head, until you've built your own board.</div>
      <div className="rk-row">
        {!session && <button className="rk-btn primary" onClick={start}>Start ranking</button>}
        {inProgress && (
          <>
            <button className="rk-btn primary" onClick={() => navigate("/rank/play")}>
              Resume ({state.ranked.length} of {total} placed)
            </button>
            <button className="rk-btn" onClick={() => navigate("/rank/results")}>My board so far</button>
          </>
        )}
        {state?.done && <button className="rk-btn primary" onClick={() => navigate("/rank/results")}>View my ranking</button>}
        {session && <button className="rk-btn" onClick={startOver}>Start over</button>}
      </div>
      <div className="rk-h2">Consensus Ranking</div>
      <Leaderboard bySeason={bySeason} />
    </>
  );
}

function Play({ session, byId, update, navigate, total }) {
  const state = useMemo(() => replay(session), [session]);

  useEffect(() => {
    if (state.done) navigate("/rank/results", { replace: true });
  }, [state.done, navigate]);

  if (state.done) return null;
  const cur = byId.get(state.cur);
  const other = byId.get(state.other);
  if (!cur || !other) return null;

  const placed = state.ranked.length;
  return (
    <>
      <Matchup
        cur={cur}
        other={other}
        flip={state.flip}
        onPick={code => update(choose(session, code))}
        onSkip={code => update(choose(session, code))}
      />
      <div className="rk-prog"><div style={{ width: `${(placed / total) * 100}%` }} /></div>
      <div className="rk-meta">
        <span>{placed} of {total} winners placed</span>
        <span>{state.votes} vote{state.votes === 1 ? "" : "s"}</span>
      </div>
      <div className="rk-row">
        <button className="rk-btn" disabled={!session.choices.length} onClick={() => update(undo(session))}>↶ Undo</button>
        <button className="rk-btn" onClick={() => navigate("/rank/results")}>Stop &amp; see my board</button>
      </div>
    </>
  );
}

function Results({ session, byId, update, navigate, total }) {
  const state = useMemo(() => replay(session), [session]);
  const ranking = useMemo(() => currentRanking(session), [session]);
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(null);
  const copyTimer = useRef(null);

  // Send the ranking to the consensus once it's big enough. Debounced so
  // reordering doesn't fire a request per click; skipped if unchanged.
  useEffect(() => {
    const seasons = seasonsOf(ranking, byId);
    if (seasons.length < MIN_SUBMIT) return;
    const sig = seasons.join(",");
    if (sig === getSubmittedSig()) return;
    const t = setTimeout(async () => {
      if (await submitRankRemote(getRankAnonId(), seasons)) setSubmittedSig(sig);
    }, 1500);
    return () => clearTimeout(t);
  }, [ranking, byId]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  async function share(count) {
    const top = count ? ranking.slice(0, count) : ranking;
    const lines = top.map((id, i) => {
      const w = byId.get(id);
      return `${i + 1}. ${w.name} (S${w.season})`;
    });
    const text = [
      count ? `My top ${top.length} Survivor winners 🏝️` : "My Survivor winner ranking 🏝️",
      "",
      ...lines,
      "",
      "survivordle.com/rank",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(count || "all");
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 2000);
  }

  async function shareImage(count) {
    const key = count ? `img${count}` : "imgall";
    setBusy(key);
    try {
      const ids = count ? ranking.slice(0, count) : ranking;
      const title = count ? `My Top ${ids.length}` : "My Ranking";
      const light = !!document.querySelector(".light");
      const blob = await renderRankImage(ids, byId, { title, light });
      await shareOrDownloadImage(blob, count ? `survivor-top-${ids.length}.png` : "survivor-ranking.png");
    } finally {
      setBusy(null);
    }
  }

  const skipped = state.skipped.map(id => byId.get(id)).filter(Boolean);
  const unplaced = total - ranking.length - skipped.length;

  return (
    <>
      <h1>My Ranking</h1>
      {!state.done && (
        <>
          <div className="rk-sub">
            {ranking.length} placed so far{unplaced > 0 ? ` · ${unplaced} still to go` : ""}. You can keep going any time.
          </div>
          <div className="rk-row">
            <button className="rk-btn primary" onClick={() => navigate("/rank/play")}>Keep ranking</button>
          </div>
        </>
      )}
      {state.done && <div className="rk-sub">Use the arrows to fine-tune your order.</div>}
      {ranking.length === 0
        ? <div className="rk-note">Nothing ranked yet.</div>
        : <RankList ids={ranking} byId={byId} onMove={state.done ? (from, to) => update({ ...session, manual: moveItem(ranking, from, to) }) : null} />}
      {skipped.length > 0 && (
        <div className="rk-note">Haven't seen: {skipped.map(w => `${w.name} (S${w.season})`).join(", ")}</div>
      )}
      {ranking.length >= 2 && (
        <>
          <div className="rk-h2">Share</div>
          <div className="rk-row">
            <button className="rk-btn" onClick={() => share(10)}>{copied === 10 ? "Copied!" : "Copy top 10"}</button>
            <button className="rk-btn" onClick={() => share(0)}>{copied === "all" ? "Copied!" : "Copy full ranking"}</button>
          </div>
          <div className="rk-row">
            <button className="rk-btn" disabled={!!busy} onClick={() => shareImage(10)}>{busy === "img10" ? "Making image…" : "Image: top 10"}</button>
            <button className="rk-btn" disabled={!!busy} onClick={() => shareImage(0)}>{busy === "imgall" ? "Making image…" : "Image: full ranking"}</button>
          </div>
        </>
      )}
      <div className="rk-row">
        <button className="rk-btn" onClick={() => navigate("/rank")}>Consensus ranking</button>
      </div>
    </>
  );
}

function SharedView({ code, bySeason, byId, navigate }) {
  const ids = useMemo(() => decodeRanking(code, bySeason), [code, bySeason]);
  return (
    <>
      <h1>Shared Ranking</h1>
      {ids
        ? <RankList ids={ids} byId={byId} />
        : <div className="rk-note">This ranking link doesn't look right.</div>}
      <div className="rk-row" style={{ marginTop: 18 }}>
        <button className="rk-btn primary" onClick={() => navigate("/rank")}>Make your own</button>
      </div>
    </>
  );
}
