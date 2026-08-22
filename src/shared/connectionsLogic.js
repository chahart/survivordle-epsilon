import connectionsSchedule from "./connectionsSchedule.json";

export const CONNECTIONS_MAX_MISTAKES = 4;

// Fixed start date — must match startDate in connectionsSchedule.json
const [CY, CM, CD] = connectionsSchedule.startDate.split("-").map(Number);
export const CONNECTIONS_START_DATE = new Date(CY, CM - 1, CD);

export function getConnectionsWeekNumber() {
  const etDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [y, m, d] = etDateStr.split("-").map(Number);
  const todayUTC = Date.UTC(y, m - 1, d);
  const startUTC = Date.UTC(CY, CM - 1, CD);
  const daysSinceStart = Math.floor((todayUTC - startUTC) / 86400000);
  return Math.floor(daysSinceStart / 7) + 1;
}

export function getConnectionsPuzzleForWeek(weekNum) {
  const idx = (weekNum - 1) % connectionsSchedule.puzzles.length;
  return connectionsSchedule.puzzles[idx];
}

export function getDailyConnectionsPuzzle() {
  return getConnectionsPuzzleForWeek(getConnectionsWeekNumber());
}

export function getDateRangeForConnectionsWeek(weekNum) {
  const start = new Date(CONNECTIONS_START_DATE);
  start.setDate(CONNECTIONS_START_DATE.getDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
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
