import connectionsSchedule from "./connectionsSchedule.json";

export const CONNECTIONS_MAX_MISTAKES = 4;

function todayET() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // "YYYY-MM-DD"
}

// De-dupe by date (last entry for a given date wins — treat it as the "real"
// puzzle for that day) and sort ascending, so puzzle #1 is the earliest date
// authored regardless of any gaps between dates.
function getSortedPuzzles() {
  const byDate = new Map();
  for (const p of connectionsSchedule.puzzles) {
    if (p?.date) byDate.set(p.date, p);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Attaches a stable, date-order-based display number to a puzzle.
function withPuzzleNumber(puzzle, sortedPuzzles) {
  if (!puzzle) return null;
  const puzzleNumber = sortedPuzzles.findIndex(p => p.date === puzzle.date) + 1;
  return { ...puzzle, puzzleNumber };
}

// The live puzzle is the most recent one whose date is on or before today
// (ET) — it stays live through any gap until the next dated puzzle's date
// arrives, then flips over at midnight ET.
export function getDailyConnectionsPuzzle() {
  const sorted = getSortedPuzzles();
  const today = todayET();
  let live = null;
  for (const p of sorted) {
    if (p.date <= today) live = p;
    else break;
  }
  return withPuzzleNumber(live, sorted);
}

export function getConnectionsPuzzleByDate(date) {
  const sorted = getSortedPuzzles();
  const puzzle = sorted.find(p => p.date === date);
  return withPuzzleNumber(puzzle, sorted);
}

// All puzzles strictly before the currently-live one, newest first — what
// the Archive tab lists. If no puzzle has gone live yet, the archive is empty.
export function getPastConnectionsPuzzles() {
  const sorted = getSortedPuzzles();
  const live = getDailyConnectionsPuzzle();
  if (!live) return [];
  return sorted
    .filter(p => p.date < live.date)
    .map(p => withPuzzleNumber(p, sorted))
    .reverse();
}

export function getDisplayDateForConnections(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function shuffleTiles(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Checks a 4-item guess against the puzzle's groups.
// Returns { correct, groupIndex, oneAway } — groupIndex is the best-matching
// group either way (used for "one away" detection), null if no group shares 3+ items.
export function checkGuess(selectedItems, groups) {
  let bestGroupIndex = null;
  let bestOverlap = 0;
  groups.forEach((group, i) => {
    const overlap = group.items.filter(item => selectedItems.includes(item)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestGroupIndex = i;
    }
  });
  return {
    correct: bestOverlap === 4,
    groupIndex: bestGroupIndex,
    oneAway: bestOverlap === 3,
  };
}
