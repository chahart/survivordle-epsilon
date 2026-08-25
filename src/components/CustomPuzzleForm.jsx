import { useState } from "react";
import {
  validateCustomPuzzle, buildPuzzleFromForm, createCustomPuzzle, getCustomPuzzleUrl,
  CUSTOM_CATEGORY_MAX_LEN, CUSTOM_ITEM_MAX_LEN, CUSTOM_TITLE_MAX_LEN,
} from "../shared/customConnections";
import { saveCustomConnectionsToHistory } from "../shared/storage";

const DIFF_LABEL = { 1: "Straightforward", 2: "Medium", 3: "Tricky", 4: "Tough" };

function emptyGroups() {
  return Array.from({ length: 4 }, () => ({ category: "", items: ["", "", "", ""] }));
}

export default function CustomPuzzleForm({ onCreated }) {
  const [title, setTitle] = useState("");
  const [groups, setGroups] = useState(emptyGroups());
  const [errors, setErrors] = useState([]);
  const [touched, setTouched] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateCategory(gi, value) {
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, category: value } : g));
  }

  function updateItem(gi, ii, value) {
    setGroups(gs => gs.map((g, i) =>
      i === gi ? { ...g, items: g.items.map((it, j) => j === ii ? value : it) } : g
    ));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    const { valid, errors: errs } = validateCustomPuzzle({ title, groups });
    setErrors(errs);
    if (!valid) return;

    setSaving(true);
    const puzzle = buildPuzzleFromForm({ title, groups });
    const code = await createCustomPuzzle(puzzle);
    setSaving(false);

    if (!code) {
      setErrors(["Couldn't save your puzzle — check your connection and try again."]);
      return;
    }

    const url = getCustomPuzzleUrl(code);
    saveCustomConnectionsToHistory({ code, title: puzzle.title });
    setShareUrl(url);
    onCreated?.();
  }

  function handleCopy() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleMakeAnother() {
    setTitle("");
    setGroups(emptyGroups());
    setErrors([]);
    setTouched(false);
    setShareUrl(null);
  }

  if (shareUrl) {
    return (
      <div className="cx-form-done">
        <p className="cx-form-done-heading">🎉 Your puzzle is ready!</p>
        <p className="modal-body" style={{ textAlign: "center" }}>
          Share this link with friends — anyone who opens it can play your puzzle.
        </p>
        <div className="cx-form-link-row">
          <input className="search-input" readOnly value={shareUrl} onFocus={e => e.target.select()} />
          <button className="cx-action-btn cx-submit" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "📋 Copy Link"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button className="cx-action-btn" onClick={handleMakeAnother}>
            Make Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="cx-form" onSubmit={handleSubmit}>
      <div className="cx-form-field">
        <label className="cx-form-label">Puzzle Title (optional)</label>
        <input
          className="search-input"
          value={title}
          maxLength={CUSTOM_TITLE_MAX_LEN}
          placeholder="e.g. My Survivor Puzzle"
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      {groups.map((g, gi) => (
        <div className={`cx-form-group cx-diff-${gi + 1}`} key={gi}>
          <label className="cx-form-label">
            Category {gi + 1} <span className="cx-form-diff-label">({DIFF_LABEL[gi + 1]})</span>
          </label>
          <input
            className="search-input"
            value={g.category}
            maxLength={CUSTOM_CATEGORY_MAX_LEN}
            placeholder="Category name"
            onChange={e => updateCategory(gi, e.target.value)}
          />
          <div className="cx-form-items">
            {g.items.map((item, ii) => (
              <input
                key={ii}
                className="search-input"
                value={item}
                maxLength={CUSTOM_ITEM_MAX_LEN}
                placeholder={`Item ${ii + 1}`}
                onChange={e => updateItem(gi, ii, e.target.value)}
              />
            ))}
          </div>
        </div>
      ))}

      {touched && errors.length > 0 && (
        <div className="cx-form-errors">
          {errors.map((err, i) => <div key={i} className="cx-form-error">{err}</div>)}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "8px" }}>
        <button type="submit" className="cx-action-btn cx-submit" disabled={saving}>
          {saving ? "Saving…" : "Create & Get Link"}
        </button>
      </div>
    </form>
  );
}
