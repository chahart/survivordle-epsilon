import { Component, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  winnersOf, seasonItems, newSession, syncSession, replay, choose, undo,
  currentRanking, moveItem, seasonsOf, isDone, toSortSession, playersOf, shuffledIds,
  dailyMatchup, etToday, streakOf, templateItems, returneesOf, bbLists, bbCast,
} from "../shared/rank";
import { SHOWS, show, setShow, rp } from "../shared/rankShow";
import TIER_TEMPLATES from "../shared/tierTemplates.json";
import {
  loadRankSession, saveRankSession, clearRankSession,
  getRankAnonId, getSubmittedSig, setSubmittedSig, loadDailyVotes,
} from "../shared/rankStorage";
import { submitRankRemote } from "../shared/rankApi";
import { RANK_CSS, Matchup, RankList, Leaderboard, SeasonPicker, ShareButtons, TribeCompare, KeepPlaying } from "../components/RankParts";
import RankBlind from "../components/RankBlind";
import RankTiers from "../components/RankTiers";
import RankToday, { TodayPeek } from "../components/RankToday";
import { TierStrip, TierGallery } from "../components/RankTierHub";

// "Players" on Survivor, "Houseguests" on Big Brother.
const playersWord = w => (show().id === "bb" && w === "Players" ? "Houseguests" : w);

const MIN_SUBMIT = 10; // must match rank_submissions.sql

// Board settings, worded for the current show.
const kinds = () => ({
  winners: {
    title: "Rank the Winners",
    blurb: "Pick the better winner, head to head, until you've built your own board.",
    question: "Who's the better winner?",
    noun: `${show().name} winners`,
    setup: "Which seasons have you watched? You'll only be asked about their winners.",
    line: w => `${w.name} (${show().short}${w.season})`,
  },
  seasons: {
    title: "Rank the Seasons",
    blurb: "Pick the better season, head to head, until you've built your own board.",
    question: "Which season is better?",
    noun: `${show().name} seasons`,
    setup: "Which seasons have you watched? You'll only be asked about those.",
    line: w => (show().id === "bb" ? w.name : `${w.name} (S${w.season})`),
  },
  returnees: {
    title: "Best Returnees to Never Win",
    blurb: "Everyone who came back without ever winning. Head to head, or drag them into order.",
    question: "Who's the better player?",
    noun: "returnees who never won",
    line: w => w.name,
    sortable: true,
  },
});

// Shows a crash on the page (instead of a blank screen) and lets the user reset saved state.
class RankBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("Rank crashed:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    const kind = window.location.pathname.slice(rp().length).split("/")[1];
    return (
      <div className="rk-note">
        <p>Something went wrong on this page.</p>
        {kind && (
          <button className="rk-btn" onClick={() => { clearRankSession(kind); window.location.assign(rp(`/${kind}`)); }}>
            Reset this ranking
          </button>
        )}
      </div>
    );
  }
}

