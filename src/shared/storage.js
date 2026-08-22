const STORAGE_KEY = "survivordle_state";

export function loadStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

export function saveStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch {}
}

export function loadTodayGame(puzzleNum) {
  const s = loadStorage();
  // Restore completed OR in-progress game as long as it's today's puzzle
  if (s.puzzleNum === puzzleNum) return s;
  return null;
}

export function saveMidGame({ puzzleNum, guesses, results, hintEpisode, hintNeighbors }) {
  const s = loadStorage();
  // Preserve existing stats and any completed game data
  saveStorage({
    ...s,
    puzzleNum,
    guessObjects: guesses,
    resultObjects: results,
    hintEpisode,
    hintNeighbors,
    gameOver: false,
  });
}

export function saveCompletedGame({ puzzleNum, won, gaveUp, guessCount, emojiGrid }) {
  const s = loadStorage();
  const stats = s.stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.dist[guessCount] = (stats.dist[guessCount] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }
  saveStorage({ puzzleNum, won, gaveUp, guessCount, emojiGrid, gameOver: true, stats });
}

// ── Recall storage ────────────────────────────────────────────────────────────
const RECALL_UNLIMITED_KEY = "recall_unlimited_history";
const RECALL_UNLIMITED_CAP = 200;

export function loadRecallUnlimitedHistory() {
  try { return JSON.parse(localStorage.getItem(RECALL_UNLIMITED_KEY)) || []; }
  catch { return []; }
}

export function saveRecallUnlimitedGame({ puzzle, total_score, grade, season_score, placement_score, age_score, tribe_score }) {
  const history = loadRecallUnlimitedHistory();
  const pad = n => String(n).padStart(2, "0");
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  history.push({ puzzle, total_score, grade, season_score, placement_score, age_score, tribe_score, date });
  const capped = history.length > RECALL_UNLIMITED_CAP ? history.slice(-RECALL_UNLIMITED_CAP) : history;
  try { localStorage.setItem(RECALL_UNLIMITED_KEY, JSON.stringify(capped)); }
  catch {}
}

// Scan all recall_daily_* and recall_archive_* keys from localStorage
export function loadAllRecallDailyResults() {
  const results = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("recall_daily_")) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && val.total != null) results.push(val);
      }
    }
  } catch {}
  return results;
}

export function loadAllRecallArchiveResults() {
  const results = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("recall_archive_")) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && val.total != null) results.push(val);
      }
    }
  } catch {}
  return results;
}

// ── Sandwich storage ──────────────────────────────────────────────────────────
const SANDWICH_KEY = "survivordle_sandwich_state";

export function loadSandwichStorage() {
  try { return JSON.parse(localStorage.getItem(SANDWICH_KEY)) || {}; }
  catch { return {}; }
}

export function saveSandwichStorage(data) {
  try { localStorage.setItem(SANDWICH_KEY, JSON.stringify(data)); }
  catch {}
}

export function loadTodaySandwichGame(puzzleNum) {
  const s = loadSandwichStorage();
  if (s.puzzleNum === puzzleNum) return s;
  return null;
}

export function saveSandwichMidGame({ puzzleNum, guesses }) {
  const s = loadSandwichStorage();
  saveSandwichStorage({ ...s, puzzleNum, guessObjects: guesses, gameOver: false });
}

export function saveSandwichCompletedGame({ puzzleNum, won, guessCount, guesses }) {
  const s = loadSandwichStorage();
  const stats = s.stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.dist[guessCount] = (stats.dist[guessCount] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }
  saveSandwichStorage({ puzzleNum, won, guessCount, guessObjects: guesses, gameOver: true, stats });
}

export function loadSandwichStats() {
  return loadSandwichStorage().stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
}

const SANDWICH_UNLIMITED_KEY = "survivordle_sandwich_unlimited_stats";

export function loadSandwichUnlimitedStats() {
  try { return JSON.parse(localStorage.getItem(SANDWICH_UNLIMITED_KEY)) || { played: 0, wins: 0, dist: {} }; }
  catch { return { played: 0, wins: 0, dist: {} }; }
}

