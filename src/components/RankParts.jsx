import { useEffect, useRef, useState } from "react";
import { fetchRankLeaderboard } from "../shared/rankApi";
import { subOf, barColors } from "../shared/rank";
import { renderRankImage, shareOrDownloadImage } from "../shared/rankImage";

// Text-only on purpose (no contestant photos). Tribe colors are just an accent.
// A season shows one stripe per starting tribe, the winner's tribe on top.
export function Bar({ w }) {
  const cols = barColors(w);
  const step = 100 / cols.length;
  const bg = `linear-gradient(to bottom, ${cols.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(", ")})`;
  return <span className="rk-bar" style={{ background: bg }} />;
}

export const RANK_CSS = `
  .rk { --rk-accent: #e8742a; max-width: 640px; margin: 0 auto; padding: 8px 4px 40px; color: var(--text); } /* swap this one variable to re-theme (e.g. BB) */
  .rk h1 { font-family: 'Bebas Neue', sans-serif; font-size: 44px; letter-spacing: 2px; text-align: center; margin: 12px 0 4px; color: var(--rk-accent); }
  .rk h1::after { content: ''; display: block; width: 56px; height: 4px; border-radius: 2px; background: var(--rk-accent); margin: 8px auto 0; }
  .rk .rk-sub { text-align: center; color: var(--text3); font-size: 14px; margin-bottom: 18px; }
  .rk-btn { padding: 10px 16px; font-size: 15px; font-weight: 600; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg3); color: var(--text); cursor: pointer; font-family: inherit; }
  .rk-btn:hover { background: var(--bg2); border-color: var(--rk-accent); }
  .rk-btn.primary { background: var(--rk-accent); color: #1a1a1a; border-color: var(--rk-accent); }
  .rk-btn.primary:hover { filter: brightness(1.08); }
  .rk-btn.small { padding: 5px 10px; font-size: 13px; font-weight: 500; }
  .rk-btn:disabled { opacity: .4; cursor: default; }
  .rk-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 10px 0; }
  .rk-q { text-align: center; font-size: 20px; font-weight: 600; margin: 8px 0 14px; }
  .rk-vs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rk-pick { position: relative; overflow: hidden; text-align: left; padding: 22px 16px 22px 24px; border-radius: 12px; border: 1px solid var(--border);
    background: var(--bg2); color: var(--text); cursor: pointer; font-family: inherit;
    min-height: 120px; transition: transform .08s, background .12s; }
  .rk-pick:hover { background: var(--bg3); border-color: var(--rk-accent); }
  .rk-pick:active { transform: scale(.98); }
  .rk-pick .nm { font-size: 20px; font-weight: 600; line-height: 1.2; }
  .rk-pick .se { font-size: 13px; color: var(--text3); margin-top: 6px; }
  .rk-pick .se.top { margin: 0 0 6px; }
  .rk-list { list-style: none; border: 1px solid var(--rk-accent); border-radius: 10px; overflow: hidden; }
  .rk-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border2);
    position: relative; padding-left: 18px; background: var(--bg2); font-size: 15px; }
  .rk-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
  .rk-item:last-child { border-bottom: none; }
  .rk-item .pos { width: 28px; text-align: right; color: var(--rk-accent); font-weight: 700; font-variant-numeric: tabular-nums; }
  .rk-item .nm { flex: 1; font-weight: 600; }
  .rk-item .se { color: var(--text3); font-size: 12px; }
  .rk-item .sc { color: var(--rk-accent); font-weight: 600; font-size: 13px; font-variant-numeric: tabular-nums; }
  .rk-item .mv { display: flex; gap: 4px; }
  .rk-h2 { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 1.5px; margin: 26px 0 8px; color: var(--rk-accent); }
  .rk-label { color: var(--text); font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin: 14px 0 6px; }
  .rk-link { background: none; border: none; color: var(--rk-accent); font-size: 12px; text-decoration: underline;
    cursor: pointer; font-family: inherit; padding: 2px; }
  .rk-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin: 10px 0 16px; }
  .rk-chip { text-align: left; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg2);
    color: var(--text3); font-size: 13px; cursor: pointer; font-family: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rk-chip b { color: var(--text2); margin-right: 3px; }
  .rk-chip:hover { border-color: var(--rk-accent); }
  .rk-chip.on { border-color: var(--rk-accent); box-shadow: inset 0 0 0 1px var(--rk-accent); color: var(--text); font-weight: 700; }
  .rk-chip.on b { color: var(--rk-accent); }
  .rk-big { display: block; width: 100%; text-align: left; padding: 22px 18px; margin: 12px 0; border-radius: 12px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--text); cursor: pointer; font-family: inherit; }
  .rk-big { border-left: 6px solid var(--rk-accent); }
  .rk-big:hover { background: var(--bg3); border-color: var(--rk-accent); }
  .rk-big .t { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 1.5px; color: var(--rk-accent); }
  .rk-big .d { color: var(--text3); font-size: 14px; margin-top: 2px; }
  .rk-static { cursor: default; min-height: 0; }
  .rk-static:hover { background: var(--bg2); border-color: var(--border); }
  .rk-static:active { transform: none; }
  .rk-flip { perspective: 900px; }
  .rk-flip-in { display: grid; transform-style: preserve-3d; transition: transform .5s cubic-bezier(.3, .7, .2, 1); }
  .rk-flip-in.open { transform: rotateY(180deg); }
  .rk-flip-in > * { grid-area: 1 / 1; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  .rk-flip-in > .front { transform: rotateY(180deg); }
  .rk-back { display: flex; align-items: center; justify-content: center; background: var(--rk-accent); border-color: var(--rk-accent);
    color: #1a1a1a; font-family: 'Bebas Neue', sans-serif; font-size: 64px; }
  .rk-back:hover { background: var(--rk-accent); border-color: var(--rk-accent); }
  @media (prefers-reduced-motion: reduce) { .rk-flip-in { transition: none; } }
  .rk-slot { flex: 1; text-align: left; background: none; border: 1px dashed var(--border); border-radius: 6px; padding: 6px 10px;
    color: var(--text3); font-family: inherit; font-size: 14px; cursor: pointer; }
  .rk-slot:hover:not(:disabled) { border-color: var(--rk-accent); color: var(--text); }
  .rk-slot:disabled { cursor: default; opacity: .5; }
  .rk-tent { outline: 2px solid var(--rk-accent); outline-offset: -2px; }
  .rk-grip { cursor: grab; touch-action: none; user-select: none; color: var(--text3); font-size: 20px; padding: 0 4px; }
  .rk-drag { background: var(--bg3); outline: 2px solid var(--rk-accent); outline-offset: -2px; }
  .rk-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .rk-seg button { padding: 9px 18px; border: none; background: var(--bg3); color: var(--text); cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 600; }
  .rk-seg button.on { background: var(--rk-accent); color: #1a1a1a; }
  .rk-note { color: var(--text3); font-size: 13px; text-align: center; margin: 10px 0; }

  /* ---- Motion and feel. Everything interactive is under 300ms; the most-used
     actions (picking a matchup, placing a name) get the least animation. ---- */
  .rk { --rk-out: cubic-bezier(.2, .8, .2, 1); --rk-spring: cubic-bezier(.34, 1.56, .64, 1); --rk-deep: #b3541a; }
  /* Depth: buttons and cards sit on a ledge and press down into it (squash on press). */
  .rk-btn { box-shadow: 0 2px 0 var(--border2); transition: transform .12s var(--rk-out), box-shadow .12s var(--rk-out), background .12s, border-color .12s, filter .12s; }
  .rk-btn.primary { box-shadow: 0 2px 0 var(--rk-deep); }
  .rk-btn:active:not(:disabled) { transform: translateY(2px) scale(.97, .94); box-shadow: 0 0 0 transparent; }
  .rk-btn.big { padding: 14px 28px; font-size: 17px; min-width: 220px; }
  .rk-btn.small { min-height: 32px; min-width: 32px; }
  .rk-pop { animation: rk-pop .26s var(--rk-spring); }
  .rk-big, .rk-pick { box-shadow: 0 3px 0 var(--border2); transition: transform .14s var(--rk-out), box-shadow .14s var(--rk-out), background .12s, border-color .12s, opacity .14s; }
  .rk-big:hover, .rk-pick:not(.rk-static):hover { transform: translateY(-2px); box-shadow: 0 5px 0 var(--border2); }
  .rk-big:active, .rk-pick:not(.rk-static):active { transform: translateY(2px) scale(.985, .96); box-shadow: 0 1px 0 var(--border2); }
  /* Hit areas reach past what you can see. */
  .rk-link, .rk-grip { position: relative; }
  .rk-link::after, .rk-grip::after { content: ''; position: absolute; inset: -9px; }
  /* Front page and board home: a few big chunks instead of a long scroll. */
  .rk-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 14px 0; }
  .rk-cards .rk-big { margin: 0; height: 100%; }
  .rk-cards .rk-big .t { font-size: 28px; }
  /* Matchup: the pair arrives together, the pick pops and the other one steps back. */
  .rk-vs .rk-pick { animation: rk-rise .18s var(--rk-out) backwards; }
  .rk-vs .rk-pick.won { animation: rk-win .2s var(--rk-spring) forwards; border-color: var(--rk-accent); background: var(--bg3); }
  .rk-vs .rk-pick.lost { opacity: .3; transform: scale(.97); }
  .rk-prog { height: 6px; border-radius: 3px; background: var(--bg3); overflow: hidden; margin: 6px 0 4px; }
  .rk-prog i { display: block; height: 100%; border-radius: 3px; background: var(--rk-accent); transition: width .28s var(--rk-out); }
  /* Lists rise in once, top first; a dragged row lifts off the page. */
  .rk-list.enter .rk-item { animation: rk-rise .28s var(--rk-out) backwards; animation-delay: calc(min(var(--i), 14) * 22ms); }
  .rk-item { transition: background .12s; }
  .rk-drag { position: relative; z-index: 1; box-shadow: 0 6px 18px var(--shadow); }
  .rk-skel { height: 40px; background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%); background-size: 200% 100%; animation: rk-shimmer 1.1s linear infinite; }
  .rk-deal { animation: rk-deal .24s var(--rk-out); }

  /* ---- Tier lists ---- */
  .rk-tiers { display: grid; gap: 6px; user-select: none; -webkit-user-select: none; margin: 12px 0; }
  .rk-tier { display: flex; min-height: 58px; border-radius: 10px; overflow: hidden; background: var(--bg2); border: 1px solid var(--border2);
    transition: border-color .12s, background .12s, transform .12s var(--rk-out); }
  .rk-tier .lab { flex: 0 0 68px; display: flex; align-items: center; justify-content: center; border: none; padding: 4px;
    font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 1px; line-height: 1; cursor: inherit; overflow-wrap: anywhere; text-align: center; }
  .rk-tier .its, .rk-tray { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; align-content: flex-start; }
  .rk-tray { min-height: 58px; border-radius: 10px; border: 1px dashed var(--border); user-select: none; -webkit-user-select: none; }
  .rk-tray .rk-note { margin: auto; }
  .rk-tiers.aiming .rk-tier { cursor: pointer; border-color: var(--border); }
  .rk-tiers.aiming .rk-tier:hover, .rk-tier.over, .rk-tray.over { border-color: var(--rk-accent); background: var(--bg3); transform: scale(1.01); }
  .rk-tiers.aiming .lab { animation: rk-nudge .3s var(--rk-out); }
  .rk-tchip { position: relative; overflow: hidden; padding: 7px 10px 7px 14px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg3);
    color: var(--text); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 0 var(--border2);
    transition: transform .12s var(--rk-out), box-shadow .12s, border-color .12s, opacity .12s; }
  .rk-tchip::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--c, #888); }
  .rk-tchip small { color: var(--text3); font-weight: 500; font-size: 11px; margin-left: 6px; }
  .rk-tchip:hover { border-color: var(--rk-accent); }
  .rk-tchip:active { transform: scale(.96, .93); }
  .rk-tchip.sel { border-color: var(--rk-accent); box-shadow: 0 0 0 2px var(--rk-accent); transform: translateY(-2px) scale(1.04); }
  .rk-tchip.land { animation: rk-land .26s var(--rk-spring); }
  .rk-tchip.lifted { opacity: .3; }
  .rk-ghost { position: fixed; z-index: 50; pointer-events: none; transform: translate(-50%, -50%) rotate(-4deg) scale(1.08); box-shadow: 0 10px 24px var(--shadow); border-color: var(--rk-accent); }
  .rk-tbtns { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 14px 0; }
  .rk-tbtns button { min-width: 52px; min-height: 52px; padding: 6px 12px; border: none; border-radius: 10px; cursor: pointer;
    font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 1px; box-shadow: 0 3px 0 rgba(0, 0, 0, .35);
    transition: transform .12s var(--rk-out), box-shadow .12s; }
  .rk-tbtns button:hover { transform: translateY(-2px); box-shadow: 0 5px 0 rgba(0, 0, 0, .35); }
  .rk-tbtns button:active { transform: translateY(3px) scale(.96, .92); box-shadow: none; }
  .rk-dock { position: fixed; left: 50%; bottom: 12px; z-index: 40; transform: translateX(-50%); width: min(600px, calc(100vw - 16px));
    padding: 10px 10px 2px; border-radius: 14px; border: 1px solid var(--rk-accent); background: var(--bg2); box-shadow: 0 10px 30px var(--shadow);
    animation: rk-dock .2s var(--rk-out); }
  .rk-dock .who { text-align: center; font-weight: 700; font-size: 15px; }
  .rk-dock .rk-tbtns { margin: 8px 0; }
  .rk-tedit { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; margin: 8px 0; border-radius: 10px;
    background: var(--bg2); border: 1px solid var(--border2); border-left: 8px solid var(--c); }
  .rk-tedit > input { width: 110px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg3); color: var(--text);
    font-family: inherit; font-size: 16px; font-weight: 700; }
  .rk-tedit > input:focus { outline: none; border-color: var(--rk-accent); }
  .rk-tedit .sw { display: flex; gap: 6px; align-items: center; flex: 1; flex-wrap: wrap; }
  .rk-tedit .sw button { position: relative; width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; transition: transform .12s var(--rk-spring); }
  .rk-tedit .sw button::after { content: ''; position: absolute; inset: -5px; }
  .rk-tedit .sw button:hover { transform: scale(1.15); }
  .rk-tedit .sw button.on { border-color: var(--text); transform: scale(1.15); }
  .rk-tedit .sw input { width: 30px; height: 28px; padding: 0; border: none; background: none; cursor: pointer; }
  .rk-tedit .mv { display: flex; gap: 4px; }

  @keyframes rk-rise { from { opacity: 0; transform: translateY(8px); } }
  @keyframes rk-win { 40% { transform: scale(1.06, 1.03); } to { transform: scale(1.03); } }
  @keyframes rk-pop { 0% { transform: scale(.92, .88); } 60% { transform: scale(1.06, 1.08); } }
  @keyframes rk-land { 0% { transform: translate(-8px, -12px) rotate(-5deg) scale(1.12); } 55% { transform: translate(1px, 2px) rotate(1deg) scale(.95, .9); } }
  @keyframes rk-deal { from { opacity: 0; transform: translate(28px, -10px) rotate(4deg); } }
  @keyframes rk-nudge { 40% { transform: scale(1.08); } }
  @keyframes rk-dock { from { opacity: 0; transform: translate(-50%, 16px); } }
  @keyframes rk-shimmer { to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) {
    .rk *, .rk *::before, .rk *::after { animation: none !important; transition: none !important; }
  }
  @media (max-width: 480px) {
    .rk-vs { grid-template-columns: 1fr; }
    .rk-pick { min-height: 90px; padding: 16px 14px 16px 22px; }
    .rk-item .se { display: none; }
    .rk-tier .lab { flex-basis: 54px; font-size: 26px; }
    .rk-btn.big { width: 100%; }
  }
`;

