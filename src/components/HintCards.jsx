// Hints for Survivordle / Big Brotherdle (new look). Few players use them, so
// they sit behind one small button; each card turns into its answer in place.
import { useState, useEffect } from "react";
import { hintOutcome } from "../shared/hintOutcome";

export default function HintCards({ answer, bb, hintEpisode, hintNeighbors, onHintEpisode, onHintNeighbors, onGiveUp }) {
  const used = (hintEpisode ? 1 : 0) + (hintNeighbors ? 1 : 0);
  const [open, setOpen] = useState(used > 0);
  const [confirming, setConfirming] = useState(false); // Give up takes two taps
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);
  const { tierLabel, outcomeText } = hintOutcome(answer, bb);
  const between = [answer.placedAfter, answer.placedBefore].filter(Boolean);
  const cards = [
    { key: "outcome", label: "Outcome", revealed: hintEpisode, onReveal: onHintEpisode,
      main: tierLabel, sub: outcomeText },
    { key: "between", label: bb ? "Evicted between" : "Voted out between", revealed: hintNeighbors, onReveal: onHintNeighbors,
      main: between.length ? between.join(" → ") : "No data" },
  ];

  return (
    <section className="hc" aria-label="Hints">
      <style>{HC_CSS}</style>
      <div className="hc-head">
        <button className={`hc-toggle${open ? " open" : ""}`} onClick={() => setOpen(o => !o)}
          aria-expanded={open} aria-controls="hc-grid">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
          </svg>
          Hints{used > 0 && <span className="hc-count">{used}/2</span>}
        </button>
        {onGiveUp && (
          <button className={`hc-giveup${confirming ? " confirm" : ""}`} aria-live="polite"
            onClick={() => confirming ? onGiveUp() : setConfirming(true)}>
            {confirming ? "Are you sure?" : "Give up"}
          </button>
        )}
      </div>
      {open && <div className="hc-grid" id="hc-grid">
        {cards.map(c => c.revealed ? (
          <div key={c.key} className="hc-card revealed" aria-live="polite">
            <span className="hc-label">{c.label}</span>
            <span className="hc-main">{c.main}</span>
            {c.sub && <span className="hc-sub">{c.sub}</span>}
          </div>
        ) : (
          <button key={c.key} className="hc-card" onClick={c.onReveal}>
            <span className="hc-label">{c.label}</span>
            <span className="hc-reveal">Tap to reveal</span>
          </button>
        ))}
      </div>}
    </section>
  );
}

const HC_CSS = `
  .hc { margin: 0 0 16px; }
  .hc-head { display: flex; align-items: center; justify-content: center; gap: 4px; }
  .hc-toggle {
    display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: 999px; cursor: pointer;
    font: 600 13px 'DM Sans', sans-serif; color: var(--text2);
    background: var(--bg2); border: 1px solid var(--border2); transition: color .15s, border-color .15s;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  .hc-toggle:hover, .hc-toggle.open { color: var(--brand); border-color: color-mix(in srgb, var(--brand) 50%, var(--border2)); }
  .hc-toggle:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .hc-count { font-size: 11.5px; color: var(--text3); }
  .hc-giveup {
    min-height: 32px; padding: 0 12px; border-radius: 8px; cursor: pointer;
    font: 500 12.5px 'DM Sans', sans-serif; color: var(--text3);
    background: none; border: 1px solid transparent; transition: color .15s, border-color .15s;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  .hc-giveup.confirm { color: #e05040; border-color: color-mix(in srgb, #e05040 50%, transparent); font-weight: 600; }
  .hc-giveup:hover { color: #e05040; border-color: color-mix(in srgb, #e05040 40%, transparent); }

  .hc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; animation: hc-in .2s var(--press-ease) both; }
  .hc-card {
    display: flex; flex-direction: column; justify-content: center; gap: 3px; min-height: 64px;
    padding: 10px 12px; border-radius: 12px; text-align: left; color: var(--text);
    font-family: 'DM Sans', sans-serif; background: var(--bg2); border: 1px dashed var(--border);
  }
  button.hc-card {
    cursor: pointer; transition: transform .12s var(--press-ease), border-color .15s, background .15s;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  button.hc-card:hover { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 6%, var(--bg2)); }
  button.hc-card:active { transform: scale(.97); }
  button.hc-card:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .hc-card.revealed {
    border: 1px solid color-mix(in srgb, var(--brand) 35%, var(--border2));
    background: color-mix(in srgb, var(--brand) 9%, var(--bg2));
    animation: hc-in .25s var(--press-ease) both;
  }
  .hc-label  { font-size: 10.5px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text3); }
  .hc-card.revealed .hc-label { color: var(--brand); }
  .hc-reveal { font-size: 14px; font-weight: 600; color: var(--brand); }
  .hc-main   { font-size: 15px; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
  .hc-sub    { font-size: 12.5px; line-height: 1.3; color: var(--text2); }
  @keyframes hc-in { from { opacity: 0; transform: scale(.97); } }
  @media (prefers-reduced-motion: reduce) { .hc-grid, .hc-card, .hc-giveup, .hc-toggle { animation: none; transition: none; } }
`;
