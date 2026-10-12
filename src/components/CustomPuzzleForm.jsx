import { useState } from "react";
import {
  validateCustomPuzzle, buildPuzzleFromForm, createCustomPuzzle, getCustomPuzzleUrl,
  CUSTOM_CATEGORY_MAX_LEN, CUSTOM_ITEM_MAX_LEN, CUSTOM_TITLE_MAX_LEN, CUSTOM_AUTHOR_MAX_LEN,
  CUSTOM_DESCRIPTION_MAX_LEN,
} from "../shared/customConnections";
import { saveCustomConnectionsToHistory } from "../shared/storage";

const DIFF_LABEL = { 1: "Straightforward", 2: "Medium", 3: "Tricky", 4: "Tough" };

function emptyGroups() {
  return Array.from({ length: 4 }, () => ({ category: "", items: ["", "", "", ""] }));
}

export default function CustomPuzzleForm({ onCreated }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [submitForReview, setSubmitForReview] = useState(false);
  const [description, setDescription] = useState("");
  const [submittedForReview, setSubmittedForReview] = useState(false);
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
    const formState = { title, author, submitForReview, description, groups };
    const { valid, errors: errs } = validateCustomPuzzle(formState);
    setErrors(errs);
    if (!valid) return;

    setSaving(true);
    const puzzle = buildPuzzleFromForm(formState);
    const code = await createCustomPuzzle(puzzle);
    setSaving(false);

    if (!code) {
      setErrors(["Couldn't save your puzzle — check your connection and try again."]);
      return;
    }

    const url = getCustomPuzzleUrl(code);
    saveCustomConnectionsToHistory({ code, title: puzzle.title });
    setShareUrl(url);
    setSubmittedForReview(puzzle.submitForReview);
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
    setAuthor("");
    setSubmitForReview(false);
    setDescription("");
    setSubmittedForReview(false);
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
        {submittedForReview && (
          <p className="modal-body" style={{ textAlign: "center" }}>
            ✅ Submitted for Community review. Your link works right now; if approved, your puzzle will
            also show up on the Community page.
          </p>
        )}
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
        <label className="cx-form-label">Puzzle Title</label>
        <input
          className="search-input"
          value={title}
          maxLength={CUSTOM_TITLE_MAX_LEN}
          placeholder="e.g. My Survivor Puzzle"
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div className="cx-form-field">
        <label className="cx-form-label">Display Name (shown publicly)</label>
        <input
          className="search-input"
          value={author}
          maxLength={CUSTOM_AUTHOR_MAX_LEN}
          placeholder="A name or nickname — doesn't need to be your real name"
          onChange={e => setAuthor(e.target.value)}
        />
      </div>

      <div className="cx-form-field">
        <label className="cx-form-label">Description (optional)</label>
        <textarea
          className="search-input"
          rows={3}
          value={description}
          maxLength={CUSTOM_DESCRIPTION_MAX_LEN}
          placeholder="e.g. Winners Only! Follow me for more puzzles: @Survivordle on X #Survivor"
          onChange={e => setDescription(e.target.value)}
        />
        <p style={{ fontSize: "12px", color: "var(--text3)", margin: "4px 0 0" }}>
          {description.length}/{CUSTOM_DESCRIPTION_MAX_LEN} · Add your @handle or #tags to promote yourself if
          your puzzle gets listed on the Community page. No links please.
        </p>
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

      <div className="cx-form-field">
        <label className="cx-form-label">Want your puzzle considered for the Community page?</label>
        <label style={{ display: "block", fontSize: "13px", marginBottom: "6px", cursor: "pointer" }}>
          <input
            type="radio"
            name="cx-submit-for-review"
            checked={!submitForReview}
            onChange={() => setSubmitForReview(false)}
          />{" "}
          No — just give me a link
        </label>
        <label style={{ display: "block", fontSize: "13px", cursor: "pointer" }}>
          <input
            type="radio"
            name="cx-submit-for-review"
            checked={submitForReview}
            onChange={() => setSubmitForReview(true)}
          />{" "}
          Yes — submit it for review
        </label>
      </div>

      {submitForReview && (
        <p style={{ fontSize: "12px", color: "var(--text3)", margin: "-4px 0 12px" }}>
          By submitting you agree your puzzle, display name and description may be shown publicly on
          Survivordle. Submitting doesn't guarantee it'll be listed, and it may be edited or removed.
        </p>
      )}

      {touched && errors.length > 0 && (
        <div className="cx-form-errors">
          {errors.map((err, i) => <div key={i} className="cx-form-error">{err}</div>)}
        </div>
      )}

      <p className="modal-body" style={{ textAlign: "center", fontSize: "12px", color: "var(--text3)" }}>
        Your list of custom puzzles is only saved on this device/browser. If you lose access to a puzzle, email{" "}
        <a className="modal-link" href="mailto:survivordlegame@gmail.com">survivordlegame@gmail.com</a> with as
        many details about the puzzle as possible.
      </p>

      <div style={{ textAlign: "center", marginTop: "8px" }}>
        <button type="submit" className="cx-action-btn cx-submit" disabled={saving}>
          {saving ? "Saving…" : submitForReview ? "Create, Get Link & Submit" : "Create & Get Link"}
        </button>
      </div>
    </form>
  );
}