export function saveSandwichUnlimitedGame({ won, guessCount }) {
  const s = loadSandwichUnlimitedStats();
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.dist[guessCount] = (s.dist[guessCount] || 0) + 1;
  }
  try { localStorage.setItem(SANDWICH_UNLIMITED_KEY, JSON.stringify(s)); }
  catch {}
  return s;
}

// ── Connections storage ───────────────────────────────────────────────────────
const CONNECTIONS_KEY = "survivordle_connections_state";

export function loadConnectionsStorage() {
  try { return JSON.parse(localStorage.getItem(CONNECTIONS_KEY)) || {}; }
  catch { return {}; }
}

export function saveConnectionsStorage(data) {
  try { localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(data)); }
  catch {}
}

export function loadTodayConnectionsGame(weekNum) {
  const s = loadConnectionsStorage();
  if (s.weekNum === weekNum) return s;
  return null;
}

export function saveConnectionsMidGame({ weekNum, guesses, solvedGroups, mistakes }) {
  const s = loadConnectionsStorage();
  saveConnectionsStorage({ ...s, weekNum, guessObjects: guesses, solvedGroups, mistakes, gameOver: false });
}

export function saveConnectionsCompletedGame({ weekNum, won, mistakes, guesses, solvedGroups }) {
  const s = loadConnectionsStorage();
  const stats = s.stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.dist[mistakes] = (stats.dist[mistakes] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }
  saveConnectionsStorage({ weekNum, won, mistakes, guessObjects: guesses, solvedGroups, gameOver: true, stats });
}

export function loadConnectionsStats() {
  return loadConnectionsStorage().stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
}

// ── BB Sandwich storage ───────────────────────────────────────────────────────
const BB_SANDWICH_KEY = "bb_sandwich_state";

export function loadBBSandwichStorage() {
  try { return JSON.parse(localStorage.getItem(BB_SANDWICH_KEY)) || {}; }
  catch { return {}; }
}

export function saveBBSandwichStorage(data) {
  try { localStorage.setItem(BB_SANDWICH_KEY, JSON.stringify(data)); }
  catch {}
}

export function loadTodayBBSandwichGame(puzzleNum) {
  const s = loadBBSandwichStorage();
  if (s.puzzleNum === puzzleNum) return s;
  return null;
}

export function saveBBSandwichMidGame({ puzzleNum, guesses }) {
  const s = loadBBSandwichStorage();
  saveBBSandwichStorage({ ...s, puzzleNum, guessObjects: guesses, gameOver: false });
}

export function saveBBSandwichCompletedGame({ puzzleNum, won, guessCount, guesses }) {
  const s = loadBBSandwichStorage();
  const stats = s.stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.dist[guessCount] = (stats.dist[guessCount] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }
  saveBBSandwichStorage({ puzzleNum, won, guessCount, guessObjects: guesses, gameOver: true, stats });
}

export function loadBBSandwichStats() {
  return loadBBSandwichStorage().stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
}

const BB_SANDWICH_UNLIMITED_KEY = "bb_sandwich_unlimited_stats";

export function loadBBSandwichUnlimitedStats() {
  try { return JSON.parse(localStorage.getItem(BB_SANDWICH_UNLIMITED_KEY)) || { played: 0, wins: 0, dist: {} }; }
  catch { return { played: 0, wins: 0, dist: {} }; }
}

export function saveBBSandwichUnlimitedGame({ won, guessCount }) {
  const s = loadBBSandwichUnlimitedStats();
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.dist[guessCount] = (s.dist[guessCount] || 0) + 1;
  }
  try { localStorage.setItem(BB_SANDWICH_UNLIMITED_KEY, JSON.stringify(s)); }
  catch {}
  return s;
}

// ── Bigbrotherdle storage ─────────────────────────────────────────────────────
const BB_KEY = "bb_state";

export function loadBBStorage() {
  try { return JSON.parse(localStorage.getItem(BB_KEY)) || {}; }
  catch { return {}; }
}

export function saveBBStorage(data) {
  try { localStorage.setItem(BB_KEY, JSON.stringify(data)); }
  catch {}
}