export function WinnerLine({ w }) {
  return (
    <>
      <span className="nm">{w.name}</span>
      <span className="se">{subOf(w)}</span>
    </>
  );
}

// Text card for one season / winner (shared by matchups and Blind ranking).
export function CardBody({ w }) {
  return (
    <>
      <Bar w={w} />
      {w.winner === undefined ? (
        <>
          <div className="nm">{w.name}</div>
          <div className="se">{w.card || `Season ${w.season} · ${w.seasonName}`}</div>
        </>
      ) : (
        <>
          <div className="se top">Season {w.season}</div>
          <div className="nm">{w.name}</div>
          {w.winner && <div className="se">Winner: {w.winner}</div>}
        </>
      )}
    </>
  );
}

// Remount it per pair (key) so the pick state resets and the new pair animates in.
export function Matchup({ cur, other, flip, question, onChoose }) {
  const [picked, setPicked] = useState(null);
  // The pick pops and the other card steps back for a beat before the next pair arrives.
  const pick = code => {
    if (picked) return;
    setPicked(code);
    setTimeout(() => onChoose(code), 150);
  };
  const pickRef = useRef(pick);
  useEffect(() => { pickRef.current = pick; });
  // Left / right arrow keys pick the card on that side.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      pickRef.current((e.key === "ArrowLeft") === flip ? "w" : "l");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flip]);
  const side = (w, code) => (
    <button className={`rk-pick${picked ? (picked === code ? " won" : " lost") : ""}`} onClick={() => pick(code)}>
      <CardBody w={w} />
    </button>
  );
  // Which side each one lands on is random (seeded by the engine).
  return (
    <>
      <div className="rk-q">{question}</div>
      <div className="rk-vs">
        {flip ? side(cur, "w") : side(other, "l")}
        {flip ? side(other, "l") : side(cur, "w")}
      </div>
      <div className="rk-row" style={{ marginTop: 14 }}>
        <button className="rk-btn small" disabled={!!picked} onClick={() => onChoose("?")}>I don't know</button>
      </div>
    </>
  );
}

