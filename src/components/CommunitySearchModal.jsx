import { useState, useEffect, useRef } from "react";
import { searchCommunityPuzzlesRemote } from "../shared/supabase";
import { loadPlayedCustomCodes } from "../shared/storage";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 250;
const PLAYED_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unplayed", label: "Unplayed" },
  { value: "played", label: "Played" },
];

// One puzzle row, shared by the Community page and the search popup.
// onAuthor (optional) makes the author name clickable to filter by that author.
export function CommunityItem({ p, onPlay, onAuthor }) {
  return (
    <div className="archive-item" onClick={() => onPlay(p.code)}>
      <div className="archive-item-left">
        <span className="archive-item-num">
          {p.status === "featured" && <span title="Featured">⭐ </span>}
          {p.title || "Untitled Puzzle"}
        </span>
        <span className="archive-item-date">
          {p.author ? (
            onAuthor ? (
              <>
                by{" "}
                <button
                  type="button"
                  className="cx-search-author"
                  onClick={e => { e.stopPropagation(); onAuthor(p.author); }}
                  title={`More puzzles by ${p.author}`}
                >
                  {p.author}
                </button>
              </>
            ) : `by ${p.author}`
          ) : "Community puzzle"}
        </span>
        {p.description && (
          <span className="archive-item-date" style={{ whiteSpace: "pre-wrap", marginTop: "4px" }}>
            {p.description}
          </span>
        )}
      </div>
      <button className="archive-play-btn">Play</button>
    </div>
  );
}

export default function CommunitySearchModal({ featured, onPlay, onClose }) {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState("new");
  const [played, setPlayed] = useState("all");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const inputRef = useRef(null);
  const requestId = useRef(0);

  // Until something is typed or a filter is changed, show featured suggestions instead.
  const isSearching = query.trim() !== "" || author !== "" || featuredOnly || sort !== "new" || played !== "all";

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function runSearch(offset) {
    return searchCommunityPuzzlesRemote({
      query, author, featuredOnly, sort, played,
      playedCodes: loadPlayedCustomCodes(),
      limit: PAGE_SIZE + 1, offset,
    });
  }

  useEffect(() => {
    if (!isSearching) {
      requestId.current++;
      setLoading(false);
      setError(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const rows = await runSearch(0);
      if (id !== requestId.current) return; // a newer search superseded this one
      setLoading(false);
      if (rows === null) { setError(true); setResults([]); setHasMore(false); return; }
      setError(false);
      setHasMore(rows.length > PAGE_SIZE);
      setResults(rows.slice(0, PAGE_SIZE));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // runSearch reads the same state listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, author, featuredOnly, sort, played]);

  async function loadMore() {
    const id = requestId.current;
    setLoadingMore(true);
    const rows = await runSearch(results.length);
    setLoadingMore(false);
    if (id !== requestId.current || rows === null) return;
    setHasMore(rows.length > PAGE_SIZE);
    setResults(prev => [...prev, ...rows.slice(0, PAGE_SIZE)]);
  }

  function pickAuthor(name) {
    setAuthor(name);
    inputRef.current?.focus();
  }

  function clearAll() {
    setQuery(""); setAuthor(""); setFeaturedOnly(false); setSort("new"); setPlayed("all");
    inputRef.current?.focus();
  }

  return (
    <div className="modal-overlay cx-search-overlay" onClick={onClose}>
      <div className="modal cx-search-modal" role="dialog" aria-label="Search community puzzles" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="modal-title">Search Puzzles</h2>

        <input
          ref={inputRef}
          className="search-input cx-search-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title, author, or description"
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
        />

        <div className="cx-search-filters">
          <button
            type="button"
            className={`cx-search-chip${featuredOnly ? " active" : ""}`}
            aria-pressed={featuredOnly}
            onClick={() => setFeaturedOnly(v => !v)}
          >
            ⭐ Featured only
          </button>
          <div className="cx-search-seg" role="group" aria-label="Sort">
            <button type="button" className={sort === "new" ? "active" : ""} onClick={() => setSort("new")}>Newest</button>
            <button type="button" className={sort === "az" ? "active" : ""} onClick={() => setSort("az")}>A–Z</button>
          </div>
          <div className="cx-search-seg" role="group" aria-label="Played status">
            {PLAYED_OPTIONS.map(o => (
              <button key={o.value} type="button" className={played === o.value ? "active" : ""} onClick={() => setPlayed(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          {author && (
            <button type="button" className="cx-search-chip active" onClick={() => setAuthor("")} title="Remove author filter">
              Author: {author} ✕
            </button>
          )}
        </div>

        {!isSearching ? (
          featured.length > 0 && (
            <>
              <div className="cx-search-heading">⭐ Featured</div>
              <div className="archive-list">
                {featured.map(p => <CommunityItem key={p.code} p={{ ...p, status: "featured" }} onPlay={onPlay} onAuthor={pickAuthor} />)}
              </div>
            </>
          )
        ) : error ? (
          <p className="cx-search-msg">Couldn't search right now — check your connection and try again.</p>
        ) : loading && results.length === 0 ? (
          <p className="cx-search-msg">Searching…</p>
        ) : results.length === 0 ? (
          <div className="cx-search-msg">
            No puzzles found.{" "}
            <button type="button" className="cx-search-author" onClick={clearAll}>Clear search</button>
          </div>
        ) : (
          <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.15s" }}>
            <div className="archive-list">
              {results.map(p => <CommunityItem key={p.code} p={p} onPlay={onPlay} onAuthor={pickAuthor} />)}
            </div>
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <button className="cx-action-btn" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
