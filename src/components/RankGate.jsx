import { useState } from "react";
import { isRankUnlocked, setRankUnlocked } from "../shared/rankStorage";

// Soft password gate that keeps Rank under wraps until launch. This is a
// client-side check, not real security — it only keeps casual visitors out.
const RANK_PASSWORD = "CH";

export default function RankGate({ children }) {
  const [unlocked, setUnlocked] = useState(isRankUnlocked);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return children;

  function submit(e) {
    e.preventDefault();
    if (value === RANK_PASSWORD) {
      setRankUnlocked();
      setUnlocked(true);
    } else {
      setError(true);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 320, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 2, marginBottom: 16 }}>
        Password
      </div>
      <input
        type="password"
        value={value}
        autoFocus
        autoComplete="off"
        onChange={e => { setValue(e.target.value); setError(false); }}
        style={{
          width: "100%", padding: "10px 12px", fontSize: 16, borderRadius: 8,
          border: `1px solid ${error ? "#c0392b" : "var(--border)"}`,
          background: "var(--bg2)", color: "var(--text)",
        }}
      />
      {error && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>Incorrect password</div>}
      <button
        type="submit"
        style={{
          marginTop: 14, width: "100%", padding: "10px 12px", fontSize: 15, fontWeight: 600,
          borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg3)",
          color: "var(--text)", cursor: "pointer",
        }}
      >
        Enter
      </button>
    </form>
  );
}
