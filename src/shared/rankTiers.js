// Tier lists for Rank mode. Pure helpers plus localStorage (fail-soft, like rankStorage.js).
//
// A tier list is an array of tiers, best first: { id, name, color, items: [item ids] }.
// Anything not in a tier is "unplaced" (derived, so items added by a data update just show up).
import { show } from "./rankShow.js";

// Site colors: Survivordle orange, torch gold, "correct" green, BB blue, hint purple, give-up red.
export const TIER_COLORS = ["#e8742a", "#f7c66a", "#4aaa4a", "#5aaedd", "#9898d8", "#c0504a", "#c05020", "#888888"];

// Default S-F colors per show. Big Brother swaps B and C so its flame tier (B) is BB blue.
const DEFAULT_COLORS = TIER_COLORS.slice(0, 6);
const defaultColors = () => (show().id === "bb" ? [TIER_COLORS[0], TIER_COLORS[1], TIER_COLORS[3], TIER_COLORS[2], TIER_COLORS[4], TIER_COLORS[5]] : DEFAULT_COLORS);

export const defaultTiers = () =>
  ["S", "A", "B", "C", "D", "F"].map((name, i) => ({ id: `t${i}`, name, color: defaultColors()[i], items: [] }));

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
    const t = JSON.parse(localStorage.getItem(show().store + KEY + kind));
    if (Array.isArray(t) && t.every(x => x && typeof x.id === "string" && typeof x.name === "string" && typeof x.color === "string" && Array.isArray(x.items))) {
      // A default tier still on the old shared default color picks up this show's default; recolored tiers keep theirs.
      const cols = defaultColors();
      return t.map(x => {
        const i = /^t([0-5])$/.exec(x.id)?.[1];
        return i != null && x.color === DEFAULT_COLORS[i] ? { ...x, color: cols[i] } : x;
      });
    }
  } catch { /* fall through */ }
  return defaultTiers();
}

export function saveTiers(kind, tiers) {
  try { localStorage.setItem(show().store + KEY + kind, JSON.stringify(tiers)); } catch { /* ignore */ }
}

// Text color on a tier color: dark unless that drops under 3:1 contrast (the WCAG
// bar for large text; tier letters are big). Every default color gets the same
// dark ink; only very dark custom colors switch to white.
export function inkOn(hex) {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (L + 0.05) / (0.0103 + 0.05) >= 3 ? "#1a1a1a" : "#ffffff"; // 0.0103 = luminance of #1a1a1a
}

// A tier named "S" sits its letter inside the Survivordle flame: a black flame
// silhouette (transparent around it), traced from public/Stylized _S_ flame logo.png.
// The flame's round body is centered ~8% of the image below the image center.
export const S_LOGO = "/rank-flame.png";
export const FLAME_NUDGE = { x: -0.02, y: 0.025 }; // optical centering, as a fraction of the flame image size
export const S_DROP = 0.095; // how far the S sits below center, as a fraction of the flame image size
// The flame goes on the show's mark tier: S on Survivor, B on Big Brother.
export const isSTier = t => t.name.trim().toUpperCase() === show().markTier;
