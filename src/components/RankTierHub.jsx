import { useMemo } from "react";
import { playersOf, bbCast, templateItems } from "../shared/rank";
import { loadTiers, unplacedOf } from "../shared/rankTiers";
import { show, rp } from "../shared/rankShow";

// Tier list menus. Every list is the same small tile (kicker, title clamped to two
// lines, progress), so "Winners" and a long cast name sit evenly, and the menu
// holds any number of lists: a scrolling strip on the front page, a grouped
// gallery at /rank/tiers.

const STRIP_MAX = 8;
const castTitle = s => (show().id === "bb" ? s.name : /^\d+$/.test(s.seasonName) ? `Season ${s.season}` : s.seasonName);

const progressOf = (kind, items) => {
  const ids = items.map(w => w.id);
  return ids.length - unplacedOf(loadTiers(kind), ids).length;
};

// Every tier list: { kind, to, kicker, title, group, total, placed }.
// templates: curated lists for this show (tierTemplates.json on Survivor; none yet on BB).
function useTierLists(lists, contestants, templates) {
  return useMemo(() => {
    const core = [
      { kind: "winners", kicker: "Every winner", title: "Winners", items: lists.winners },
      { kind: "seasons", kicker: "Every season", title: "Seasons", items: lists.seasons },
      { kind: "returnees", kicker: "Never won", title: "Best Returnees", items: lists.returnees || [] },
    ].map(b => ({ ...b, group: "Core" }));
    const themed = templates.map(t => ({
      kind: `t-${t.slug}`, to: rp(`/t/${t.slug}`), kicker: t.group || "Themed", title: t.title, group: t.group || "Themed",
      items: templateItems(t, contestants, lists.seasons),
    }));
    const casts = [...lists.seasons].reverse().map((s, i) => ({
      kind: `s${s.season}`, kicker: `${i ? "Cast" : "Newest cast"} · ${show().short}${s.season}`, title: castTitle(s), group: "Casts",
      items: show().id === "bb" ? bbCast(contestants, s.season) : playersOf(contestants, s.season),
    }));
    return [...core, ...themed, ...casts]
      .filter(b => b.items.length)
      .map(({ items, ...b }) => ({ ...b, to: b.to || rp(`/${b.kind}/tiers`), total: items.length, placed: progressOf(b.kind, items) }));
  }, [lists, contestants, templates]);
}

function Tile({ b, navigate }) {
  const done = b.placed === b.total;
  return (
    <button className="rk-tile" onClick={() => navigate(b.to)}>
      <span className="k">{b.kicker}</span>
      <span className="t">{b.title}</span>
      {b.placed > 0
        ? <span className="p"><span className="bar"><i style={{ width: `${(b.placed / b.total) * 100}%` }} /></span>{done ? "✓ Done" : `${b.placed}/${b.total}`}</span>
        : <span className="p">{b.total} to place</span>}
    </button>
  );
}

const inProgress = b => b.placed > 0 && b.placed < b.total;

// Front page: lists you've started first, then core, newest cast and templates.
export function TierStrip({ lists, contestants, templates, navigate }) {
  const all = useTierLists(lists, contestants, templates);
  const order = [
    ...all.filter(inProgress),
    ...all.filter(b => b.group !== "Casts"),
    ...all.filter(b => b.group === "Casts").slice(0, 1),
  ];
  const shown = [...new Map(order.map(b => [b.kind, b])).values()].slice(0, STRIP_MAX);
  return (
    <div className="rk-strip">
      {shown.map(b => <Tile key={b.kind} b={b} navigate={navigate} />)}
      <button className="rk-tile more" onClick={() => navigate(rp("/tiers"))}>
        <span className="t">All tier lists →</span>
        <span className="p">{all.length} lists</span>
      </button>
    </div>
  );
}

// /rank/tiers: everything, grouped. Casts are compact chips (there are 50+).
export function TierGallery({ lists, contestants, templates, navigate }) {
  const all = useTierLists(lists, contestants, templates);
  const started = all.filter(inProgress);
  const groups = [...new Set(all.map(b => b.group))].filter(g => g !== "Casts");
  const casts = all.filter(b => b.group === "Casts");
  const grid = bs => <div className="rk-tilegrid">{bs.map(b => <Tile key={b.kind} b={b} navigate={navigate} />)}</div>;
  return (
    <>
      <button className="rk-backbtn" onClick={() => navigate(rp())}>All rankings</button>
      <h1>Tier Lists</h1>
      <div className="rk-sub">Sort them from S to F. Saved on this device; share any list as an image.</div>
      {started.length > 0 && <><div className="rk-label">In progress</div>{grid(started)}</>}
      {groups.map(g => (
        <div key={g}>
          <div className="rk-label">{g}</div>
          {grid(all.filter(b => b.group === g))}
        </div>
      ))}
      <div className="rk-label">Casts</div>
      <div className="rk-chips">
        {casts.map(b => (
          <button key={b.kind} className="rk-chip" onClick={() => navigate(b.to)}>
            <b>{b.kind.slice(1)}</b> {show().id === "bb" ? "" : b.title}{b.placed > 0 && <small> · {b.placed === b.total ? "✓" : `${b.placed}/${b.total}`}</small>}
          </button>
        ))}
      </div>
    </>
  );
}
