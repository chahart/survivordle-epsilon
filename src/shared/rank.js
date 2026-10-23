// Rank mode engine. Pure functions, no React / storage / network.
//
// A ranking session is { seed, order, segEnds, choices, manual }:
//   order    — item ids (winners or seasons) in the (seeded-shuffled) order they get inserted
//   excluded — ids the user chose not to rank (seasons not watched)
//   segEnds  — index in `order` where each batch ends (a new batch is added when
//              new winners appear after a data update, so old answers stay valid)
//   choices  — the user's answers so far, replayed to rebuild the state
// Replaying makes undo / resume trivial: undo pops a choice and the state is
// rebuilt. Everything "random" below is derived from `seed` + the step number,
// so a replay always produces exactly the same matchups.
//
// Winners are binary-inserted into the best-first `ranked` list (~n·log2(n)
// votes, ~200 for 50 winners, instead of n(n-1)/2 = 1,225). To keep it from
// feeling repetitive, up to POOL winners are "in flight" at once and each step
// picks one of them at random, compared against a random winner from the middle
// of its remaining range (any pivot is valid; the middle band keeps votes low).
//
// Choice codes (about the current matchup: `cur` vs `other`):
//   "w" — cur is the better one
//   "l" — other is the better one
//   "?" — "I don't know": show a different pair instead. If every pair that
//         could still move this item is marked "?", the engine picks one
//         (seeded coin flip) so the ranking can always finish.

const POOL = 4;
const BAND = 0.4; // pivot is drawn from the middle (1 - 2·BAND) of the range; 0.4 is within ~2% of optimal votes

