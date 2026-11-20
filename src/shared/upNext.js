// Picks the one game to suggest on a result card: a Connections puzzle that
// dropped today first, then the first daily game not finished today on this
// show, then the other show's daily.
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

const GAMES = {
  sv: [
    { to: "/",            name: "Survivordle", blurb: "Guess today's castaway", done: () => finished(loadStorage(), getPuzzleNumber()) },
    { to: "/connections", name: "Connections", blurb: "Find the four groups",   done: () => connectionsDone(getDailyConnectionsPuzzle()) },
    { to: "/recall",      name: "Recall",      blurb: "Fill in the information",       done: () => !!loadBBRecallResult("recall_daily", getTodayKeyET()) },
    { to: "/sandwich",    name: "Sandwich",    blurb: "Who fits in between?",   done: () => finished(loadSandwichStorage(), getSandwichPuzzleNumber()) },
  ],
  bb: [
    { to: "/bb",          name: "Big Brotherdle", blurb: "Guess today's houseguest", done: () => finished(loadBBStorage(), getBBPuzzleNumber()) },
    { to: "/bb/recall",   name: "BB Recall",      blurb: "Fill in the information",         done: () => !!loadBBRecallResult("bb_recall_daily", getBBRecallPuzzleNumber()) },
    { to: "/bb/sandwich", name: "BB Sandwich",    blurb: "Who fits in between?",     done: () => finished(loadBBSandwichStorage(), getBBSandwichPuzzleNumber()) },
  ],
};

// show: "sv" | "bb"; currentPath: the page the card is on (never suggested).
// Returns { to, name, blurb, featured? } or null when everything is done.
export function getUpNext(show, currentPath) {
  const conn = getDailyConnectionsPuzzle();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  if (conn?.date === today && currentPath !== "/connections" && !connectionsDone(conn)) {
    return { to: "/connections", name: "New Connections puzzle", blurb: conn.title, featured: true };
  }
  const other = show === "bb" ? "sv" : "bb";
  return [...GAMES[show], GAMES[other][0]].find(g => g.to !== currentPath && !g.done()) || null;
}
