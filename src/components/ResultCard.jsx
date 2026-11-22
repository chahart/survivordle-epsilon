import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { getUpNext, getMoreTiles, getModeLinks } from "../shared/upNext";

const SHOW_HEX = { sv: "#e8742a", bb: "#5aaedd" };

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
  children,     // extra .rc-btn buttons after Share/Stats
}) {
  const { pathname } = useLocation();
  const next = useMemo(() => getUpNext(show, pathname), [show, pathname]);
  const tiles = useMemo(() => getMoreTiles(show, pathname), [show, pathname]);
  const modes = useMemo(() => getModeLinks(pathname), [pathname]);

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
        {children}
      </div>
      {modes.length > 0 && (
        <div className="rc-modes">
          {modes.map(([label, to]) => <Link key={to} to={to} className="rc-mode">{label}</Link>)}
        </div>
      )}
      {note && <p className="rc-note">{note}</p>}

      <MoreTiles tiles={tiles} />

      {next && (
        <Link to={next.to} className={`rc-next${next.featured ? " featured" : ""}`}>
          <span className="rc-next-label">{next.featured ? "New today" : "Still to play"}</span>
          <span className="rc-next-name">{next.name}</span>
          <span className="rc-next-blurb">{next.blurb}</span>
          <span className="rc-next-arrow" aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}

// "Keep playing" tile grid: the result cards and Rank's end screens share it.
// tiles: from getMoreTiles, optionally with extra { to, name, blurb, show, kind } entries.
export function MoreTiles({ tiles }) {
  return (
    <nav className="rc-more" aria-label="Keep playing">
      <style>{TILES_CSS}</style>
      <span className="rc-more-label">Keep playing</span>
      <div className="rc-tiles">
        {tiles.map(t => (
          <Link key={t.to} to={t.to} className={`rc-tile${t.kind ? ` ${t.kind}` : ""}${t.done ? " done" : ""}`}
            style={{ "--tile-accent": SHOW_HEX[t.show] }}>
            <span className="rc-tile-name">
              {t.kind === "rank" && <span aria-hidden="true">★ </span>}{t.name}
              {t.done && <span className="rc-tile-check" aria-label="done today">✓</span>}
            </span>
            <span className="rc-tile-blurb">{t.blurb}</span>
          </Link>
        ))}
      </div>
    </nav>
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

  .rc-modes { display: flex; justify-content: center; gap: 6px; margin-top: 10px; }
  .rc-mode {
    display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px;
    font: 600 13px 'DM Sans', sans-serif; color: var(--text2); text-decoration: none;
    border: 1px solid var(--border2); transition: color .15s, border-color .15s;
  }
  .rc-mode:hover { color: var(--text); border-color: var(--brand); }
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

const TILES_CSS = `
  .rc-more { margin-top: 20px; text-align: left; }
  .rc-more-label { display: block; margin-bottom: 8px; font: 600 10.5px 'DM Sans', sans-serif; letter-spacing: 1.4px; text-transform: uppercase; color: var(--text3); }
  .rc-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rc-tile:last-child:nth-child(odd) { grid-column: span 2; }
  .rc-tile {
    --tile-accent: var(--border2);
    display: flex; flex-direction: column; gap: 1px; min-height: 44px; padding: 10px 12px; border-radius: 10px;
    text-decoration: none; color: var(--text); background: var(--bg3);
    border: 1px solid var(--border2); border-top: 3px solid var(--tile-accent);
    transition: transform .12s var(--press-ease), border-color .15s;
  }
  .rc-tile:hover { border-color: color-mix(in srgb, var(--brand) 50%, var(--border)); border-top-color: var(--tile-accent); }
  .rc-tile:active { transform: scale(.97); }
  .rc-tile.rank, .rc-tile.switch { background: color-mix(in srgb, var(--tile-accent) 12%, var(--bg3)); }
  .rc-tile.switch .rc-tile-blurb { color: var(--tile-accent); font-weight: 600; }
  .rc-tile.done { opacity: .6; }
  .rc-tile-name  { display: flex; align-items: baseline; gap: 4px; font: 600 14px 'DM Sans', sans-serif; }
  .rc-tile-check { margin-left: auto; color: #4aaa4a; font-weight: 700; }
  .rc-tile-blurb { font: 400 12px 'DM Sans', sans-serif; color: var(--text3); }

  @media (prefers-reduced-motion: reduce) { .rc-tile { transition: none; } }
`;
