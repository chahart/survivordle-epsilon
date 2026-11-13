import { useMemo, useRef, useState } from "react";
import { TIER_COLORS, defaultTiers, placeItem, unplacedOf, loadTiers, saveTiers, inkOn } from "../shared/rankTiers";
import { barColors, moveItem } from "../shared/rank";
import { renderTierImage, shareOrDownloadImage } from "../shared/rankImage";
import { CardBody } from "./RankParts";

// Tier list for any rankable board (winners, seasons, a season's players).
// Tap a name then a tier (works everywhere), or drag with a mouse. "Quick place"
// deals the unplaced ones one at a time. Saved locally; not sent to the consensus.

const MAX_TIERS = 10;
const tagOf = w => (w.card ? "" : w.winner !== undefined ? `${w.season}` : `S${w.season}`);
const nameOf = t => t.name.trim() || "?";

// One big colored button per tier (quick place, and the dock shown while a name is selected).
function TierButtons({ tiers, onPick }) {
  return (
    <div className="rk-tbtns">
      {tiers.map(t => (
        <button key={t.id} style={{ background: t.color, color: inkOn(t.color) }} onClick={() => onPick(t.id)}>
          {nameOf(t)}
        </button>
      ))}
    </div>
  );
}

export default function RankTiers({ kind, cfg, items, byId, navigate, base }) {
  const ids = useMemo(() => items.map(w => w.id), [items]);
  const [tiers, setTiers] = useState(() => loadTiers(kind));
  const [view, setView] = useState("board"); // "board" | "quick" | "edit"
  const [sel, setSel] = useState(null);       // id picked up by a tap
  const [landed, setLanded] = useState(null); // id that just moved (gets the landing animation)
  const [drag, setDrag] = useState(null);     // { id, x, y, over } while a mouse drag is in flight
  const [skipped, setSkipped] = useState([]);
  const [busy, setBusy] = useState(false);
  const dragged = useRef(false);

  const update = next => { saveTiers(kind, next); setTiers(next); };
  const place = (id, tierId, beforeId) => {
    update(placeItem(tiers, id, tierId, beforeId));
    setLanded(id);
    setSel(null);
  };
  const setTier = (id, patch) => update(tiers.map(t => (t.id === id ? { ...t, ...patch } : t)));

  const unplaced = unplacedOf(tiers, ids);
  const placedCount = ids.length - unplaced.length;
  const queue = [...unplaced.filter(id => !skipped.includes(id)), ...unplaced.filter(id => skipped.includes(id))];
  const cur = byId.get(queue[0]);
  const mode = view === "quick" && !cur ? "board" : view;

  // A click follows a mouse drag (on the common ancestor); swallow it once.
  const wasDrag = () => {
    const d = dragged.current;
    dragged.current = false;
    return d;
  };

  // Mouse / pen drag. Touch uses tap-to-place instead, so swiping over names still scrolls the page.
  function onDown(e, id) {
    dragged.current = false;
    if (e.pointerType === "touch" || e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    let on = false;
    const move = ev => {
      if (!on && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      on = true;
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-tier]")?.dataset.tier;
      setDrag({ id, x: ev.clientX, y: ev.clientY, over });
    };
    const up = ev => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!on) return;
      dragged.current = true;
      setDrag(null);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest("[data-tier]");
      if (row) place(id, row.dataset.tier || null, el.closest("[data-id]")?.dataset.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const chip = id => {
    const w = byId.get(id);
    if (!w) return null;
    const cls = `rk-tchip${sel === id ? " sel" : ""}${landed === id ? " land" : ""}${drag?.id === id ? " lifted" : ""}`;
    return (
      <button
        key={id} data-id={id} className={cls} style={{ "--c": barColors(w)[0] }} aria-pressed={sel === id}
        onPointerDown={e => onDown(e, id)}
        onClick={e => { e.stopPropagation(); if (!wasDrag()) setSel(sel === id ? null : id); }}
      >
        {w.name}{tagOf(w) && <small>{tagOf(w)}</small>}
      </button>
    );
  };

  async function share() {
    setBusy(true);
    try {
      const light = !!document.querySelector(".light");
      const blob = await renderTierImage(tiers, byId, { title: "My Tier List", subtitle: cfg.noun, light });
      await shareOrDownloadImage(blob, `survivor-${kind}-tier-list.png`);
    } finally {
      setBusy(false);
    }
  }

  const back = <button className="rk-link" onClick={() => (mode === "board" ? navigate(base) : setView("board"))}>← {mode === "board" ? "Back" : "Back to my tier list"}</button>;

  if (mode === "quick") {
    return (
      <>
        {back}
        <h1>Quick Place</h1>
        <div className="rk-sub">Pick a tier for each one. {unplaced.length} left.</div>
        <div key={cur.id} className="rk-pick rk-static rk-deal"><CardBody w={cur} /></div>
        <TierButtons tiers={tiers} onPick={t => place(cur.id, t)} />
        <div className="rk-row">
          <button className="rk-btn" onClick={() => setSkipped([...skipped.filter(x => x !== cur.id), cur.id])}>Skip</button>
          <button className="rk-btn" onClick={() => setView("board")}>Done</button>
        </div>
      </>
    );
  }

  if (mode === "edit") {
    return (
      <>
        {back}
        <h1>Edit Tiers</h1>
        <div className="rk-sub">Rename, recolor, reorder or remove. Removing a tier sends its names back to unplaced.</div>
        {tiers.map((t, i) => (
          <div key={t.id} className="rk-tedit" style={{ "--c": t.color }}>
            <input
              value={t.name} maxLength={12} aria-label="Tier name"
              onChange={e => setTier(t.id, { name: e.target.value })}
              onBlur={e => setTier(t.id, { name: e.target.value.trim() })}
            />
            <div className="sw">
              {TIER_COLORS.map(c => (
                <button key={c} className={c === t.color ? "on" : ""} style={{ background: c }} aria-label={`Use color ${c}`} onClick={() => setTier(t.id, { color: c })} />
              ))}
              <input type="color" value={t.color} aria-label="Custom color" onChange={e => setTier(t.id, { color: e.target.value })} />
            </div>
            <span className="mv">
              <button className="rk-btn small" disabled={i === 0} aria-label="Move tier up" onClick={() => update(moveItem(tiers, i, i - 1))}>↑</button>
              <button className="rk-btn small" disabled={i === tiers.length - 1} aria-label="Move tier down" onClick={() => update(moveItem(tiers, i, i + 1))}>↓</button>
              <button className="rk-btn small" disabled={tiers.length === 1} aria-label="Remove tier" onClick={() => update(tiers.filter(x => x.id !== t.id))}>✕</button>
            </span>
          </div>
        ))}
        <div className="rk-row">
          <button
            className="rk-btn" disabled={tiers.length >= MAX_TIERS}
            onClick={() => update([...tiers, { id: `t${Date.now().toString(36)}`, name: "New", color: TIER_COLORS[tiers.length % TIER_COLORS.length], items: [] }])}
          >+ Add tier</button>
          <button className="rk-btn" onClick={() => { if (window.confirm("Reset to S–F? This also clears your tier list.")) update(defaultTiers()); }}>Reset</button>
          <button className="rk-btn primary" onClick={() => setView("board")}>Done</button>
        </div>
      </>
    );
  }

  const selItem = byId.get(sel);
  return (
    <>
      {back}
      <h1>Tier List</h1>
      <div className="rk-sub">Tap a name, then tap a tier. With a mouse you can also drag.</div>
      <div className="rk-row">
        {unplaced.length > 0 && <button className={`rk-btn${placedCount ? "" : " primary"}`} onClick={() => { setSel(null); setView("quick"); }}>Quick place</button>}
        <button className="rk-btn" onClick={() => { setSel(null); setView("edit"); }}>Edit tiers</button>
      </div>

      <div className={`rk-tiers${sel || drag ? " aiming" : ""}`}>
        {tiers.map(t => (
          <div key={t.id} data-tier={t.id} className={`rk-tier${drag?.over === t.id ? " over" : ""}`} onClick={() => { if (!wasDrag() && sel) place(sel, t.id); }}>
            <button className="lab" style={{ background: t.color, color: inkOn(t.color) }} aria-label={`Tier ${nameOf(t)}${sel ? ": place here" : ""}`}>{nameOf(t)}</button>
            <div className="its">{t.items.map(chip)}</div>
          </div>
        ))}
      </div>

      <div className="rk-label">Unplaced · {unplaced.length}</div>
      <div data-tier="" className={`rk-tray${drag?.over === "" ? " over" : ""}`} onClick={() => { if (!wasDrag() && sel) place(sel, null); }}>
        {unplaced.length ? unplaced.map(chip) : <div className="rk-note">Everything is placed.</div>}
      </div>

      <div className="rk-row">
        <button className="rk-btn primary" disabled={busy || !placedCount} onClick={share}>{busy ? "Making image…" : "Share image"}</button>
        <button className="rk-btn" disabled={!placedCount} onClick={() => { if (window.confirm("Clear your tier list? Your tiers stay.")) update(tiers.map(t => ({ ...t, items: [] }))); }}>Clear</button>
      </div>
      {!placedCount && <div className="rk-note">Place at least one to share. You don't have to place them all.</div>}

      {/* Fitts: while a name is picked up, the tiers come to the thumb instead of the other way round. */}
      {selItem && (
        <div className="rk-dock">
          <div className="who">{selItem.name}</div>
          <TierButtons tiers={tiers} onPick={t => place(sel, t)} />
        </div>
      )}
      {drag && <div className="rk-tchip rk-ghost" style={{ left: drag.x, top: drag.y, "--c": barColors(byId.get(drag.id))[0] }}>{byId.get(drag.id).name}</div>}
    </>
  );
}
