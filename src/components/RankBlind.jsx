import { useEffect, useState } from "react";
import { shuffledIds } from "../shared/rank";
import { Bar, CardBody, RankList, ShareButtons, WinnerLine } from "./RankParts";

// Blind ranking: items appear one at a time (a face-down card flips to reveal each),
// you tap a spot for it, Continue locks it, and the last one is forced into the
// only spot left. Not saved and not sent to the consensus (random, forced picks).

const rand = () => Math.floor(Math.random() * 2 ** 31);

// Face-down card that flips over to reveal the season / winner.
function FlipCard({ w, onRevealed }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOpen(true), 100);
    const t2 = setTimeout(() => onRevealed(true), 650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [w.id, onRevealed]);

  return (
    <div className="rk-flip">
      <div className={`rk-flip-in${open ? " open" : ""}`}>
        <div className="rk-pick rk-static rk-back">?</div>
        <div className="rk-pick rk-static front"><CardBody w={w} /></div>
      </div>
    </div>
  );
}

function Game({ kind, cfg, items, byId, n, navigate, base, onAgain }) {
  const [picks] = useState(() => shuffledIds(items.map(w => w.id), rand()).slice(0, n).map(id => byId.get(id)));
  const [locked, setLocked] = useState(() => Array(picks.length).fill(null));
  const [i, setI] = useState(0);
  const [tent, setTent] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const cur = picks[i];
  const empties = locked.flatMap((id, k) => (id ? [] : [k]));
  const forced = empties.length === 1;
  const slot = forced ? empties[0] : tent;

  function next() {
    setLocked(l => l.map((id, k) => (k === slot ? cur.id : id)));
    setI(i + 1);
    setTent(null);
    setRevealed(false);
  }

  if (!cur) {
    return (
      <>
        <h1>Your Blind Ranking</h1>
        <RankList ids={locked} byId={byId} />
        <ShareButtons ranking={locked} byId={byId} cfg={cfg} kind={kind} blind />
        <div className="rk-row">
          <button className="rk-btn primary" onClick={onAgain}>Play again</button>
          <button className="rk-btn" onClick={() => navigate(base)}>Back</button>
        </div>
      </>
    );
  }

  return (
    <>
      <button className="rk-link" onClick={() => navigate(base)}>← Quit</button>
      <h1>Blind Ranking</h1>
      <div className="rk-sub">Tap a spot (1 is the best), then Continue. Once you continue, it's locked.</div>
      <FlipCard key={cur.id} w={cur} onRevealed={setRevealed} />
      <ol className="rk-list" style={{ marginTop: 14 }}>
        {locked.map((id, k) => {
          const isTent = revealed && !id && slot === k; // not before the spin ends, or the last one would spoil early
          const w = id ? byId.get(id) : isTent ? cur : null;
          return (
            <li key={k} className={`rk-item${isTent ? " rk-tent" : ""}`}>
              {w && <Bar w={w} />}
              <span className="pos">{k + 1}</span>
              {w
                ? <WinnerLine w={w} />
                : <button className="rk-slot" disabled={!revealed || forced} onClick={() => setTent(k)}>Tap to place here</button>}
            </li>
          );
        })}
      </ol>
      {forced && revealed && <div className="rk-note">Last one. It takes the only spot left.</div>}
      <div className="rk-row">
        <button className="rk-btn primary" disabled={!revealed || slot === null} onClick={next}>
          {forced ? "Finish" : "Continue"}
        </button>
      </div>
    </>
  );
}

// Remounting <Game> via `round` starts a fresh random set.
export default function RankBlind(props) {
  const [round, setRound] = useState(0);
  return <Game key={round} {...props} onAgain={() => setRound(r => r + 1)} />;
}
