import { useState, useEffect } from "react";
import {
  loadAllRecallDailyResults, loadAllRecallArchiveResults, loadRecallUnlimitedHistory,
  loadAllBBRecallDailyResults, loadBBRecallUnlimitedHistory,
} from "./storage";
import { fetchRecallGlobalStats, fetchBBRecallGlobalStats } from "./supabase";

const GPA_SCALE = { "A+": 4.0, "A": 4.0, "A-": 3.66, "B+": 3.33, "B": 3.0, "B-": 2.66, "C+": 2.33, "C": 2.0, "C-": 1.66, "D+": 1.33, "D": 1.0, "F": 0.0 };
const GRADE_LETTERS = ["A", "B", "C", "D", "F"];

function gradeBase(grade) {
  if (!grade) return null;
  if (grade === "A+" || grade === "A" || grade === "A-") return "A";
  if (grade === "B+" || grade === "B" || grade === "B-") return "B";
  if (grade === "C+" || grade === "C" || grade === "C-") return "C";
  if (grade === "D+" || grade === "D")                   return "D";
  return "F";
}

function computeGPA(results) {
  if (!results.length) return null;
  const grades = results.map(r => r.grade).filter(Boolean);
  if (!grades.length) return null;
  const sum = grades.reduce((acc, g) => acc + (GPA_SCALE[g] ?? 0), 0);
  return (sum / grades.length).toFixed(2);
}

function gradeBarColor(letter) {
  if (letter === "A") return { bg: "#1a4d1a", border: "#4aaa4a" };
  if (letter === "B") return { bg: "#4a2a05", border: "#f09030" };
  if (letter === "C") return { bg: "#1a2a4a", border: "#4a8aff" };
  if (letter === "D") return { bg: "#3a3a10", border: "#aaaa4a" };
  return { bg: "#4a1a1a", border: "#aa4a4a" };
}

