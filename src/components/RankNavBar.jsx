import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { otherShowPath } from "../shared/rankShow";

// Experimental nav shown only to visitors who unlocked Rank (see App.jsx).
// Mobile first: slim top bar + one menu sheet. Desktop also gets inline links.

const SHOWS = {
  sv: {
    logo: <>SURVIVORDLE</>,
    home: "/", stats: "/stats", how: "/how-to-play", faq: "/faq", rank: "/rank",
    rankBlurb: "Tier every Survivor winner",
    games: [
      { to: "/",            end: true, name: "Daily",       blurb: "Guess today's castaway" },
      { to: "/connections", name: "Connections", blurb: "Find the four groups" },
      { to: "/recall",      name: "Recall",      blurb: "Fill in the information" },
      { to: "/sandwich",    name: "Sandwich",    blurb: "Who fits in between?" },
      { to: "/unlimited",   name: "Unlimited",   blurb: "Endless practice" },
      { to: "/archive",     name: "Archive",     blurb: "Past daily puzzles" },
    ],
  },
  bb: {
    logo: <>BIG BROTHERDLE</>,
    home: "/bb", stats: "/bb/stats", how: "/bb/how-to-play", faq: "/bb/faq", rank: "/bb/rank",
    rankBlurb: "Tier every Big Brother winner",
    games: [
      { to: "/bb",           end: true, name: "Daily",     blurb: "Guess today's houseguest" },
      { to: "/bb/recall",    name: "Recall",    blurb: "Fill in the information" },
      { to: "/bb/sandwich",  name: "Sandwich",  blurb: "Who fits in between?" },
      { to: "/bb/unlimited", name: "Unlimited", blurb: "Endless practice" },
      { to: "/bb/archive",   name: "Archive",   blurb: "Past daily puzzles" },
    ],
  },
};

