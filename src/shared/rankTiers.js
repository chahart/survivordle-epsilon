// Tier lists for Rank mode. Pure helpers plus localStorage (fail-soft, like rankStorage.js).
//
// A tier list is an array of tiers, best first: { id, name, color, items: [item ids] }.
// Anything not in a tier is "unplaced" (derived, so items added by a data update just show up).

// Site colors: Survivordle orange, torch gold, "correct" green, BB blue, hint purple, give-up red.
export const TIER_COLORS = ["#e8742a", "#f7c66a", "#4aaa4a", "#5aaedd", "#9898d8", "#c0504a", "#c05020", "#888888"];

export const defaultTiers = () =>
  ["S", "A", "B", "C", "D", "F"].map((name, i) => ({ id: `t${i}`, name, color: TIER_COLORS[i], items: [] }));

// Moves an item into a tier (before `beforeId`, else at the end). tierId null = back to unplaced.
export function placeItem(tiers, id, tierId, beforeId) {
  return tiers.map(t => {
    const items = t.items.filter(x => x !== id);
    if (t.id !== tierId) return { ...t, items };
    const at = beforeId && beforeId !== id ? items.indexOf(beforeId) : -1;
    items.splice(at < 0 ? items.length : at, 0, id);
    return { ...t, items };
  });
}

export const unplacedOf = (tiers, ids) => {
  const placed = new Set(tiers.flatMap(t => t.items));
  return ids.filter(id => !placed.has(id));
};

const KEY = "rank_tiers_v1_"; // + kind

export function loadTiers(kind) {
  try {
    const t = JSON.parse(localStorage.getItem(KEY + kind));
    if (Array.isArray(t) && t.every(x => x && typeof x.id === "string" && typeof x.name === "string" && typeof x.color === "string" && Array.isArray(x.items))) return t;
  } catch { /* fall through */ }
  return defaultTiers();
}

export function saveTiers(kind, tiers) {
  try { localStorage.setItem(KEY + kind, JSON.stringify(tiers)); } catch { /* ignore */ }
}

// Readable text color on top of a tier color (custom colors can be dark).
export function inkOn(hex) {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 140 ? "#1a1a1a" : "#ffffff";
}