// Hidden page: reached only by typing /rank or /bb/rank (gated by RankGate in App.jsx).
// showId "bb" runs Rank on Big Brother data, which it loads itself (like the other BB modes).
export default function Rank({ contestants, show: showId = "sv" }) {
  setShow(showId); // before any child renders; see rankShow.js
  const [bb, setBb] = useState([]);
  useEffect(() => {
    if (showId !== "bb") return;
    let live = true;
    fetch("/bb_contestants.json").then(r => r.json()).then(d => { if (live) setBb(d); }).catch(() => {});
    return () => { live = false; };
  }, [showId]);
  return <RankBoundary><RankPage key={showId} contestants={showId === "bb" ? bb : contestants} /></RankBoundary>;
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

  const bb = show().id === "bb";
  const lists = useMemo(
    () => (bb ? bbLists(contestants) : { winners: winnersOf(contestants), seasons: seasonItems(contestants), returnees: returneesOf(contestants) }),
    [bb, contestants],
  );
  const templates = bb ? [] : TIER_TEMPLATES; // curated tier lists are Survivor-only for now
  const KINDS = kinds();

  const [kind, step, arg] = pathname.slice(rp().length).split("/").filter(Boolean);
  // "s50" = the individual players of season 50 (ranked by 1v1 or drag-and-drop).
  const sn = /^s(\d+)$/.exec(kind || "")?.[1];
  const players = useMemo(() => (sn ? (bb ? bbCast : playersOf)(contestants, +sn) : []), [bb, sn, contestants]);
  const cfg = sn
    ? {
      title: `${players[0]?.label} ${playersWord("Players")}`,
      blurb: "Rank this season's cast, one matchup at a time or by dragging them into order.",
      question: "Who's the better player?",
      noun: `${players[0]?.label} ${playersWord("Players").toLowerCase()}`,
      line: w => w.name,
      sortable: true,
    }
    : KINDS[kind];

  return (
    <>
      <style>{RANK_CSS}</style>
      <div className="rk" style={{ "--rk-accent": show().accent, "--rk-deep": show().deep }}>
        {cfg && (sn ? players : lists[kind]).length
          ? <Board key={kind} kind={kind} cfg={cfg} items={sn ? players : lists[kind]} seasonList={lists.seasons} step={step} arg={arg} navigate={navigate} />
          : kind === "players"
            ? <PlayerSeasons navigate={navigate} seasons={lists.seasons} />
            : kind === "tiers" && lists.seasons.length
              ? <TierGallery lists={lists} contestants={contestants} templates={templates} navigate={navigate} />
            : kind === "t" && lists.seasons.length
              ? <TemplateTiers key={step} slug={step} templates={templates} contestants={contestants} seasons={lists.seasons} navigate={navigate} />
              : kind === "today" && lists.seasons.length
                ? <RankToday lists={lists} navigate={navigate} />
                : <Chooser navigate={navigate} lists={lists} contestants={contestants} templates={templates} />}
      </div>
    </>
  );
}

// A curated tier list from tierTemplates.json, at /rank/t/<slug>.
function TemplateTiers({ slug, templates, contestants, seasons, navigate }) {
  const tpl = templates.find(t => t.slug === slug);
  const items = useMemo(() => (tpl ? templateItems(tpl, contestants, seasons) : []), [tpl, contestants, seasons]);
  const byId = useMemo(() => new Map(items.map(w => [w.id, w])), [items]);
  if (!items.length) return <Redirect to={rp()} navigate={navigate} />;
  return <RankTiers kind={`t-${slug}`} cfg={{ noun: tpl.noun }} items={items} byId={byId} navigate={navigate} base={rp("/tiers")} title={tpl.title} blurb={tpl.blurb} />;
}

function Chooser({ navigate, lists, contestants, templates }) {
  // Winners are masked ("Winner of …") so the front page doesn't name anyone.
  const maps = useMemo(() => {
    const seasonName = new Map(lists.seasons.map(s => [s.season, s.name]));
    return {
      winners: new Map(lists.winners.map(w => [w.season, { ...w, name: `Winner of ${seasonName.get(w.season)}`, sub: `Season ${w.season}` }])),
      seasons: new Map(lists.seasons.map(s => [s.season, s])),
    };
  }, [lists]);
  const [peek, setPeek] = useState("winners");
  // Status at a glance: voted or not, and the streak at stake.
  const todayLine = useMemo(() => {
    const m = dailyMatchup(etToday(), lists);
    if (!m) return "One vote a day. See how everyone split.";
    const votes = loadDailyVotes();
    const streak = streakOf(votes, m.num);
    if (votes[m.num] != null) return `✓ Voted today${streak > 1 ? ` · 🔥 ${streak}-day streak` : ""}. See how everyone split.`;
    return streak ? `Vote to keep your 🔥 ${streak}-day streak alive.` : "One vote a day. See how everyone split.";
  }, [lists]);
  const card = (to, t, d) => (
    <button key={to} className="rk-big" onClick={() => navigate(to)}>
      <div className="t">{t}</div>
      <div className="d">{d}</div>
    </button>
  );
  return (
    <>
      {/* Show switch: each show is its own Rank, at its own address. */}
      <div className="rk-row">
        <div className="rk-seg" role="group" aria-label="Show">
          {Object.values(SHOWS).map(s => (
            <button key={s.id} className={s.id === show().id ? "on" : ""} aria-pressed={s.id === show().id} onClick={() => navigate(s.base)}>{s.name}</button>
          ))}
        </div>
      </div>
      <h1>Rank</h1>
      <div className="rk-sub">The community's {show().name} rankings. Heavy spoilers ahead.</div>
      {card(rp("/today"), "Today's Matchup", todayLine)}
      <div className="rk-hrow">
        <div className="rk-h2">Tier lists</div>
        <button className="rk-link" onClick={() => navigate(rp("/tiers"))}>See all</button>
      </div>
      <TierStrip lists={lists} contestants={contestants} templates={templates} navigate={navigate} />
      <div className="rk-h2">Consensus top 5</div>
      <div className="rk-row">
        <div className="rk-seg">
          <button className={peek === "winners" ? "on" : ""} onClick={() => setPeek("winners")}>Winners</button>
          <button className={peek === "seasons" ? "on" : ""} onClick={() => setPeek("seasons")}>Seasons</button>
        </div>
      </div>
      <Leaderboard key={peek} kind={peek} bySeason={maps[peek]} top={5} empty={<TodayPeek navigate={navigate} />} />
      <div className="rk-row">
        <button className="rk-link" onClick={() => navigate(rp(`/${peek}`))}>See the full {peek} ranking</button>
      </div>
      <div className="rk-h2">Rank your own</div>
      <div className="rk-cards">
        {card(rp("/winners"), "Winners", `Who's the best ${show().winnerWord}?`)}
        {card(rp("/seasons"), "Seasons", "Which seasons are the greatest?")}
        {card(rp("/players"), playersWord("Players"), "Rank the cast of any season.")}
        {card(rp("/returnees"), "Returnees", "The best to never win.")}
      </div>
    </>
  );
}

