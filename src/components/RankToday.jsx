import { useEffect, useRef, useState } from "react";
import { dailyMatchup, etToday, streakOf } from "../shared/rank";
import { getRankAnonId, loadDailyVotes, saveDailyVote } from "../shared/rankStorage";
import { fetchRankDaily, fetchRankLeaderboard, voteRankDaily } from "../shared/rankApi";
import { msUntilMidnightET } from "../shared/gameLogic";
import { KeepPlaying, Matchup } from "./RankParts";
import { show, rp, shareUrl } from "../shared/rankShow";

// Today's Matchup: one 1v1 a day, the same for everyone. Vote, then see how the
// community split. A daily reason to come back; each vote also feeds the consensus.

const QUESTION = { seasons: "Which season is better?", winners: "Who's the better winner?" };
const label = (kind, w) => (kind === "winners" ? `${w.name} (${show().short}${w.season})` : w.name);

// Ticks once a minute; reloads at midnight ET so a page left open gets the new matchup (same as the Daily).
function useMsLeft() {
  const [ms, setMs] = useState(msUntilMidnightET);
  useEffect(() => {
    const tick = setInterval(() => setMs(msUntilMidnightET()), 60000);
    const reload = setTimeout(() => window.location.reload(), msUntilMidnightET());
    return () => { clearInterval(tick); clearTimeout(reload); };
  }, []);
  return ms;
}

function Countdown() {
  const mins = Math.ceil(useMsLeft() / 60000);
  return <div className="rk-note">Next matchup in <b>{Math.floor(mins / 60)}h {mins % 60}m</b></div>;
}

// Front page stand-in while the consensus is still too thin to show.
export function TodayPeek({ navigate }) {
  const [day] = useState(etToday);
  const [split, setSplit] = useState(undefined);
  useEffect(() => {
    let live = true;
    fetchRankDaily(day).then(s => { if (live) setSplit(s); });
    return () => { live = false; };
  }, [day]);
  const total = split ? [...split.values()].reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="rk-note">
      The consensus fills in as people rank.{" "}
      {total > 0 && <><b>{total} vote{total === 1 ? "" : "s"}</b> on today's matchup so far. </>}
      <button className="rk-link" onClick={() => navigate(rp("/today"))}>Add yours</button>
    </div>
  );
}

export default function RankToday({ lists, navigate }) {
  const [day] = useState(etToday);
  const m = dailyMatchup(day, lists);
  const [votes, setVotes] = useState(loadDailyVotes);
  const [split, setSplit] = useState(undefined); // undefined = not loaded, null = failed
  const [tribe, setTribe] = useState(null);       // consensus rows for today's kind
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const mine = m ? votes[m.num] : null;
  const kind = m?.kind;

  // Already voted (e.g. came back later): load the split.
  useEffect(() => {
    if (mine == null || split !== undefined) return;
    let live = true;
    fetchRankDaily(day).then(s => { if (live) setSplit(s); });
    return () => { live = false; };
  }, [mine, split, day]);

  // Where today's pair sits on the full consensus, shown under the split.
  useEffect(() => {
    if (mine == null || !kind) return;
    let live = true;
    fetchRankLeaderboard(kind).then(d => { if (live && d) setTribe(d.rows); });
    return () => { live = false; };
  }, [mine, kind]);

  if (!m) return null;

  async function vote(code) {
    const [pick, other] = code === "w" ? [m.a, m.b] : [m.b, m.a];
    saveDailyVote(m.num, pick.season);
    setVotes(loadDailyVotes());
    window.gtag?.("event", "rank_daily_vote", { kind: m.kind });
    await voteRankDaily(getRankAnonId(), day, m.kind, pick.season, other.season);
    setSplit(await fetchRankDaily(day));
  }

  const streak = streakOf(votes, m.num);
  const head = (
    <>
      <button className="rk-backbtn" onClick={() => navigate(rp())}>All rankings</button>
      <h1>Today's Matchup</h1>
      <div className="rk-sub">#{m.num} · one vote a day, then see how everyone split</div>
    </>
  );

  if (mine == null) {
    return (
      <>
        {head}
        {streak > 0 && <div className="rk-note">Vote to keep your <b>🔥 {streak}-day streak</b> alive</div>}
        <Matchup cur={m.a} other={m.b} flip={false} question={QUESTION[m.kind]} onChoose={vote} unsure={false} />
      </>
    );
  }

  const myIdx = mine === m.a.season ? 0 : 1;
  const picked = myIdx ? m.b : m.a;
  // Your own vote always counts, even if it hasn't reached the server.
  const counts = split ? [m.a, m.b].map((w, i) => Math.max(split.get(w.season) || 0, i === myIdx ? 1 : 0)) : null;
  const total = counts ? counts[0] + counts[1] : 0;
  const pct = i => (total ? Math.round((counts[i] / total) * 100) : 0);
  const tribePos = w => {
    const i = tribe ? tribe.findIndex(r => r.season === w.season) : -1;
    return i < 0 ? null : i + 1;
  };
  const [posA, posB] = [tribePos(m.a), tribePos(m.b)];

  async function share() {
    const text = [
      `${show().title} #${m.num} 🗳️`,
      `${QUESTION[m.kind]}`,
      `I picked ${label(m.kind, picked)}, with ${pct(myIdx)}% of players`,
      streak > 1 ? `🔥 ${streak}-day streak` : null,
      "",
      shareUrl("/today"),
    ].filter(x => x != null).join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {head}
      <div className="rk-q">{QUESTION[m.kind]}</div>
      {split === undefined && <div className="rk-note">Counting votes…</div>}
      {split === null && <div className="rk-note">Results unavailable right now. Your vote is saved.</div>}
      {counts && (
        <div className="rk-split">
          {[m.a, m.b].map((w, i) => (
            <div key={w.id} className={`side${i === myIdx ? " mine" : ""}`}>
              <i style={{ width: `${pct(i)}%` }} />
              <span>{label(m.kind, w)}{i === myIdx ? " · your pick" : ""}</span>
              <span>{pct(i)}%</span>
            </div>
          ))}
        </div>
      )}
      {counts && <div className="rk-note">{total} vote{total === 1 ? "" : "s"} so far</div>}
      {posA && posB && (
        <div className="rk-note">
          On the full consensus, the {show().crowd} has {m.a.name} at <b>#{posA}</b> and {m.b.name} at <b>#{posB}</b>.
        </div>
      )}
      <div className="rk-note">
        <b>{streak > 1 ? `🔥 ${streak}-day streak` : "🔥 Day 1. Come back tomorrow to keep it going."}</b>
      </div>
      <Countdown />
      <div className="rk-row">
        <button className="rk-btn primary" onClick={share}>{copied ? "Copied!" : "Share"}</button>
        <button className="rk-btn" onClick={() => navigate(rp(`/${m.kind}`))}>Rank all the {m.kind}</button>
      </div>
      <KeepPlaying navigate={navigate} skip={[rp("/today"), rp(`/${m.kind}`)]} />
    </>
  );
}
