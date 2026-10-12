const SUPABASE_URL = "https://ctznxbrgcijyjtnfesfp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0em54YnJnY2lqeWp0bmZlc2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTE1MjMsImV4cCI6MjA4Nzg2NzUyM30.qEnDJSHeSqZu7L1dx6uB5MyjN8DZNwAjL5G_0GmcncM";

export async function logSolveEvent({ puzzle, guesses, hints, won, mode, firstGuess, secondGuess }) {
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const h = now.getHours();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(h % 12 || 12)}:${pad(now.getMinutes())}${h < 12 ? "am" : "pm"}`;
    const finalGuesses = won ? guesses : 9;
    await fetch(`${SUPABASE_URL}/rest/v1/solve_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        puzzle,
        guesses: finalGuesses,
        hints,
        won,
        mode,
        timestamp,
        first_guess: firstGuess || null,
        second_guess: secondGuess || null,
      }),
    });
  } catch {
    // Fail silently — never disrupt gameplay
  }
}

export async function logRecallEvent({
  puzzle, mode,
  guess_season, guess_placement, guess_age, guess_tribe_color,
  pts_season, pts_placement, pts_age, pts_tribe_color,
  score, grade,
}) {
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const h = now.getHours();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(h % 12 || 12)}:${pad(now.getMinutes())}${h < 12 ? "am" : "pm"}`;
    await fetch(`${SUPABASE_URL}/rest/v1/recall_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        puzzle, mode,
        guess_season, guess_placement, guess_age, guess_tribe_color,
        pts_season, pts_placement, pts_age, pts_tribe_color,
        score, grade, timestamp,
      }),
    });
  } catch {
    // Fail silently — never disrupt gameplay
  }
}

export async function logSandwichEvent({
  puzzle, season, placedBefore, placedAfter,
  guesses, won, mode, firstGuess, secondGuess,
}) {
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const h = now.getHours();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(h % 12 || 12)}:${pad(now.getMinutes())}${h < 12 ? "am" : "pm"}`;
    await fetch(`${SUPABASE_URL}/rest/v1/sandwich_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        puzzle, season,
        placed_before: placedBefore,
        placed_after: placedAfter,
        guesses, won, mode, timestamp,
        first_guess: firstGuess || null,
        second_guess: secondGuess || null,
      }),
    });
  } catch {
    // Fail silently — never disrupt gameplay
  }
}

export async function logBBSolveEvent({ puzzle, guesses, hints, won, mode, firstGuess, secondGuess }) {
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const h = now.getHours();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(h % 12 || 12)}:${pad(now.getMinutes())}${h < 12 ? "am" : "pm"}`;
    const finalGuesses = won ? guesses : 9;
    await fetch(`${SUPABASE_URL}/rest/v1/bb_solve_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        puzzle,
        guesses: finalGuesses,
        hints,
        won,
        mode,
        timestamp,
        first_guess: firstGuess || null,
        second_guess: secondGuess || null,
      }),
    });
  } catch {
    // Fail silently — never disrupt gameplay
  }
}

export async function logBBRecallEvent({
  puzzle, mode,
  guess_season, guess_placement, guess_age, guess_comp_wins,
  pts_season, pts_placement, pts_age, pts_comp_wins,
  score, grade,
}) {
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const h = now.getHours();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(h % 12 || 12)}:${pad(now.getMinutes())}${h < 12 ? "am" : "pm"}`;
    await fetch(`${SUPABASE_URL}/rest/v1/bb_recall_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        puzzle, mode,
        guess_season, guess_placement, guess_age, guess_comp_wins,
        pts_season, pts_placement, pts_age, pts_comp_wins,
        score, grade, timestamp,
      }),
    });
  } catch {
    // Fail silently — never disrupt gameplay
  }
}

