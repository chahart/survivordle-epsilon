// Supabase calls for Rank mode (direct REST + RPC, same pattern as supabase.js).
// Tables / functions: rank_submissions.sql, rank_players.sql, rank_consensus_v2.sql. All calls fail soft.

import { consensusRows } from "./rank";
import { show } from "./rankShow";

const SUPABASE_URL = "https://ctznxbrgcijyjtnfesfp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0em54YnJnY2lqeWp0bmZlc2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTE1MjMsImV4cCI6MjA4Nzg2NzUyM30.qEnDJSHeSqZu7L1dx6uB5MyjN8DZNwAjL5G_0GmcncM";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

async function rpc(name, body) {
  // Big Brother has its own tables and functions: bb_submit_rank_board, ...
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${show().db}${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// kind: "winners" | "seasons" | "s<N>". seasons: keys in rank order (best first).
export async function submitRankRemote(anonId, kind, seasons) {
  try {
    await rpc("submit_rank_board", { p_anon_id: anonId, p_kind: kind, p_ranking: seasons });
    return true;
  } catch {
    return false;
  }
}

// Raw consensus inputs: { total, pairs: [{ hi, lo, n }], board: [{ season, votes }] }, or null.
export async function fetchRankRaw(kind) {
  try {
    const [board, pairs] = await Promise.all([
      rpc("get_rank_board", { p_kind: kind }),
      rpc("get_rank_pairs", { p_kind: kind }),
    ]);
    if (!Array.isArray(board) || !Array.isArray(pairs)) return null;
    return {
      total: board.length ? Number(board[0].total_subs) : 0,
      pairs: pairs.map(p => ({ hi: p.hi, lo: p.lo, n: Number(p.n) })),
      board: board.map(r => ({ season: r.win_season, votes: Number(r.votes) })),
    };
  } catch {
    return null;
  }
}

// Returns { total, rows: [{ season, score, votes }] } best first (score 0..1), or null.
export async function fetchRankLeaderboard(kind) {
  const raw = await fetchRankRaw(kind);
  return raw && { total: raw.total, rows: consensusRows(raw.pairs, raw.board) };
}

// Tier lists (logged only). tiers: [{ name, items: [item ids] }] best first.
export async function submitRankTiers(anonId, kind, tiers, placed) {
  try {
    await rpc("submit_rank_tiers", { p_anon_id: anonId, p_kind: kind, p_tiers: tiers, p_placed: placed });
    return true;
  } catch {
    return false;
  }
}

// Today's Matchup. day: "YYYY-MM-DD"; pick / other: season numbers.
export async function voteRankDaily(anonId, day, kind, pick, other) {
  try {
    await rpc("vote_rank_daily", { p_anon_id: anonId, p_day: day, p_kind: kind, p_pick: pick, p_other: other });
    return true;
  } catch {
    return false;
  }
}

// Returns Map(season -> votes) for that day, or null.
export async function fetchRankDaily(day) {
  try {
    const rows = await rpc("get_rank_daily", { p_day: day });
    return new Map(rows.map(r => [r.pick, Number(r.votes)]));
  } catch {
    return null;
  }
}
