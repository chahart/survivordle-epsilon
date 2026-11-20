// Self-check for the consensus math and the daily schedule. Run: node src/shared/rank.check.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TIER_COLORS, inkOn, isSTier, defaultTiers } from "./rankTiers.js";
import { setShow, rp, show, otherShowPath } from "./rankShow.js";
import { bradleyTerry, consensusRows, compareToConsensus, dailyMatchup, streakOf, withoutRanking, templateItems, seasonItems, returneesOf, bbLists, bbCast, barColors } from "./rank.js";

// Pairs from rankings: every item beats everything below it.
const pairsOf = rankings => rankings.flatMap(r => r.flatMap((hi, i) => r.slice(i + 1).map(lo => ({ hi, lo, n: 1 }))));

// 1 is above 2 above 3 in every ranking, so 1 wins.
const bt = bradleyTerry(pairsOf([[1, 2, 3], [1, 3, 2], [2, 1, 3]]));
assert.ok(bt.get(1) > bt.get(2) && bt.get(2) > bt.get(3));

// Partial-ranking bias: a casual fan ranks only 3 and 4 (4 last). Everyone else has
// 4 near the top. Position averaging would sink 4; head-to-head keeps it above 5.
const many = Array.from({ length: 6 }, () => [1, 4, 2, 5, 3]);
const bt2 = bradleyTerry(pairsOf([...many, [3, 4]]));
assert.ok(bt2.get(4) > bt2.get(5));

// One voter can't top the board: below 5 votes nothing shows.
assert.equal(consensusRows(pairsOf([[9, 8]]), [{ season: 9, votes: 1 }, { season: 8, votes: 1 }]).length, 0);
const rows = consensusRows(pairsOf(many), [1, 2, 3, 4, 5].map(season => ({ season, votes: 6 })));
assert.deepEqual(rows.map(r => r.season), [1, 4, 2, 5, 3]);

// Agreement: identical = 100, reversed = 0; hot/cold takes point the right way.
assert.equal(compareToConsensus([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]).agreement, 100);
assert.equal(compareToConsensus([5, 4, 3, 2, 1], [1, 2, 3, 4, 5]).agreement, 0);
const c = compareToConsensus([5, 1, 2, 3, 4], [1, 2, 3, 4, 5]);
assert.equal(c.hot.season, 5);
assert.equal(c.hot.mine, 1);
assert.equal(c.hot.tribe, 5);
assert.equal(compareToConsensus([1, 2], [1, 2]), null);

// Daily: same day, same pair; two different items; consecutive days differ.
const items = n => Array.from({ length: n }, (_, i) => ({ id: `S${i + 1}`, season: i + 1 }));
const lists = { seasons: items(50), winners: items(50) };
const d1 = dailyMatchup("2026-12-01", lists);
assert.deepEqual(dailyMatchup("2026-12-01", lists), d1);
assert.notEqual(d1.a.id, d1.b.id);
let prev = null;
for (let i = 0; i < 60; i++) {
  const m = dailyMatchup(new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10), lists);
  assert.notEqual(m.a.id, m.b.id);
  if (prev) assert.notEqual(`${m.kind}${m.a.id}${m.b.id}`, prev);
  prev = `${m.kind}${m.a.id}${m.b.id}`;
}

// Streak: counts back from today, or from yesterday if today isn't voted yet.
assert.equal(streakOf({ 3: 1, 4: 1, 5: 1 }, 5), 3);
assert.equal(streakOf({ 3: 1, 4: 1 }, 5), 2);
assert.equal(streakOf({ 2: 1, 4: 1, 5: 1 }, 5), 2);
assert.equal(streakOf({}, 5), 0);

// Removing your own ranking takes back exactly what it added.
const others = pairsOf([[1, 2, 3]]);
const board = [1, 2, 3].map(season => ({ season, votes: 1 }));
const [p2, b2] = withoutRanking([...others, ...pairsOf([[3, 2, 1]])], board.map(r => ({ ...r, votes: 2 })), [3, 2, 1]);
assert.deepEqual(p2, others);
assert.deepEqual(b2, board);

// Every id in the curated tier templates exists in the real data (catches typos).
const read = f => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const real = read("../../public/contestants.json");
for (const t of read("./tierTemplates.json")) {
  assert.match(t.slug, /^[a-z0-9-]{1,40}$/, `bad slug ${t.slug}`); // must match rank_tier_lists.sql
  assert.equal(templateItems(t, real, seasonItems(real)).length, t.items.length, `unknown id in template ${t.slug}`);
}

// Returnees board: 2+ seasons, never won, one item per person, unique consensus keys.
const ret = returneesOf(real);
const winnerIds = new Set(real.filter(c => c.placement === 1).map(c => c.castaway_id));
assert.ok(ret.length >= 10);
assert.ok(ret.every(w => !winnerIds.has(w.id) && real.filter(c => c.castaway_id === w.id).length >= 2));
assert.equal(new Set(ret.map(w => w.season)).size, ret.length);

// Every default tier gets the same dark letter (the green B used to flip to white).
for (const c of TIER_COLORS) assert.equal(inkOn(c), "#1a1a1a", `ink on ${c}`);
assert.equal(inkOn("#101040"), "#ffffff"); // very dark custom colors still get white

// Big Brother: one winner per season, unique keys on every board, returnees never won.
const bbReal = read("../../public/bb_contestants.json");
const bbl = bbLists(bbReal);
const nSeasons = new Set(bbReal.map(c => c.season)).size;
assert.equal(bbl.seasons.length, nSeasons);
assert.equal(bbl.winners.length, nSeasons);
const bbWinnerIds = new Set(bbReal.filter(c => c.placement === 1).map(c => c.houseguest_id));
assert.ok(bbl.returnees.length >= 10 && bbl.returnees.every(w => !bbWinnerIds.has(w.id)));
for (const board of [bbl.winners, bbl.seasons, bbl.returnees]) assert.equal(new Set(board.map(w => w.season)).size, board.length);
for (let n = 1; n <= nSeasons; n++) {
  const cast = bbCast(bbReal, n);
  assert.ok(cast.length >= 8 && new Set(cast.map(w => w.season)).size === cast.length, `BB${n} cast keys`);
  assert.ok(cast.every(w => barColors(w)[0] !== "#888"), `BB${n} finish colors`);
}
assert.ok(bbl.seasons.every(s => barColors(s)[0] !== "#888"));

// Show switch: routes and the flame tier follow the show.
setShow("bb");
assert.equal(rp("/winners"), "/bb/rank/winners");
assert.equal(show().db, "bb_");
assert.ok(isSTier({ name: "B" }) && !isSTier({ name: "S" }));
assert.equal(defaultTiers().find(t => t.name === "B").color, "#5aaedd"); // BB's B tier is BB blue
setShow("sv");
assert.equal(rp("/winners"), "/rank/winners");
assert.ok(isSTier({ name: "S" }) && !isSTier({ name: "B" }));
assert.equal(defaultTiers().find(t => t.name === "B").color, "#4aaa4a"); // Survivor unchanged

// Show switch keeps you on the same page when the other show has it.
assert.equal(otherShowPath("/"), "/bb");
assert.equal(otherShowPath("/bb"), "/");
assert.equal(otherShowPath("/recall/archive"), "/bb/recall/archive");
assert.equal(otherShowPath("/bb/rank/winners"), "/rank/winners");
assert.equal(otherShowPath("/connections/custom"), "/bb");
assert.equal(otherShowPath("/about"), "/bb");
assert.equal(otherShowPath("/rankings"), "/bb"); // prefix lookalike isn't a pair

console.log("rank checks passed");
