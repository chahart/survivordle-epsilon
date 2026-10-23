// Supabase calls for Rank mode (direct REST + RPC, same pattern as supabase.js).
// Table / functions are defined in rank_submissions.sql. Both calls fail soft.

const SUPABASE_URL = "https://ctznxbrgcijyjtnfesfp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0em54YnJnY2lqeWp0bmZlc2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTE1MjMsImV4cCI6MjA4Nzg2NzUyM30.qEnDJSHeSqZu7L1dx6uB5MyjN8DZNwAjL5G_0GmcncM";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

// kind: "winners" | "seasons". seasons: season numbers in rank order (best first).
export async function submitRankRemote(anonId, kind, seasons) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_rank_board`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_anon_id: anonId, p_kind: kind, p_ranking: seasons }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Returns { total, rows: [{ season, avgPct, votes }] } best first, or null.
export async function fetchRankLeaderboard(kind) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_rank_board`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_kind: kind }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return {
      total: data.length ? Number(data[0].total_subs) : 0,
      rows: data.map(r => ({ season: r.win_season, avgPct: Number(r.avg_pct), votes: Number(r.votes) })),
    };
  } catch {
    return null;
  }
}
