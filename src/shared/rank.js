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
  if (session.mode === "sort") {
    const have = new Set(session.manual);
    return [...session.manual, ...session.order.filter(id => !have.has(id))];
  }
  const { ranked } = replay(session);
  if (!session.manual) return ranked;
  const have = new Set(ranked);
  const kept = session.manual.filter(id => have.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...ranked.filter(id => !keptSet.has(id))];
}

// Quick-sort sessions have no matchups: the user just drags the list.
export const isDone = session => session.mode === "sort" || replay(session).done;

// Switch a 1v1 session to quick sort: placed items keep their order, the rest follow in `ids` order.
export function toSortSession(session, ids) {
  const placed = currentRanking(session);
  const have = new Set(placed);
  return { ...session, mode: "sort", manual: [...placed, ...ids.filter(id => !have.has(id))] };
}

// A season's players as rankable items, best finish first. `season` holds the
// castaway number (US0009 -> 9), not the season number, because that's the key
// the shared consensus code uses. It stays put when placements get corrected.
export function playersOf(contestants, season) {
  const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10 < 4 ? n % 10 : 0]}`;
  const all = (contestants || []).filter(c => c.season === season);
  // Numbered seasons (41+) read "Survivor 42"; named ones "Survivor: One World".
  const label = /^\d+$/.test(all[0]?.seasonName) ? `Survivor ${season}` : `Survivor: ${all[0]?.seasonName}`;
  return all
    .sort((a, b) => a.placement - b.placement || a.name.localeCompare(b.name))
    .map(c => ({
      id: c.id, season: +c.castaway_id.slice(2), name: c.name, seasonName: c.seasonName,
      label, tribes: [c.tribe_color], sub: `Finished ${ord(c.placement)}`, card: label,
    }));
}

// "Best returnees to never win": everyone who played 2+ seasons without winning,
// one item per person (named as in their latest season). Keyed by castaway number
// like the cast boards, so the consensus survives data fixes. `bb` switches to Big
// Brother data (houseguest_id, stripe = best finish).
export function returneesOf(contestants, bb = false) {
  const idOf = c => (bb ? c.houseguest_id : c.castaway_id);
  const tag = bb ? "BB" : "S";
  const byPerson = new Map();
  for (const c of contestants || []) {
    if (!byPerson.has(idOf(c))) byPerson.set(idOf(c), []);
    byPerson.get(idOf(c)).push(c);
  }
  return [...byPerson.values()]
    .filter(a => a.length >= 2 && !a.some(c => c.placement === 1))
    .map(a => {
      const runs = [...a].sort((x, y) => x.season - y.season);
      const last = runs.at(-1);
      const seasons = `${tag}${runs.map(c => c.season).join(`, ${tag}`)}`;
      const best = runs.reduce((b, c) => (FINISH_ORDER.indexOf(c.juryTier) < FINISH_ORDER.indexOf(b.juryTier) ? c : b));
      return {
        id: idOf(last), season: +idOf(last).slice(2), name: last.name, seasonName: last.seasonName,
        tribes: [bb ? FINISH_HEX[best.juryTier] || "#888" : last.tribe_color], sub: `${runs.length}x · ${seasons}`, card: `Played ${runs.length}x · ${seasons}`,
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name));
}

// ---- Big Brother items (same shapes as the Survivor ones above) ----

// Stripe colors. Seasons (and winners) by era; houseguests by how far they got.
// Era bounds are the last season of each era.
export const BB_ERAS = [
  [2, "Early", "#8a6040"],
  [10, "Classic", "#3d8f4f"],
  [17, "Twist", "#7d4fb0"],
  [22, "Modern", "#d9822b"],
  [Infinity, "New", "#2a8fa8"],
];
export const bbEra = n => BB_ERAS.find(([last]) => n <= last);
const FINISH_ORDER = ["Winner", "Finalist", "Jury", "Non-Jury"];
export const FINISH_HEX = { Winner: "#d4a72c", Finalist: "#b8bcc4", Jury: "#5aaedd", "Non-Jury": "#666666" };

// { winners, seasons, returnees } for Big Brother. Seasons are keyed by number like
// Survivor's; seasonName carries the era so cards read "Season 12 · Twist era".
export function bbLists(contestants) {
  const bySeason = new Map();
  for (const c of contestants || []) {
    if (!bySeason.has(c.season)) bySeason.set(c.season, []);
    bySeason.get(c.season).push(c);
  }
  const nums = [...bySeason.keys()].sort((a, b) => a - b);
  const winners = [];
  const seasons = [];
  for (const n of nums) {
    const [, era, color] = bbEra(n);
    const w = bySeason.get(n).find(c => c.placement === 1);
    if (w) winners.push({ id: w.id, season: n, name: w.name, seasonName: `${era} era`, tribes: [color], sub: `BB${n} · ${era} era` });
    seasons.push({ id: `S${n}`, season: n, name: `Big Brother ${n}`, seasonName: `${era} era`, winner: w?.name ?? null, tribes: [color], sub: `${era} era` });
  }
  return { winners, seasons, returnees: returneesOf(contestants, true) };
}

// A Big Brother season's houseguests, best finish first, keyed by houseguest number.
export function bbCast(contestants, season) {
  const label = `Big Brother ${season}`;
  const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10 < 4 ? n % 10 : 0]}`;
  return (contestants || [])
    .filter(c => c.season === season)
    .sort((a, b) => a.placement - b.placement || a.name.localeCompare(b.name))
    .map(c => ({
      id: c.id, season: +c.houseguest_id.slice(2), name: c.name, seasonName: label,
      label, tribes: [FINISH_HEX[c.juryTier] || "#888"], sub: `Finished ${ord(c.placement)}`, card: label,
    }));
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
// Entries are Survivor tribe color names or (Big Brother) hex colors.
export const barColors = w => (w.tribes || [w.tribe_color]).map(t => TRIBE_HEX[t] || (/^#[0-9a-f]{6}$/i.test(t) ? t : "#888"));

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

// A curated tier template's items (tierTemplates.json). Each entry is a season id
// ("S12") or a contestant appearance id ("US0016_1"); unknown ids are skipped.
export function templateItems(template, contestants, seasons) {
  const sById = new Map(seasons.map(s => [s.id, s]));
  const cById = new Map((contestants || []).map(c => [c.id, c]));
  return template.items.flatMap(id => {
    if (sById.has(id)) return [sById.get(id)];
    const c = cById.get(id);
    return c ? [{ id: c.id, season: c.season, name: c.name, seasonName: c.seasonName, tribes: [c.tribe_color] }] : [];
  });
}

// ---- Consensus ----

const MIN_VOTES = 5;

// Bradley-Terry strengths from head-to-head counts [{ hi, lo, n }] ("hi" was put
// above "lo" n times). Unlike averaging positions, this accounts for who each
// item was compared against. Returns Map key -> chance (0..1) of beating an
// average item. Each item gets one virtual win and loss vs an average item so a
// handful of votes can't push anything to 0 or 1.
export function bradleyTerry(pairs, iters = 200) {
  const wins = new Map();
  const games = new Map(); // key -> Map(opponent -> games)
  const add = (a, b, n) => {
    if (!games.has(a)) games.set(a, new Map());
    games.get(a).set(b, (games.get(a).get(b) || 0) + n);
  };
  for (const { hi, lo, n } of pairs) {
    wins.set(hi, (wins.get(hi) || 0) + n);
    add(hi, lo, n);
    add(lo, hi, n);
  }
  const ids = [...games.keys()];
  if (!ids.length) return new Map();
  let p = new Map(ids.map(id => [id, 1]));
  for (let k = 0; k < iters; k++) {
    const next = new Map();
    for (const i of ids) {
      let d = 2 / (p.get(i) + 1);
      for (const [j, n] of games.get(i)) d += n / (p.get(i) + p.get(j));
      next.set(i, ((wins.get(i) || 0) + 1) / d);
    }
    p = next;
  }
  const g = Math.exp(ids.reduce((s, i) => s + Math.log(p.get(i)), 0) / ids.length);
  return new Map(ids.map(i => [i, p.get(i) / (p.get(i) + g)]));
}

// Leaderboard rows, best first. An item shows only once enough people ranked it
// (5, and at least 20% of the most-ranked item), so one early vote can't top it.
// boardRows: [{ season, votes }] where votes = rankings that include the item.
export function consensusRows(pairs, boardRows) {
  const score = bradleyTerry(pairs);
  const min = Math.max(MIN_VOTES, 0.2 * Math.max(0, ...boardRows.map(r => r.votes)));
  return boardRows
    .filter(r => r.votes >= min && score.has(r.season))
    .map(r => ({ season: r.season, votes: r.votes, score: score.get(r.season) }))
    .sort((a, b) => b.score - a.score);
}

// The consensus minus one person's ranking (so "you vs the tribe" doesn't
// compare you with yourself, which matters while there are few rankings).
export function withoutRanking(pairs, boardRows, ranking) {
  const pos = new Map(ranking.map((s, i) => [s, i]));
  const above = (a, b) => pos.has(a) && pos.has(b) && pos.get(a) < pos.get(b);
  return [
    pairs.map(p => (above(p.hi, p.lo) ? { ...p, n: p.n - 1 } : p)).filter(p => p.n > 0),
    boardRows.map(r => (pos.has(r.season) ? { ...r, votes: r.votes - 1 } : r)),
  ];
}

// How a ranking lines up with the consensus, over the items both contain.
// mine / tribe: keys (season numbers) best first. Positions are among those
// shared items. Returns null when there's too little overlap to say.
export function compareToConsensus(mine, tribe) {
  const tpos = new Map(tribe.map((s, i) => [s, i]));
  const common = mine.filter(s => tpos.has(s));
  const n = common.length;
  if (n < 5) return null;
  const theirs = [...common].sort((a, b) => tpos.get(a) - tpos.get(b));
  const theirRank = new Map(theirs.map((s, i) => [s, i + 1]));
  let sum = 0;
  let hot = null;
  let cold = null;
  common.forEach((s, i) => {
    const t = { season: s, mine: i + 1, tribe: theirRank.get(s), d: theirRank.get(s) - (i + 1) }; // d > 0: you rank it higher
    sum += Math.abs(t.d);
    if (!hot || t.d > hot.d) hot = t;
    if (!cold || t.d < cold.d) cold = t;
  });
  // Footrule distance, scaled so identical = 100 and fully reversed = 0.
  return { agreement: Math.round(100 * (1 - sum / Math.floor((n * n) / 2))), hot: hot.d > 0 ? hot : null, cold: cold.d < 0 ? cold : null, n };
}

// ---- Today's Matchup ----

export const RANK_DAILY_START = "2026-11-17"; // matchup #1; set to launch day
export const etToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // "YYYY-MM-DD", same clock as the Daily
export const dailyNumber = day => Math.round((Date.parse(day) - Date.parse(RANK_DAILY_START)) / 864e5) + 1;

// Days in a row voted, ending at matchup `num` (or the day before, if today's
// vote isn't in yet, so the streak still shows as "keep it alive").
export function streakOf(votes, num) {
  const end = votes[num] != null ? num : num - 1;
  let n = 0;
  while (votes[end - n] != null) n++;
  return n;
}

// Same pair for everyone on a given day; alternates seasons / winners.
// shortcut: the pick depends on list length, so the day a new season is added the
// schedule reshuffles; add a hand-made override list if that ever matters.
export function dailyMatchup(day, lists) {
  const num = dailyNumber(day);
  const kind = num % 2 ? "seasons" : "winners";
  const items = lists[kind];
  if (items.length < 2) return null;
  const rand = mulberry32(Math.imul(num, 0x9e3779b1) >>> 0);
  const a = Math.floor(rand() * items.length);
  const b = (a + 1 + Math.floor(rand() * (items.length - 1))) % items.length;
  return { num, kind, a: items[a], b: items[b] };
}