export default function RankNavBar({ isBB, lightMode, onToggleLight, colorblind, onToggleColorblind }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const keepOpen = useRef(false); // switching shows from the menu keeps it open
  const s = SHOWS[isBB ? "bb" : "sv"];
  const swapTo = otherShowPath(location.pathname);

  useEffect(() => {
    if (keepOpen.current) keepOpen.current = false;
    else setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  // Sub-routes like /recall/archive keep their parent tile lit.
  const active = g => g.end ? location.pathname === g.to : location.pathname.startsWith(g.to);
  const inRank = location.pathname.startsWith(s.rank);

  return (
    <>
      <style>{RNAV_CSS}</style>
      <header className="rnav">
        <NavLink to={s.home} className="rnav-logo">{s.logo}</NavLink>

        <nav className="rnav-inline" aria-label="Games">
          {s.games.map(g => (
            <NavLink key={g.to} to={g.to} className={`rnav-inline-link${active(g) ? " on" : ""}`}>{g.name}</NavLink>
          ))}
          <NavLink to={s.rank} className={`rnav-inline-link rank${location.pathname.startsWith(s.rank) ? " on" : ""}`}>Rank</NavLink>
        </nav>

        <div className="rnav-actions">
          <NavLink to={swapTo} className={`rnav-swap ${isBB ? "to-sv" : "to-bb"}`} title={`Switch to ${isBB ? "Survivor" : "Big Brother"}`}>
            {isBB ? "Survivor" : "Big Brother"}
          </NavLink>
          <NavLink to={s.stats} className="rnav-icon rnav-stats" aria-label="Stats" title="Stats">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <rect x="2" y="9" width="3" height="7" rx="1" /><rect x="7.5" y="3" width="3" height="13" rx="1" /><rect x="13" y="6" width="3" height="10" rx="1" />
            </svg>
          </NavLink>
          <button
            className={`rnav-icon rnav-burger${open ? " x" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          ><span /><span /></button>
        </div>
      </header>

      <div className={`rnav-scrim${open ? " open" : ""}`} onClick={() => setOpen(false)} />
      {/* Any link closes the sheet, even one to the page you're on (e.g. Daily right after switching shows). */}
      <div className={`rnav-sheet${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu" inert={!open}
        onClick={e => { if (e.target.closest("a")) setOpen(false); }}>
        <div className="rnav-seg" role="tablist">
          {[false, true].map(bb => (
            <button key={bb} role="tab" aria-selected={isBB === bb} className={isBB === bb ? "on" : ""}
              onClick={() => { if (isBB !== bb) { keepOpen.current = true; navigate(swapTo); } }}>
              {bb ? "Big Brother" : "Survivor"}
            </button>
          ))}
          <span className="rnav-seg-pill" style={{ transform: `translateX(${isBB ? 100 : 0}%)` }} />
        </div>

        <NavLink to={s.rank} className={`rnav-rank${inRank ? " on" : ""}`} style={{ "--i": 0 }}>
          <span className="rnav-tag">NEW</span>
          <span className="rnav-rank-title">RANK</span>
          <span className="rnav-blurb">{s.rankBlurb}</span>
          <span className="rnav-arrow">→</span>
        </NavLink>

        <NavLink to={s.stats} className={`rnav-statcard${location.pathname === s.stats ? " on" : ""}`} style={{ "--i": 1 }}>
          <svg className="rnav-statcard-icon" width="22" height="22" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
            <rect x="2" y="9" width="3" height="7" rx="1" /><rect x="7.5" y="3" width="3" height="13" rx="1" /><rect x="13" y="6" width="3" height="10" rx="1" />
          </svg>
          <span className="rnav-statcard-text">
            <span className="rnav-tile-name">Stats</span>
            <span className="rnav-blurb">How you stack up against everyone</span>
          </span>
          <span className="rnav-statcard-arrow" aria-hidden="true">→</span>
        </NavLink>

        <div className="rnav-label">Play</div>
        <div className="rnav-grid">
          {s.games.map((g, i) => (
            <NavLink key={g.to} to={g.to} className={`rnav-tile${active(g) ? " on" : ""}`} style={{ "--i": i + 1 }}>
              <span className="rnav-tile-name">{g.name}</span>
              <span className="rnav-blurb">{g.blurb}</span>
            </NavLink>
          ))}
        </div>

        <div className="rnav-label">Settings</div>
        <div className="rnav-settings">
          <button className={`rnav-chip${colorblind ? " on" : ""}`} aria-pressed={colorblind} onClick={onToggleColorblind}>Colorblind</button>
          <button className="rnav-chip" onClick={onToggleLight}>{lightMode ? "Dark mode" : "Light mode"}</button>
          <NavLink to={s.how} className="rnav-chip">How to play</NavLink>
        </div>

        <footer className="rnav-foot">
          <NavLink to={s.faq}>FAQ</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/blog">Blog</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
        </footer>
      </div>
    </>
  );
}

const RNAV_CSS = `
  .rnav {
    position: sticky; top: 0; z-index: 60;
    display: flex; align-items: center; gap: 12px;
    height: 54px; padding: 0 16px;
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }
  .rnav-logo {
    font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 3px;
    color: var(--brand); text-decoration: none; flex-shrink: 0;
  }
  .rnav-inline { display: none; }
  .rnav-actions { margin-left: auto; display: flex; gap: 8px; }
  .rnav-icon {
    width: 40px; height: 40px; border-radius: 12px; border: 0;
    display: grid; place-items: center; font-size: 17px; text-decoration: none;
    background: var(--bg3); color: var(--text); cursor: pointer;
    transition: transform .15s var(--press-ease), background .15s;
  }
  .rnav-icon:active { transform: scale(.92); }
  .rnav-swap {
    height: 40px; padding: 0 12px; border-radius: 12px; display: flex; align-items: center;
    font: 600 12.5px 'DM Sans', sans-serif; text-decoration: none; white-space: nowrap;
    border: 1px solid; transition: transform .15s var(--press-ease), background .15s;
  }
  .rnav-swap:active { transform: scale(.94); }
  .rnav-swap.to-bb { color: #5aaedd; border-color: #5aaedd55; background: #5aaedd14; }
  .rnav-swap.to-sv { color: #e8742a; border-color: #e8742a55; background: #e8742a14; }
  @media (max-width: 419px) { .rnav-stats { display: none; } }
  @media (max-width: 379px) { .rnav-logo { font-size: 19px; letter-spacing: 2px; } .rnav { gap: 8px; } }
  .rnav-burger { position: relative; }
  .rnav-burger span {
    position: absolute; left: 12px; right: 12px; height: 2px; border-radius: 2px; background: currentColor;
    transition: transform .25s var(--press-ease);
  }
  .rnav-burger span:first-child { transform: translateY(-4px); }
  .rnav-burger span:last-child  { transform: translateY(4px); }
  .rnav-burger.x span:first-child { transform: rotate(45deg); }
  .rnav-burger.x span:last-child  { transform: rotate(-45deg); }

  .rnav-scrim {
    position: fixed; inset: 0; z-index: 58; background: rgba(0,0,0,.5);
    opacity: 0; pointer-events: none; transition: opacity .2s;
  }
  .rnav-scrim.open { opacity: 1; pointer-events: auto; }
  .rnav-sheet {
    position: fixed; z-index: 59; top: 54px; left: 0; right: 0;
    max-height: calc(100dvh - 54px); overflow-y: auto; overscroll-behavior: contain;
    padding: 16px 16px calc(20px + env(safe-area-inset-bottom));
    background: var(--bg); border-bottom: 1px solid var(--border);
    border-radius: 0 0 22px 22px; box-shadow: 0 24px 48px var(--shadow);
    transform: translateY(-12px); opacity: 0; pointer-events: none;
    transition: transform .22s var(--press-ease), opacity .18s;
  }
  .rnav-sheet.open { transform: none; opacity: 1; pointer-events: auto; }

  .rnav-seg {
    position: relative; display: grid; grid-template-columns: 1fr 1fr;
    padding: 4px; border-radius: 12px; background: var(--bg3); margin-bottom: 14px;
  }
  .rnav-seg button {
    position: relative; z-index: 1; border: 0; background: none; padding: 9px 0;
    font: 600 14px 'DM Sans', sans-serif; color: var(--text3); cursor: pointer; transition: color .2s;
  }
  .rnav-seg button.on { color: var(--text); }
  .rnav-seg-pill {
    position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 4px);
    border-radius: 9px; background: var(--bg); box-shadow: 0 1px 4px var(--shadow);
    transition: transform .25s var(--press-ease);
  }

  .rnav-rank, .rnav-tile {
    text-decoration: none; color: var(--text); display: flex; flex-direction: column;
    border-radius: 16px; background: var(--bg2); border: 1px solid var(--border2);
    transition: transform .15s var(--press-ease), border-color .15s;
  }
  .rnav-sheet.open .rnav-rank, .rnav-sheet.open .rnav-tile {
    animation: rnav-in .3s var(--press-ease) both; animation-delay: calc(var(--i) * 25ms);
  }
  @keyframes rnav-in { from { opacity: 0; transform: translateY(6px); } }
  .rnav-rank:active, .rnav-tile:active { transform: scale(.97); }
  .rnav-rank.on, .rnav-tile.on { border-color: var(--brand); }

  .rnav-rank {
    position: relative; padding: 16px 18px; margin-bottom: 18px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 22%, var(--bg2)), var(--bg2) 70%);
    border-color: color-mix(in srgb, var(--brand) 45%, transparent);
  }
  .rnav-tag {
    align-self: flex-start; font: 700 10px 'DM Sans', sans-serif; letter-spacing: 1.5px;
    padding: 3px 7px; border-radius: 6px; background: var(--brand); color: #fff; margin-bottom: 6px;
  }
  .rnav-rank-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: 3px; line-height: 1; }
  .rnav-arrow { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); font-size: 22px; color: var(--brand); }

  .rnav-statcard {
    display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin: -8px 0 18px;
    border-radius: 16px; text-decoration: none; color: var(--text);
    background: var(--bg2); border: 1px solid var(--border2);
    transition: transform .15s var(--press-ease), border-color .15s;
  }
  .rnav-sheet.open .rnav-statcard { animation: rnav-in .3s var(--press-ease) both; animation-delay: calc(var(--i) * 25ms); }
  .rnav-statcard:active { transform: scale(.97); }
  .rnav-statcard.on, .rnav-statcard:hover { border-color: color-mix(in srgb, var(--brand) 50%, var(--border2)); }
  .rnav-statcard-icon {
    flex-shrink: 0; width: 40px; height: 40px; padding: 9px; border-radius: 12px;
    color: var(--brand); background: color-mix(in srgb, var(--brand) 16%, transparent);
  }
  .rnav-statcard-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .rnav-statcard-arrow { font-size: 18px; color: var(--text3); }

  .rnav-label {
    font: 600 11px 'DM Sans', sans-serif; letter-spacing: 1.6px; text-transform: uppercase;
    color: var(--text3); margin: 0 2px 8px;
  }
  .rnav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
  .rnav-tile { padding: 12px 14px; min-height: 64px; }
  .rnav-tile-name { font: 600 15px 'DM Sans', sans-serif; }
  .rnav-blurb { font: 400 12.5px 'DM Sans', sans-serif; color: var(--text3); margin-top: 2px; }

  .rnav-settings { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
  .rnav-chip {
    border: 1px solid var(--border2); background: var(--bg2); color: var(--text2);
    border-radius: 999px; padding: 9px 14px; font: 500 13px 'DM Sans', sans-serif;
    text-decoration: none; cursor: pointer; transition: transform .15s var(--press-ease);
  }
  .rnav-chip:active { transform: scale(.95); }
  .rnav-chip.on { border-color: #4a8aff; color: #4a8aff; }

  .rnav-foot {
    display: flex; justify-content: center; gap: 18px; padding-top: 14px;
    border-top: 1px solid var(--border2);
  }
  .rnav-foot a { font: 500 12.5px 'DM Sans', sans-serif; color: var(--text3); text-decoration: none; }

  @media (min-width: 820px) {
    .rnav { padding: 0 24px; gap: 24px; }
    .rnav-inline { display: flex; gap: 4px; }
    .rnav-inline-link {
      font: 500 14px 'DM Sans', sans-serif; color: var(--text3); text-decoration: none;
      padding: 7px 11px; border-radius: 9px; transition: color .15s, background .15s;
    }
    .rnav-inline-link:hover { color: var(--text); background: var(--bg3); }
    .rnav-inline-link.on { color: var(--text); background: var(--bg3); }
    .rnav-inline-link.rank { color: var(--brand); }
    .rnav-sheet { left: auto; right: 16px; width: 400px; border-radius: 0 0 22px 22px; border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rnav *, .rnav-sheet, .rnav-sheet * { transition: none !important; animation: none !important; }
  }
`;