function PlayerSeasons({ navigate, seasons }) {
  return (
    <>
      <button className="rk-backbtn" onClick={() => navigate(rp())}>All rankings</button>
      <h1>{playersWord("Players")}</h1>
      <div className="rk-sub">Pick a season to rank its cast.</div>
      <div className="rk-chips">
        {[...seasons].reverse().map(x => (
          <button key={x.season} className="rk-chip" onClick={() => navigate(rp(`/s${x.season}`))}>
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
    navigate(rp(`/${kind}/play`));
  }

  function startOver() {
    if (!window.confirm("Start over? Your current ranking will be erased.")) return;
    clearRankSession(kind);
    setSession(null);
    navigate(rp(`/${kind}/setup`));
  }

  const base = rp(`/${kind}`);
  if (step === "setup") {
    return (
      <>
        <button className="rk-backbtn" onClick={() => navigate(base)}>Back</button>
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
                  <button className={placementStart ? "on" : ""} onClick={() => setPlacementStart(true)}>{/^s\d/.test(kind) ? "Start in placement order" : "Start A–Z"}</button>
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
      : <Results kind={kind} cfg={cfg} session={activeSession} byId={byId} bySeason={bySeason} update={update} navigate={navigate} base={base} toSort={cfg.sortable ? toSort : null} />;
  }
  // Items added by a data update since the last visit (a new season's winner).
  const added = activeSession && session ? activeSession.order.length - session.order.length : 0;
  return <Home cfg={cfg} kind={kind} session={activeSession} added={added} bySeason={bySeason} startOver={startOver} navigate={navigate} base={base} />;
}

function Redirect({ to, navigate }) {
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return null;
}

function Home({ cfg, kind, session, added, bySeason, startOver, navigate, base }) {
  const done = session ? isDone(session) : false;
  return (
    <>
      <button className="rk-backbtn" onClick={() => navigate(rp())}>All rankings</button>
      <h1>{cfg.title}</h1>
      <div className="rk-sub">{cfg.blurb}</div>
      {added > 0 && <div className="rk-note"><b>{added} new since your last visit.</b> Resume to place {added === 1 ? "it" : "them"} in your ranking.</div>}
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
      <div className="rk-note">
        {state.ranked.length < MIN_SUBMIT
          ? <>{state.ranked.length} of {total} placed · <b>{MIN_SUBMIT - state.ranked.length} more</b> until you can see how you compare to the {show().crowd}</>
          : <>{state.ranked.length} of {total} placed · <button className="rk-link" onClick={() => navigate(`${base}/results`)}>Compare with the {show().crowd} now →</button></>}
      </div>
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

function Results({ kind, cfg, session, byId, bySeason, update, navigate, base, toSort }) {
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
      {/* Peak-end: the payoff comes before the long list, not under it. */}
      {ranking.length >= MIN_SUBMIT && <TribeCompare kind={kind} seasons={seasonsOf(ranking, byId)} bySeason={bySeason} cfg={cfg} />}
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
      <KeepPlaying navigate={navigate} skip={[base]} />
    </>
  );
}
