// What a result card offers next: a tile grid of the other games (checked once
// done today), plus a Connections promo while the live puzzle is unplayed.
import { getPuzzleNumber } from "./gameLogic";
import { getSandwichPuzzleNumber } from "./sandwichLogic";
import { getTodayKeyET } from "./recallLogic";
import { getDailyConnectionsPuzzle } from "./connectionsLogic";
import { getBBPuzzleNumber } from "./bbLogic";
import { getBBSandwichPuzzleNumber } from "./bbSandwichLogic";
import { getBBRecallPuzzleNumber } from "./bbRecallLogic";
import {
  loadStorage, loadSandwichStorage, loadConnectionsStorage,
  loadBBStorage, loadBBSandwichStorage, loadBBRecallResult,
} from "./storage";

const finished = (s, num) => s.puzzleNum === num && !!s.gameOver;

function connectionsDone(puzzle) {
  const s = loadConnectionsStorage();
  return s.weekNum === puzzle?.date && !!s.gameOver;
}

// Connections isn't a tile: it has its own promo (getUpNext) and is weekly.
const GAMES = {
  sv: [
    { to: "/",            name: "Survivordle", blurb: "Guess the castaway",   done: () => finished(loadStorage(), getPuzzleNumber()) },
    { to: "/recall",      name: "Recall",      blurb: "Fill in the info",     done: () => !!loadBBRecallResult("recall_daily", getTodayKeyET()) },
    { to: "/sandwich",    name: "Sandwich",    blurb: "Who fits in between?", done: () => finished(loadSandwichStorage(), getSandwichPuzzleNumber()) },
  ],
  bb: [
    { to: "/bb",          name: "Big Brotherdle", blurb: "Guess the houseguest", done: () => finished(loadBBStorage(), getBBPuzzleNumber()) },
    { to: "/bb/recall",   name: "Recall",         blurb: "Fill in the info",     done: () => !!loadBBRecallResult("bb_recall_daily", getBBRecallPuzzleNumber()) },
    { to: "/bb/sandwich", name: "Sandwich",       blurb: "Who fits in between?", done: () => finished(loadBBSandwichStorage(), getBBSandwichPuzzleNumber()) },
  ],
};

// show: "sv" | "bb"; currentPath: the page the card is on (never offered).
// Returns [{ to, name, blurb, done, show, kind? }]; kind "rank" | "switch" for styling.
export function getMoreTiles(show, currentPath) {
  const other = show === "bb" ? "sv" : "bb";
  // shortcut: Rank has no "done today" check (its storage is keyed per show via the URL); add one if Rank gets a daily goal.
  return [
    ...GAMES[show].filter(g => g.to !== currentPath).map(g => ({ ...g, done: g.done(), show })),
    { to: show === "bb" ? "/bb/rank" : "/rank", name: "Rank", blurb: "Today's matchup", done: false, kind: "rank", show },
    { ...GAMES[other][0], blurb: other === "bb" ? "Switch to Big Brother" : "Switch to Survivor", done: GAMES[other][0].done(), kind: "switch", show: other },
  ];
}

// The live Connections puzzle while it's unplayed; null otherwise or on Connections pages.
export function getUpNext(show, currentPath) {
  const conn = getDailyConnectionsPuzzle();
  if (!conn || currentPath.startsWith("/connections") || connectionsDone(conn)) return null;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return { to: "/connections", name: conn.date === today ? "New Connections puzzle" : "This week's Connections", blurb: conn.title, featured: conn.date === today };
}

// The other modes of the game the card is on, e.g. on /recall: Archive + Unlimited.
// Connections has no Unlimited and passes its own buttons, so it gets none.
export function getModeLinks(currentPath) {
  const path = currentPath.replace(/\/$/, "") || "/";
  if (path.startsWith("/connections")) return [];
  const base = path.replace(/\/?(archive|unlimited)$/, "").replace(/^\/$/, ""); // "" = Survivordle
  return [["Daily", base || "/"], ["Archive", `${base}/archive`], ["Unlimited", `${base}/unlimited`]]
    .filter(([, to]) => to !== path);
}
