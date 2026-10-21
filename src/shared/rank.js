// Rank mode engine. Pure functions, no React / storage / network.
//
// A ranking session is { seed, order, segEnds, choices, manual }:
//   order    — winner ids in the (seeded-shuffled) order they get inserted
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
//   "w"  — cur is the better winner
//   "l"  — other is the better winner
//   "sc" — haven't seen cur's season (set cur aside)
//   "so" — haven't seen other's season (set other aside)

const BASE = 36;
const POOL = 4;

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

export function newSession(winnerIds, seed = Math.floor(Math.random() * 2 ** 31)) {
  const order = shuffledIds(winnerIds, seed);
  return { seed, order, segEnds: [order.length], choices: [], manual: null };
}

// Adds winners that appeared after the session started (new seasons) as a new
// batch, so the answers already given keep meaning the same thing.
export function syncSession(session, winnerIds) {
  const known = new Set(session.order);
  const added = winnerIds.filter(id => !known.has(id));
  if (!added.length) return session;
  const order = [...session.order, ...shuffledIds(added, session.seed)];
  const segEnds = [...(session.segEnds || [session.order.length]), order.length];
  return { ...session, order, segEnds };
}

// Rebuilds the full state from the session.
// Returns { ranked, skipped, cur, other, flip, done, votes }.
export function replay(session) {
  const { order, choices, seed } = session;
  const segEnds = session.segEnds || [order.length];
  const ranked = [];
  const skipped = [];
  const active = []; // { id, lo, hi } — lo/hi are ranked ids bounding where it can go
  let idx = 0;
  let seg = 0;
  let votes = 0;

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

  const pick = step => {
    const rand = mulberry32((seed ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0);
    const a = active[Math.floor(rand() * active.length)];
    const [lo, hi] = range(a);
    const q = Math.floor((hi - lo) / 4);
    const bandLo = lo + q;
    const bandHi = hi - 1 - q;
    const p = bandLo + Math.floor(rand() * (bandHi - bandLo + 1));
    return { a, p, flip: rand() < 0.5 };
  };

  settle();
  for (let i = 0; i < choices.length; i++) {
    if (!active.length) break;
    const { a, p } = pick(i);
    const ch = choices[i];
    if (ch === "w") { a.hi = ranked[p]; votes++; }
    else if (ch === "l") { a.lo = ranked[p]; votes++; }
    else if (ch === "sc") { active.splice(active.indexOf(a), 1); skipped.push(a.id); }
    else if (ch === "so") {
      const removed = ranked[p];
      const pred = p > 0 ? ranked[p - 1] : null;
      const succ = p < ranked.length - 1 ? ranked[p + 1] : null;
      ranked.splice(p, 1);
      skipped.push(removed);
      for (const x of active) {
        if (x.lo === removed) x.lo = pred;
        if (x.hi === removed) x.hi = succ;
      }
    }
    settle();
  }

  if (!active.length) return { ranked, skipped, cur: null, other: null, flip: false, done: true, votes };
  const { a, p, flip } = pick(choices.length);
  return { ranked, skipped, cur: a.id, other: ranked[p], flip, done: false, votes };
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

// ── Share codes: seasons in rank order, 2 base-36 chars each ──
export function encodeRanking(ids, winnersById) {
  return ids
    .map(id => winnersById.get(id))
    .filter(Boolean)
    .map(w => w.season.toString(BASE).padStart(2, "0"))
    .join("");
}

export function decodeRanking(code, winnersBySeason) {
  if (!code || code.length % 2 !== 0 || !/^[0-9a-z]+$/.test(code)) return null;
  const seen = new Set();
  const out = [];
  for (let i = 0; i < code.length; i += 2) {
    const season = parseInt(code.slice(i, i + 2), BASE);
    const w = winnersBySeason.get(season);
    if (!w || seen.has(season)) return null;
    seen.add(season);
    out.push(w.id);
  }
  return out.length ? out : null;
}

export function seasonsOf(ids, winnersById) {
  return ids.map(id => winnersById.get(id)?.season).filter(s => s != null);
}