function RecallStatsSection({ results, emptyMsg }) {
  if (!results.length) {
    return <p style={{ textAlign: "center", color: "var(--text3)", marginTop: "24px" }}>{emptyMsg}</p>;
  }

  const gpa      = computeGPA(results);
  const played   = results.length;
  const scores   = results.map(r => r.total ?? r.total_score ?? 0).filter(n => n != null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const best     = scores.length ? Math.max(...scores) : 0;

  const gradeCounts = Object.fromEntries(GRADE_LETTERS.map(l => [l, 0]));
  for (const r of results) {
    const base = gradeBase(r.grade);
    if (base) gradeCounts[base]++;
  }
  const gradeMax = Math.max(...Object.values(gradeCounts), 1);

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "20px" }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "52px", color: "#e8742a", lineHeight: 1 }}>{gpa}</span>
        <span style={{ fontSize: "13px", color: "var(--text3)", letterSpacing: "1px", textTransform: "uppercase" }}>GPA</span>
      </div>

      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        {[
          [played,   "Played"],
          [avgScore, "Avg Score"],
          [best,     "Best Score"],
        ].map(([val, lbl]) => (
          <div className="stats-grid-item" key={lbl}>
            <span className="stats-grid-num">{val}</span>
            <span className="stats-grid-label">{lbl}</span>
          </div>
        ))}
      </div>

      <div className="sp-sub-title">Grade Distribution</div>
      {GRADE_LETTERS.map(letter => {
        const count = gradeCounts[letter];
        const w = count > 0 ? `${Math.max(Math.round((count / gradeMax) * 100), 4)}%` : "0%";
        const { bg, border } = gradeBarColor(letter);
        return (
          <div key={letter} className="stat-row">
            <span className="stat-label">{letter}</span>
            <div className="stat-bar-wrap">
              <div className="stat-bar" style={{ width: w, background: `linear-gradient(90deg, ${bg}, ${bg})`, border: `1px solid ${border}` }}>
                {count > 0 && <span className="stat-bar-count">{count}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

const RECALL_SOURCES = {
  sv: { daily: loadAllRecallDailyResults,   archive: loadAllRecallArchiveResults, unlimited: loadRecallUnlimitedHistory,   fetchGlobal: fetchRecallGlobalStats },
  bb: { daily: loadAllBBRecallDailyResults, archive: null,                        unlimited: loadBBRecallUnlimitedHistory, fetchGlobal: fetchBBRecallGlobalStats },
};

function friendlyK(n) {
  const num = Number(n);
  if (isNaN(num)) return "—";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${Math.floor(num / 1000)}K`;
  return num.toLocaleString();
}

function RecallRankCol({ title, rows, color }) {
  return (
    <div>
      <div className="sp-sub-title" style={{ color }}>{title}</div>
      {(rows || []).map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "12px", color: "var(--text2)", lineHeight: 1.3, paddingRight: "8px" }}>{row.puzzle}</span>
          <span style={{ fontSize: "13px", fontFamily: "'Bebas Neue', sans-serif", color, whiteSpace: "nowrap" }}>{Math.round(row.avg_score)}%</span>
        </div>
      ))}
    </div>
  );
}

function RecallGlobal({ fetchGlobal }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchGlobal().then(d => { setData(d); setLoading(false); }); }, [fetchGlobal]);

  const msg = { textAlign: "center", color: "var(--text3)", marginTop: "24px" };
  if (loading) return <p style={msg}>Loading…</p>;
  if (!data)   return <p style={msg}>Could not load global stats.</p>;

  const total     = Number(data.total_plays || 0);
  const gradeDist = data.grade_dist || {};
  const gradeMax  = Math.max(...Object.values(gradeDist).map(Number), 1);
  const avgScore  = data.avg_score != null ? `${Math.round(Number(data.avg_score))}%` : "—";
  const avgGpa    = data.avg_gpa   != null ? Number(data.avg_gpa).toFixed(2) : "—";

  return (
    <>
      <div className="stats-grid sp-4col" style={{ marginBottom: "20px" }}>
        {[
          [friendlyK(total), "Total Plays"],
          [avgScore,         "Avg Score"],
          [avgGpa,           "Avg GPA"],
          [friendlyK(data.unlimited_plays || 0), "Unlimited Plays"],
        ].map(([val, lbl]) => (
          <div className="stats-grid-item" key={lbl}>
            <span className="stats-grid-num" style={{ fontSize: "32px" }}>{val}</span>
            <span className="stats-grid-label">{lbl}</span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <>
          <div className="sp-sub-title">Grade Distribution</div>
          {GRADE_LETTERS.map(letter => {
            const count = Number(gradeDist[letter] || 0);
            const w = count > 0 ? `${Math.max(Math.round((count / gradeMax) * 100), 4)}%` : "0%";
            const { bg, border } = gradeBarColor(letter);
            return (
              <div key={letter} className="stat-row">
                <span className="stat-label">{letter}</span>
                <div className="stat-bar-wrap">
                  <div className="stat-bar" style={{ width: w, background: bg, border: `1px solid ${border}` }}>
                    {count > 0 && <span className="stat-bar-count">{Math.round((count / total) * 100)}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {(data.easiest?.length > 0 || data.hardest?.length > 0) && (
        <>
          <div className="stats-divider" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <RecallRankCol title="Easiest" rows={data.easiest} color="#4aaa4a" />
            <RecallRankCol title="Hardest" rows={data.hardest} color="#e05040" />
          </div>
        </>
      )}
    </>
  );
}

// Easiest/hardest five only; used under the Global tab.
export function RecallRankings({ show = "sv" }) {
  const [data, setData] = useState(null);
  useEffect(() => { RECALL_SOURCES[show].fetchGlobal().then(setData); }, [show]);
  if (!data?.easiest?.length && !data?.hardest?.length) return null;
  return (
    <>
      <div className="stats-divider" />
      <div className="sp-section-title">Recall: Easiest &amp; Hardest</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <RecallRankCol title="Easiest" rows={data.easiest} color="#4aaa4a" />
        <RecallRankCol title="Hardest" rows={data.hardest} color="#e05040" />
      </div>
    </>
  );
}

export function RecallStatsTab({ show = "sv", bodyClass = "stats-page-body" }) {
  const [subTab, setSubTab] = useState("daily");
  const src = RECALL_SOURCES[show];
  const tabs = [["daily", "Daily"], ...(src.archive ? [["archive", "Archive"]] : []), ["unlimited", "Unlimited"], ["global", "Global"]];
  const results = { daily: src.daily, archive: src.archive, unlimited: src.unlimited }[subTab]?.();

  return (
    <div className={bodyClass}>
      <div className="ul-subtabs" style={{ marginBottom: "20px", marginTop: "0" }}>
        {tabs.map(([k, label]) => (
          <button key={k} className={`ul-subtab${subTab === k ? " active" : ""}`} onClick={() => setSubTab(k)}>{label}</button>
        ))}
      </div>
      {subTab === "global"
        ? <RecallGlobal fetchGlobal={src.fetchGlobal} />
        : <RecallStatsSection results={results} emptyMsg={`Play some Recall ${subTab} puzzles to see your stats!`} />}
    </div>
  );
}
