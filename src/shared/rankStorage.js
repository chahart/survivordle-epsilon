// localStorage helpers for Rank mode. Saves are per show (Big Brother keys start
// with "bb_"); the anon id and the password unlock are shared. Kept separate from storage.js so the
// existing modes are untouched. Every access is wrapped: storage can throw or
// come back empty (private windows, blocked site data).
import { show } from "./rankShow";

const SESSION_KEY = "rank_session_v4_"; // + kind ("winners" | "seasons")
const UNLOCK_KEY  = "rank_unlocked_v1";
const ANON_KEY    = "rank_anon_id_v1";
const SUBMITTED_KEY = "rank_submitted_sig_v2_"; // + kind

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function loadRankSession(kind) {
  try {
    const s = JSON.parse(read(show().store + SESSION_KEY + kind));
    if (s && Array.isArray(s.order) && Array.isArray(s.choices)) return s;
  } catch { /* fall through */ }
  return null;
}
export function saveRankSession(kind, session) {
  write(show().store + SESSION_KEY + kind, JSON.stringify(session));
}
export function clearRankSession(kind) {
  try { localStorage.removeItem(show().store + SESSION_KEY + kind); } catch { /* ignore */ }
}

export function isRankUnlocked() { return read(UNLOCK_KEY) === "1"; }
export function setRankUnlocked() { write(UNLOCK_KEY, "1"); }

// Anonymous id so one person's repeat submissions replace each other.
export function getRankAnonId() {
  let id = read(ANON_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    write(ANON_KEY, id);
  }
  return id;
}

// Today's Matchup picks: { [matchup number]: season number picked }.
const DAILY_KEY = "rank_daily_v1";
export function loadDailyVotes() {
  try {
    const v = JSON.parse(read(show().store + DAILY_KEY));
    if (v && typeof v === "object") return v;
  } catch { /* fall through */ }
  return {};
}
export function saveDailyVote(num, season) {
  write(show().store + DAILY_KEY, JSON.stringify({ ...loadDailyVotes(), [num]: season }));
}

// Signature of the last ranking sent, to avoid re-sending identical data.
export function getSubmittedSig(kind) { return read(show().store + SUBMITTED_KEY + kind); }
export function setSubmittedSig(kind, sig) { write(show().store + SUBMITTED_KEY + kind, sig); }
