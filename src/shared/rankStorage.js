// localStorage helpers for Rank mode. Kept separate from storage.js so the
// existing modes are untouched. Every access is wrapped: storage can throw or
// come back empty (private windows, blocked site data).

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
    const s = JSON.parse(read(SESSION_KEY + kind));
    if (s && Array.isArray(s.order) && Array.isArray(s.choices)) return s;
  } catch { /* fall through */ }
  return null;
}
export function saveRankSession(kind, session) {
  write(SESSION_KEY + kind, JSON.stringify(session));
}
export function clearRankSession(kind) {
  try { localStorage.removeItem(SESSION_KEY + kind); } catch { /* ignore */ }
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
export function getSubmittedSig(kind) { return read(SUBMITTED_KEY + kind); }
export function setSubmittedSig(kind, sig) { write(SUBMITTED_KEY + kind, sig); }
