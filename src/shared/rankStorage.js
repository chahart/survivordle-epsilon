// localStorage helpers for Rank mode. Kept separate from storage.js so the
// existing modes are untouched. Every access is wrapped: storage can throw or
// come back empty (private windows, blocked site data).

const SESSION_KEY = "rank_session_v2";
const UNLOCK_KEY  = "rank_unlocked_v1";
const ANON_KEY    = "rank_anon_id_v1";
const SUBMITTED_KEY = "rank_submitted_sig_v1";

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function loadRankSession() {
  try {
    const s = JSON.parse(read(SESSION_KEY));
    if (s && Array.isArray(s.order) && Array.isArray(s.choices)) return s;
  } catch { /* fall through */ }
  return null;
}
export function saveRankSession(session) {
  write(SESSION_KEY, JSON.stringify(session));
}
export function clearRankSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
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

// Signature of the last ranking sent, to avoid re-sending identical data.
export function getSubmittedSig() { return read(SUBMITTED_KEY); }
export function setSubmittedSig(sig) { write(SUBMITTED_KEY, sig); }
