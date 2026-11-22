import { Link, useLocation, useNavigate } from "react-router-dom";
import { isRankUnlocked } from "../shared/rankStorage";

// Daily / Archive / Unlimited switcher shared by every game page.
// Rank testers get the new segmented control; everyone else keeps the old
// emoji tab row (with Stats) until the new look ships.
export default function ModeTabs({
  base,         // "" (Survivordle), "/recall", "/bb", "/bb/sandwich"…
  icon,         // old-look Daily emoji
  legacy = true, // false: render nothing in the old look (pages whose old look had no tabs)
  tabs: modes,  // optional [[label, path, oldLookEmoji]] replacing Daily/Archive/Unlimited
  active,       // optional path of the lit tab, when the URL alone can't tell
  children,     // e.g. the "What is Recall?" popover
}) {
  const newLook = isRankUnlocked();
  const navigate = useNavigate();
  const path = useLocation().pathname.replace(/\/$/, "") || "/";
  if (!newLook && !legacy) return null;
  const current = active ?? path;
  const tabs = [
    ...(modes || [
      ["Daily", base || "/", icon],
      ["Archive", `${base}/archive`, "📁"],
      ["Unlimited", `${base}/unlimited`, "♾️"],
    ]),
    ...(newLook ? [] : [["Stats", `${base}/stats`, "📊"]]),
  ];

  if (!newLook) return (
    <div className="ul-tabs" style={{ position: "relative" }}>
      {tabs.map(([label, to, emoji]) => (
        <button key={to} className={`ul-tab${current === to ? " active" : ""}`} onClick={() => navigate(to)}>
          {emoji} {label}
        </button>
      ))}
      {children}
    </div>
  );

  return (
    <div className={`mode-row${tabs.length > 3 ? " many" : ""}`}>
      <style>{MODE_CSS}</style>
      <nav className="mode-tabs" aria-label="Game mode">
        {tabs.map(([label, to]) => (
          <Link key={to} to={to} className={`mode-tab${current === to ? " active" : ""}`}
            aria-current={current === to ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

const MODE_CSS = `
  /* Equal side padding keeps the bar centered with the info button pinned right. */
  .mode-row { position: relative; display: flex; justify-content: center; margin: 4px 0 20px; padding: 0 44px; }
  .mode-tabs {
    display: flex; width: 100%; max-width: 360px; gap: 2px; padding: 4px; border-radius: 12px;
    background: var(--bg2); border: 1px solid var(--border2);
    box-shadow: 0 2px 10px rgba(0, 0, 0, .18);
  }
  .mode-tab {
    flex: 1; display: flex; align-items: center; justify-content: center; min-height: 40px; border-radius: 9px;
    font: 600 14px 'DM Sans', sans-serif; color: var(--text2); text-decoration: none; white-space: nowrap;
    transition: color .15s, background .15s;
    touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  }
  .mode-tab:hover { color: var(--text); background: var(--bg3); }
  .mode-tab.active { background: var(--brand); color: #fff; box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 40%, transparent); }
  /* Four tabs (Connections): size to content and shrink text on phones so "Community" fits. */
  .mode-row.many .mode-tabs { max-width: 440px; }
  .mode-row.many .mode-tab { flex: 1 1 auto; padding: 0 8px; }
  @media (max-width: 420px) {
    .mode-row.many { padding: 0 40px; }
    .mode-row.many .mode-tab { padding: 0 6px; font-size: 12.5px; }
  }
  @media (max-width: 370px) { .mode-row.many .mode-tab { padding: 0 4px; font-size: 11.5px; } }
  .mode-tab:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

  .mode-row .recall-info-wrap { position: absolute; right: 0; top: 50%; transform: translateY(-50%); margin: 0; padding: 0; }
  .mode-row .recall-info-label { display: none; }
  .mode-row .recall-info-btn {
    width: 36px; height: 36px; justify-content: center; padding: 0; border-radius: 50%;
    font-size: 17px; border: 1px solid var(--border2); background: var(--bg2);
  }
  @media (prefers-reduced-motion: reduce) { .mode-tab { transition: none; } }
`;
