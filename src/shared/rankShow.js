// Which show Rank is running for: Survivor at /rank, Big Brother at /bb/rank.
// Each show has its own routes, browser saves and Supabase tables (bb_*), so the
// two never mix. Rank sets the current show from its route before rendering;
// storage, API, tier and image helpers read it.
// shortcut: a module-level "current show" (not React context), because the
// non-React helpers need it too; fine while only one Rank page is ever mounted.

export const SHOWS = {
  sv: {
    id: "sv", name: "Survivor", base: "/rank", db: "", store: "",
    accent: "#e8742a", deep: "#b3541a", emoji: "🏝️", title: "Survivordle Rank",
    short: "S", winnerWord: "Sole Survivor", crowd: "tribe", markTier: "S",
    next: [["/", "🏝️ Daily Survivordle"], ["/connections", "⛓️ Connections"]],
  },
  bb: {
    id: "bb", name: "Big Brother", base: "/bb/rank", db: "bb_", store: "bb_",
    accent: "#5aaedd", deep: "#1a6fbf", emoji: "👁️", title: "Big Brotherdle Rank",
    short: "BB", winnerWord: "Big Brother winner", crowd: "house", markTier: "B",
    next: [["/bb", "👁️ Daily Big Brotherdle"], ["/bb/recall", "BB Recall"]],
  },
};

let current = SHOWS.sv;
export const show = () => current;
export const setShow = id => { current = SHOWS[id] || SHOWS.sv; };

// Route inside the current show's Rank: rp("/winners") -> "/rank/winners" or "/bb/rank/winners".
export const rp = (p = "") => current.base + p;
// Share links, e.g. "survivordle.com/bb/rank/today".
export const shareUrl = (p = "") => `survivordle.com${rp(p)}`;
export const cap = s => s[0].toUpperCase() + s.slice(1);

// Same page in the other show, e.g. /recall/archive <-> /bb/recall/archive.
// Pages one show lacks (Connections, Blog, About...) fall back to that show's home.
const PAIRED = ["/archive", "/unlimited", "/stats", "/recall", "/sandwich", "/rank", "/how-to-play", "/faq"];
export function otherShowPath(path) {
  const isBB = path === "/bb" || path.startsWith("/bb/");
  const rest = isBB ? path.slice(3) : path;
  const paired = PAIRED.some(p => rest === p || rest.startsWith(p + "/"));
  if (isBB) return paired ? rest : "/";
  return paired ? "/bb" + rest : "/bb";
}