export function loadTodayBBGame(puzzleNum) {
  const s = loadBBStorage();
  // Restore completed OR in-progress game as long as it's today's puzzle
  if (s.puzzleNum === puzzleNum) return s;
  return null;
}

export function saveBBMidGame({ puzzleNum, guesses, results, hintEpisode, hintNeighbors }) {
  const s = loadBBStorage();
  // Preserve existing stats and any completed game data
  saveBBStorage({
    ...s,
    puzzleNum,
    guessObjects: guesses,
    resultObjects: results,
    hintEpisode,
    hintNeighbors,
    gameOver: false,
  });
}

export function saveBBCompletedGame({ puzzleNum, won, gaveUp, guessCount, emojiGrid }) {
  const s = loadBBStorage();
  const stats = s.stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.dist[guessCount] = (stats.dist[guessCount] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }
  saveBBStorage({ puzzleNum, won, gaveUp, guessCount, emojiGrid, gameOver: true, stats });
}

export function loadBBStats() {
  return loadBBStorage().stats || { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, dist: {} };
}

const BB_UNLIMITED_KEY = "bb_unlimited_stats";

export function loadBBUnlimitedStats() {
  try { return JSON.parse(localStorage.getItem(BB_UNLIMITED_KEY)) || { played: 0, wins: 0, dist: {} }; }
  catch { return { played: 0, wins: 0, dist: {} }; }
}

export function saveBBUnlimitedGame({ won, guessCount }) {
  const s = loadBBUnlimitedStats();
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.dist[guessCount] = (s.dist[guessCount] || 0) + 1;
  }
  try { localStorage.setItem(BB_UNLIMITED_KEY, JSON.stringify(s)); }
  catch {}
  return s;
}

// ── BB Recall storage ─────────────────────────────────────────────────────────
export function loadBBRecallResult(prefix, key) {
  try { return JSON.parse(localStorage.getItem(`${prefix}_${key}`)) || null; }
  catch { return null; }
}

export function saveBBRecallResult(prefix, key, data) {
  try { localStorage.setItem(`${prefix}_${key}`, JSON.stringify(data)); }
  catch {}
}

// Scan all bb_recall_daily_* keys from localStorage
export function loadAllBBRecallDailyResults() {
  const results = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("bb_recall_daily_")) {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && val.total != null) results.push(val);
      }
    }
  } catch {}
  return results;
}

const BB_RECALL_UNLIMITED_KEY = "bb_recall_unlimited_history";
const BB_RECALL_UNLIMITED_CAP = 200;

export function loadBBRecallUnlimitedHistory() {
  try { return JSON.parse(localStorage.getItem(BB_RECALL_UNLIMITED_KEY)) || []; }
  catch { return []; }
}

export function saveBBRecallUnlimitedGame({ puzzle, total_score, grade, season_score, placement_score, age_score, comp_wins_score }) {
  const history = loadBBRecallUnlimitedHistory();
  const pad = n => String(n).padStart(2, "0");
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  history.push({ puzzle, total_score, grade, season_score, placement_score, age_score, comp_wins_score, date });
  const capped = history.length > BB_RECALL_UNLIMITED_CAP ? history.slice(-BB_RECALL_UNLIMITED_CAP) : history;
  try { localStorage.setItem(BB_RECALL_UNLIMITED_KEY, JSON.stringify(capped)); }
  catch {}
}

// ── Unlimited stats (localStorage, per device) ────────────────────────────────
const UNLIMITED_KEY = "survivordle_unlimited_stats";

export function loadUnlimitedStats() {
  try { return JSON.parse(localStorage.getItem(UNLIMITED_KEY)) || { played: 0, wins: 0, dist: {} }; }
  catch { return { played: 0, wins: 0, dist: {} }; }
}

export function saveUnlimitedGame({ won, guessCount }) {
  const s = loadUnlimitedStats();
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.dist[guessCount] = (s.dist[guessCount] || 0) + 1;
  }
  try { localStorage.setItem(UNLIMITED_KEY, JSON.stringify(s)); }
  catch {}
  return s;
}