export function winnersOf(contestants) {
  const bySeason = new Map();
  for (const c of contestants || []) {
    if (c.placement === 1 && !bySeason.has(c.season)) bySeason.set(c.season, c);
  }
  return [...bySeason.values()].sort((a, b) => a.season - b.season);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledIds(ids, seed) {
  const rand = mulberry32(seed);
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// allIds: every item of this kind; selectedIds: the ones the user will rank.
export function newSession(allIds, selectedIds = allIds, seed = Math.floor(Math.random() * 2 ** 31)) {
  const order = shuffledIds(selectedIds, seed);
  const picked = new Set(selectedIds);
  return { seed, order, segEnds: [order.length], excluded: allIds.filter(id => !picked.has(id)), choices: [], manual: null };
}

// Adds items that appeared after the session started (new seasons) as a new
// batch, so the answers already given keep meaning the same thing.
export function syncSession(session, winnerIds) {
  const known = new Set([...session.order, ...(session.excluded || [])]);
  const added = winnerIds.filter(id => !known.has(id));
  if (!added.length) return session;
  const order = [...session.order, ...shuffledIds(added, session.seed)];
  const segEnds = [...(session.segEnds || [session.order.length]), order.length];
  return { ...session, order, segEnds };
}

// Rebuilds the full state from the session.
// Returns { ranked, cur, other, flip, done }.
export function replay(session) {
  const { order, choices, seed } = session;
  const segEnds = session.segEnds || [order.length];
  const ranked = [];
  const active = []; // { id, lo, hi } — lo/hi are ranked ids bounding where it can go
  const unsure = new Set(); // "curId|otherId" pairs the user said "?" to
  let idx = 0;
  let seg = 0;
  let auto = 0; // forced coin-flip resolutions so far (keeps picks deterministic)

  const range = a => [
    a.lo == null ? 0 : ranked.indexOf(a.lo) + 1,
    a.hi == null ? ranked.length : ranked.indexOf(a.hi),
  ];

  const settle = () => {
    for (;;) {
      while (active.length < POOL && idx < segEnds[seg]) {
        const id = order[idx++];
        if (ranked.length === 0) ranked.push(id);
        else active.push({ id, lo: null, hi: null });
      }
      if (!active.length && idx >= segEnds[seg] && seg < segEnds.length - 1) { seg++; continue; }
      let inserted = false;
      for (let i = 0; i < active.length; i++) {
        const [lo, hi] = range(active[i]);
        if (lo >= hi) {
          ranked.splice(lo, 0, active[i].id);
          active.splice(i, 1);
          inserted = true;
          break;
        }
      }
      if (!inserted) return;
    }
  };

  const key = (a, p) => `${a.id}|${ranked[p]}`;

  // Random matchup; if it was marked "?", the first unmarked pair instead.
  const pick = step => {
    const rand = mulberry32((seed ^ Math.imul(step + 1 + auto * 7919, 0x9e3779b1)) >>> 0);
    const a0 = Math.floor(rand() * active.length);
    const [lo, hi] = range(active[a0]);
    const q = Math.floor((hi - lo) * BAND);
    const bandLo = lo + q;
    const p0 = bandLo + Math.floor(rand() * (hi - 1 - q - bandLo + 1));
    const flip = rand() < 0.5;
    if (!unsure.has(key(active[a0], p0))) return { a: active[a0], p: p0, flip };
    for (let i = 0; i < active.length; i++) {
      const a = active[(a0 + i) % active.length];
      const [l, h] = range(a);
      for (let p = l; p < h; p++) if (!unsure.has(key(a, p))) return { a, p, flip };
    }
    return { a: active[a0], p: p0, flip, forced: true };
  };

  const apply = (m, ch) => {
    if (ch === "w") m.a.hi = ranked[m.p];
    else if (ch === "l") m.a.lo = ranked[m.p];
    else unsure.add(key(m.a, m.p));
    settle();
  };

  // Next matchup the user must answer, or null when done.
  const next = step => {
    while (active.length) {
      const m = pick(step);
      if (!m.forced) return m;
      apply(m, mulberry32((seed ^ Math.imul(++auto, 0x85ebca6b)) >>> 0)() < 0.5 ? "w" : "l");
    }
    return null;
  };

  settle();
  for (let i = 0; i < choices.length; i++) {
    const m = next(i);
    if (!m) break;
    apply(m, choices[i]);
  }

  const m = next(choices.length);
  if (!m) return { ranked, cur: null, other: null, flip: false, done: true };
  return { ranked, cur: m.a.id, other: ranked[m.p], flip: m.flip, done: false };
}

export function choose(session, code) {
  return { ...session, choices: [...session.choices, code], manual: null };
}

export function undo(session) {
  if (!session.choices.length) return session;
  return { ...session, choices: session.choices.slice(0, -1), manual: null };
}

// The list the user sees: their manual reorder if any, else the sorted result.
// Winners missing from a stale manual order are appended.
export function currentRanking(session) {
  const { ranked } = replay(session);
  if (!session.manual) return ranked;
  const have = new Set(ranked);
  const kept = session.manual.filter(id => have.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...ranked.filter(id => !keptSet.has(id))];
}

export function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

// Season numbers in rank order (what gets sent to the consensus).
export function seasonsOf(ids, itemsById) {
  return ids.map(id => itemsById.get(id)?.season).filter(s => s != null);
}

export const TRIBE_HEX = {
  "Magenta": "#c0306a", "Red": "#c0392b", "Orange": "#d9822b", "Yellow/Gold": "#d4a72c",
  "Purple": "#7d4fb0", "Blue/Teal": "#2a8fa8", "Green": "#3d8f4f", "Brown": "#8a6040",
};

// Accent colors for an item, top to bottom: a winner's own tribe, or a season's
// starting tribes with the winner's tribe first.
export const barColors = w => (w.tribes || [w.tribe_color]).map(t => TRIBE_HEX[t] || "#888");

// Seasons as rankable items, shaped like winners so the UI treats both alike.
export function seasonItems(contestants) {
  const bySeason = new Map();
  for (const c of contestants || []) {
    const e = bySeason.get(c.season) || { season: c.season, name: c.seasonName, seasonName: c.seasonName, winner: null, winnerColor: null, colors: new Map() };
    e.colors.set(c.startingTribe, c.tribe_color);
    if (c.placement === 1) { e.winner = c.name; e.winnerColor = c.tribe_color; }
    bySeason.set(c.season, e);
  }
  return [...bySeason.values()].sort((a, b) => a.season - b.season).map(e => ({
    id: `S${e.season}`, season: e.season, name: e.name, seasonName: e.seasonName, winner: e.winner,
    tribes: [e.winnerColor, ...[...e.colors.values()].filter(c => c !== e.winnerColor)].filter(Boolean),
    sub: `Season ${e.season}`, // winner stays off boards and shares; only matchup cards show it
  }));
}

export const subOf = w => w.sub || `S${w.season} · ${w.seasonName}`;
