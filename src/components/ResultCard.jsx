import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { getUpNext } from "../shared/upNext";

// End-of-game card for the daily-style boards. Shown only to visitors who
// unlocked Rank (the boards fall back to the old banner otherwise).
export default function ResultCard({
  show,         // "sv" | "bb"
  won, gaveUp,
  label,        // "Survivordle #142", "Sandwich #12", "Unlimited"…
  guessCount,
  lossTitle,    // "Voted out" | "Evicted"
  name, sub,
  onShare, copied, onStats,
  note,         // optional small line under the actions
  title: customTitle, meta: customMeta, accent, // Recall: grade headline + grade color
}) {
  const { pathname } = useLocation();
  const next = useMemo(() => getUpNext(show, pathname), [show, pathname]);

  const title = customTitle ?? (won ? "You win!" : gaveUp ? "Better luck next time" : lossTitle);
  const meta  = customMeta ?? (won
    ? `Solved in ${guessCount} ${guessCount === 1 ? "guess" : "guesses"} · ${label}`
    : `${gaveUp ? "You gave up" : "Out of guesses"} · ${label}`);

  return (
    <section className={`rc ${won ? "win" : "lose"}`} aria-live="polite"
      style={accent ? { "--rc-accent": accent, "--rc-ink": accent } : undefined}>
      <style>{RC_CSS}</style>
      <h2 className="rc-title">{title}</h2>
      <p className="rc-meta">{meta}</p>

      {name ? (
        <div className="rc-answer">
          {!won && <span className="rc-kicker">The answer was</span>}
          <span className="rc-name">{name}</span>
          <span className="rc-sub">{sub}</span>
        </div>
      ) : <div className="rc-gap" />}

      <div className="rc-actions">
        {onShare && (
          <button className="rc-btn primary" onClick={onShare}>{copied ? "Copied" : "Share result"}</button>
        )}
        {onStats && <button className="rc-btn" onClick={onStats}>Stats</button>}
      </div>
      {note && <p className="rc-note">{note}</p>}

      {next && (
        <Link to={next.to} className={`rc-next${next.featured ? " featured" : ""}`}>
          <span className="rc-next-label">{next.featured ? "New today" : "Up next"}</span>
          <span className="rc-next-name">{next.name}</span>
          <span className="rc-next-blurb">{next.blurb}</span>
          <span className="rc-next-arrow" aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}

const RC_CSS = `
  .rc {
    --rc-accent: #4aaa4a; --rc-ink: #7fd67f;
    position: relative; overflow: hidden; text-align: center;
    margin: 22px 0; padding: 24px 20px 18px; border-radius: 14px;
    background:
      radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--rc-accent) 22%, transparent), transparent 70%),
      var(--bg2);
    border: 1px solid color-mix(in srgb, var(--rc-accent) 40%, var(--border2));
    animation: rc-in .24s var(--press-ease) both;
  }
  .rc.lose { --rc-accent: #c0504a; --rc-ink: #ec8a84; }
  .light .rc { --rc-ink: #2e8a2e; }
  .light .rc.lose { --rc-ink: #b23b35; }
  .rc::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--rc-accent); }
  @keyframes rc-in { from { opacity: 0; transform: translateY(6px); } }

  .rc-title { margin: 0; font: 400 38px/1 'Bebas Neue', sans-serif; letter-spacing: 2px; color: var(--rc-ink); }
  .rc-score { display: inline-flex; align-items: center; gap: 14px; font-size: 52px; }
  .rc-of    { font-size: .5em; color: var(--text3); margin-left: 2px; }
  .rc-grade {
    font-size: .62em; line-height: 1; padding: 6px 12px 3px; border-radius: 10px;
    color: var(--rc-ink); background: color-mix(in srgb, var(--rc-accent) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--rc-accent) 45%, transparent);
  }
  .rc-meta  { margin: 6px 0 0; font: 500 13px 'DM Sans', sans-serif; color: var(--text2); }

  .rc-answer {
    display: flex; flex-direction: column; gap: 2px; margin: 16px 0 18px; padding: 14px 12px; border-radius: 12px;
    background: color-mix(in srgb, var(--rc-accent) 10%, var(--bg3));
    border: 1px solid color-mix(in srgb, var(--rc-accent) 25%, transparent);
  }
  .rc-gap { height: 16px; }
  .rc-kicker { font: 600 11px 'DM Sans', sans-serif; letter-spacing: 1.4px; text-transform: uppercase; color: var(--text3); }
  .rc-name   { font: 700 20px 'DM Sans', sans-serif; color: var(--text); }
  .rc-sub    { font: 400 13px 'DM Sans', sans-serif; color: var(--text3); }

  .rc-actions { display: flex; gap: 8px; justify-content: center; }
  .rc-btn {
    min-height: 44px; padding: 0 20px; border-radius: 10px; cursor: pointer;
    font: 600 14px 'DM Sans', sans-serif; color: var(--text);
    background: transparent; border: 1px solid var(--border);
    transition: transform .12s var(--press-ease), background .15s;
  }
  .rc-btn:hover { background: var(--bg3); }
  .rc-btn:active { transform: scale(.96); }
  .rc-btn.primary { flex: 0 1 200px; background: var(--brand); color: #fff; border-color: var(--brand); box-shadow: 0 4px 14px color-mix(in srgb, var(--brand) 35%, transparent); }
  .rc-btn.primary:hover { background: var(--brand); filter: brightness(1.08); }
  .rc-note { margin: 12px 0 0; font: 400 13px 'DM Sans', sans-serif; color: var(--text3); }

  .rc-next {
    position: relative; display: grid; grid-template-columns: 1fr auto; text-align: left;
    margin-top: 16px; padding: 12px 14px; border-radius: 12px; text-decoration: none;
    background: var(--bg3); border: 1px solid var(--border2); border-left: 3px solid var(--brand); color: var(--text);
    transition: transform .12s var(--press-ease), border-color .15s;
  }
  .rc-next:hover { border-color: color-mix(in srgb, var(--brand) 50%, var(--border)); border-left-color: var(--brand); }
  .rc-next:hover .rc-next-arrow { color: var(--brand); }
  .rc-next:active { transform: scale(.98); }
  .rc-next.featured { border-color: color-mix(in srgb, var(--brand) 55%, transparent); background: color-mix(in srgb, var(--brand) 12%, var(--bg3)); }
  .rc-next-label { grid-column: 1; font: 600 10.5px 'DM Sans', sans-serif; letter-spacing: 1.4px; text-transform: uppercase; color: var(--text3); }
  .rc-next.featured .rc-next-label { color: var(--brand); }
  .rc-next-name  { grid-column: 1; font: 600 15px 'DM Sans', sans-serif; margin-top: 2px; }
  .rc-next-blurb { grid-column: 1; font: 400 12.5px 'DM Sans', sans-serif; color: var(--text3); }
  .rc-next-arrow { grid-column: 2; grid-row: 1 / span 3; align-self: center; font-size: 18px; color: var(--text3); }

  @media (prefers-reduced-motion: reduce) { .rc, .rc-btn, .rc-next { animation: none; transition: none; } }
`;