export function RankList({ ids, byId, onMove, scores, drag }) {
  const dragging = useRef(null);
  const [active, setActive] = useState(null);
  // Rows rise in once. The class comes off afterwards so reordering doesn't replay it.
  const [enter, setEnter] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEnter(false), 700);
    return () => clearTimeout(t);
  }, []);
  // Pointer-based so it works on touch too; reorders live as the handle crosses rows.
  const onDrag = e => {
    if (dragging.current == null) return;
    const rows = [...e.currentTarget.closest("ol").children];
    let t = rows.findIndex(li => e.clientY < li.getBoundingClientRect().bottom);
    if (t < 0) t = rows.length - 1;
    if (t !== dragging.current) { onMove(dragging.current, t); dragging.current = t; setActive(t); }
    if (e.clientY < 70) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
  };
  return (
    <ol className={`rk-list${enter ? " enter" : ""}`}>
      {ids.map((id, i) => {
        const w = byId.get(id);
        if (!w) return null;
        return (
          <li key={id} className={`rk-item${active === i ? " rk-drag" : ""}`} style={{ "--i": i }}>
            <Bar w={w} />
            {drag && onMove && (
              <span
                className="rk-grip" aria-hidden="true"
                onPointerDown={e => { dragging.current = i; setActive(i); e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerMove={onDrag}
                onPointerUp={() => { dragging.current = null; setActive(null); }}
                onPointerCancel={() => { dragging.current = null; setActive(null); }}
              >⠿</span>
            )}
            <span className="pos">{i + 1}</span>
            <WinnerLine w={w} />
            {scores && <span className="sc">{scores[i]}</span>}
            {onMove && (
              <span className="mv">
                <button className="rk-btn small" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label="Move up">↑</button>
                <button className="rk-btn small" disabled={i === ids.length - 1} onClick={() => onMove(i, i + 1)} aria-label="Move down">↓</button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Leaderboard({ kind, bySeason, top }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = failed
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    fetchRankLeaderboard(kind).then(d => { if (live) setData(d); });
    return () => { live = false; };
  }, [kind]);

  if (data === undefined) {
    return (
      <ol className="rk-list" aria-label="Loading the consensus">
        {Array.from({ length: top || 10 }, (_, i) => <li key={i} className="rk-item rk-skel" />)}
      </ol>
    );
  }
  if (data === null) return <div className="rk-note">Leaderboard unavailable right now.</div>;
  if (!data.rows.length) return <div className="rk-note">No rankings yet. Be the first!</div>;

  const rows = data.rows.filter(r => bySeason.has(r.season));
  const shown = all ? rows : rows.slice(0, top || 10);
  const ids = shown.map(r => bySeason.get(r.season).id);
  const lookup = new Map(shown.map(r => [bySeason.get(r.season).id, bySeason.get(r.season)]));
  const scores = shown.map(r => `${Math.round((1 - r.avgPct) * 100)}`);

  return (
    <>
      <RankList ids={ids} byId={lookup} scores={scores} />
      {!top && <div className="rk-note">Consensus score out of 100</div>}
      {!top && rows.length > 10 && (
        <div className="rk-row">
          <button className="rk-btn small" onClick={() => setAll(a => !a)}>{all ? "Show top 10" : `Show all ${rows.length}`}</button>
        </div>
      )}
    </>
  );
}

// Season picker shown before ranking starts. `seasons` = [{ season, seasonName }].
const RANGES = [[1, 20], [21, 40], [41, 99]];

export function SeasonPicker({ seasons, selected, onChange }) {
  const toggle = n => onChange(selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n]);
  const toggleRange = ([a, b]) => {
    const inRange = seasons.map(x => x.season).filter(n => n >= a && n <= b);
    const all = inRange.every(n => selected.includes(n));
    onChange(all ? selected.filter(n => !inRange.includes(n)) : [...new Set([...selected, ...inRange])]);
  };
  const last = seasons[seasons.length - 1]?.season;
  return (
    <>
      <div className="rk-row">
        <button className="rk-btn small" onClick={() => onChange(seasons.map(x => x.season))}>All</button>
        <button className="rk-btn small" onClick={() => onChange([])}>None</button>
        {RANGES.filter(([a]) => a <= last).map(r => (
          <button key={r[0]} className="rk-btn small" onClick={() => toggleRange(r)}>
            {r[0]}–{Math.min(r[1], last)}
          </button>
        ))}
      </div>
      <div className="rk-chips">
        {seasons.map(x => (
          <button
            key={x.season}
            className={`rk-chip${selected.includes(x.season) ? " on" : ""}`}
            aria-pressed={selected.includes(x.season)}
            onClick={() => toggle(x.season)}
          >
            <b>{x.season}</b> {x.seasonName}
          </button>
        ))}
      </div>
    </>
  );
}

// Copy-text and image sharing for a finished (or partial) ranking.
export function ShareButtons({ ranking, byId, cfg, kind, blind }) {
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const sizes = ranking.length > 10 ? [10, 0] : [0];
  const word = blind ? "blind " : "";

  async function share(count) {
    const top = count ? ranking.slice(0, count) : ranking;
    const text = [
      count ? `My top ${top.length} ${cfg.noun} 🏝️` : `My ${word}${cfg.noun} ranking 🏝️`,
      "",
      ...top.map((id, i) => `${i + 1}. ${cfg.line(byId.get(id))}`),
      "",
      "survivordle.com/rank",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(count);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  }

  async function shareImage(count) {
    setBusy(count);
    try {
      const ids = count ? ranking.slice(0, count) : ranking;
      const title = count ? `My Top ${ids.length}` : blind ? "My Blind Ranking" : "My Ranking";
      const light = !!document.querySelector(".light");
      const blob = await renderRankImage(ids, byId, { title, subtitle: cfg.noun, light });
      await shareOrDownloadImage(blob, count ? `survivor-${kind}-top-${ids.length}.png` : `survivor-${kind}-${word ? "blind-" : ""}ranking.png`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="rk-h2">Share</div>
      <div className="rk-row">
        {sizes.map(c => (
          <button key={c} className="rk-btn" onClick={() => share(c)}>
            {copied === c ? "Copied!" : c ? `Copy top ${c}` : sizes.length > 1 ? "Copy full ranking" : "Copy ranking"}
          </button>
        ))}
      </div>
      <div className="rk-row">
        {sizes.map(c => (
          <button key={c} className="rk-btn" disabled={busy !== null} onClick={() => shareImage(c)}>
            {busy === c ? "Making image…" : c ? `Image: top ${c}` : sizes.length > 1 ? "Image: full ranking" : "Image"}
          </button>
        ))}
      </div>
    </>
  );
}