export async function logBBSandwichEvent({
  puzzle, season, placedBefore, placedAfter,
  guesses, won, mode, firstGuess, secondGuess,
}) {
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const h = now.getHours();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(h % 12 || 12)}:${pad(now.getMinutes())}${h < 12 ? "am" : "pm"}`;
    await fetch(`${SUPABASE_URL}/rest/v1/bb_sandwich_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        puzzle, season,
        placed_before: placedBefore,
        placed_after: placedAfter,
        guesses, won, mode, timestamp,
        first_guess: firstGuess || null,
        second_guess: secondGuess || null,
      }),
    });
  } catch {
    // Fail silently — never disrupt gameplay
  }
}

export async function fetchUnlimitedStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_unlimited_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDailyStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_daily_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchGlobalStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_global_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchBBDailyStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_bb_daily_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchBBGlobalStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_bb_global_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchRecallDailyStats(puzzleNames) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_recall_daily_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ puzzle_names: puzzleNames }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function logConnectionsEvent({ weekNum, won, mistakes, solveOrder, usedHint, puzzleType = "main", customCode = null }) {
  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const h = now.getHours();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
      + `${pad(h % 12 || 12)}:${pad(now.getMinutes())}${h < 12 ? "am" : "pm"}`;
    await fetch(`${SUPABASE_URL}/rest/v1/connections_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        week_num: weekNum || 0,
        won,
        mistakes,
        solve_order: solveOrder,
        used_hint: !!usedHint,
        puzzle_type: puzzleType,
        custom_code: customCode,
        timestamp,
      }),
    });
  } catch {
    // Fail silently — never disrupt gameplay
  }
}

// ── Custom Connections puzzles ────────────────────────────────────────────────
export async function saveCustomPuzzleRemote({ code, title, author, groups, description, status }) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/custom_connections_puzzles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ code, title, author, groups, description, status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchCustomPuzzleRemote(code) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_custom_puzzle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_code: code }),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

// Community listing. status: "featured" or "approved". Returns an array of
// { code, title, author, description } (newest-reviewed first), or null on error.
export async function fetchCommunityPuzzlesRemote({ status, limit, offset = 0 }) {
  try {
    const order = status === "featured" ? "featured_at.desc" : "reviewed_at.desc";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/custom_connections_puzzles?status=eq.${status}&select=code,title,author,description&order=${order}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Community search across featured + approved puzzles. Matches title, author and
// description. Options: query, author (exact, case-insensitive), featuredOnly,
// sort ("new" = featured first then newest-reviewed, "az" = by title),
// playedCodes + played ("played" | "unplayed" | "all"). Returns an array of
// { code, title, author, description, status }, or null on error.
export async function searchCommunityPuzzlesRemote({
  query = "", author = "", featuredOnly = false, sort = "new",
  played = "all", playedCodes = [], limit, offset = 0,
}) {
  try {
    // Strip characters that have meaning in PostgREST filter syntax.
    const clean = s => s.replace(/[,()*\\"]/g, " ").replace(/\s+/g, " ").trim();
    const params = [
      featuredOnly ? "status=eq.featured" : "status=in.(approved,featured)",
      "select=code,title,author,description,status",
      `order=${sort === "az" ? "title.asc" : "status.desc,reviewed_at.desc.nullslast"}`,
      `limit=${limit}`,
      `offset=${offset}`,
    ];

    const q = clean(query);
    if (q) {
      const pat = encodeURIComponent(`*${q}*`);
      params.push(`or=(title.ilike.${pat},author.ilike.${pat},description.ilike.${pat})`);
    }
    const a = clean(author);
    if (a) params.push(`author=ilike.${encodeURIComponent(a)}`);

    const codes = playedCodes.filter(c => /^[A-Za-z0-9]+$/.test(c));
    if (played === "played") {
      if (codes.length === 0) return [];
      params.push(`code=in.(${codes.join(",")})`);
    } else if (played === "unplayed" && codes.length > 0) {
      params.push(`code=not.in.(${codes.join(",")})`);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/custom_connections_puzzles?${params.join("&")}`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchRecallGlobalStats() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_recall_global_stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
