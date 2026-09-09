import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useSEO from "../shared/useSEO";

const CONNECTIONS_FAQ_CSS = `
.faq-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 32px 0 64px;
}

.faq-hero {
  text-align: center;
  margin-bottom: 40px;
}

.faq-hero h1 {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(28px, 5vw, 40px);
  letter-spacing: 3px;
  color: #e8742a;
  margin: 0 0 10px;
}

.faq-hero p {
  font-size: 14px;
  color: var(--text3);
  line-height: 1.6;
}

.faq-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text4);
  margin: 32px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.faq-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.faq-item.open {
  border-color: #e8742a44;
}

.faq-question {
  width: 100%;
  background: var(--bg2);
  border: none;
  text-align: left;
  padding: 16px 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: background 0.15s;
  font-family: 'DM Sans', sans-serif;
}

.faq-question:hover {
  background: var(--bg3);
}

.faq-q-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text1, var(--text));
  line-height: 1.4;
}

.faq-chevron {
  font-size: 11px;
  color: var(--text3);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.faq-item.open .faq-chevron {
  transform: rotate(180deg);
  color: #e8742a;
}

.faq-answer {
  padding: 0 18px 16px;
  font-size: 14px;
  color: var(--text2);
  line-height: 1.75;
  background: var(--bg2);
  border-top: 1px solid var(--border);
}

.faq-answer p {
  margin: 12px 0 0;
}

.faq-answer p:first-child {
  margin-top: 12px;
}

.faq-answer a {
  color: #e8742a;
  text-decoration: none;
}

.faq-answer a:hover {
  text-decoration: underline;
}

.faq-answer strong {
  color: var(--text);
}

.faq-answer ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.faq-answer li {
  line-height: 1.65;
}

.faq-contact {
  margin-top: 40px;
  text-align: center;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg2);
}

.faq-contact p {
  font-size: 14px;
  color: var(--text3);
  margin-bottom: 6px;
}

.faq-contact a {
  color: #e8742a;
  text-decoration: none;
  font-weight: 600;
}

.faq-contact a:hover {
  text-decoration: underline;
}
`;

const SECTIONS = [
  {
    label: "What Is This",
    items: [
      {
        q: "What is Survivor Connections?",
        a: <>
          <p>Survivor Connections is a free daily puzzle game where you sort 16 Survivor-themed tiles into 4 hidden
            groups of 4. It's inspired by the New York Times' Connections game, but every category is built around
            Survivor — castaways, tribes, seasons, twists, and more.</p>
        </>
      },
      {
        q: "How do I play Survivor Connections?",
        a: <>
          <p>Select four tiles you think belong together and hit <strong>Submit</strong>. Guess correctly and that
            group is revealed with its category name. Guess wrong and it counts as a mistake — you get <strong>4
            mistakes</strong> before the game ends. <Link to="/connections">Play today's puzzle</Link> to try it
            yourself.</p>
        </>
      },
      {
        q: "How many answers does each category have?",
        a: <>
          <p>Exactly four, never more. Every category has four correct tiles among the 16 on the board — if a tile
            seems like it could belong to more than one group, that's the trick. Only one of those groupings is
            correct.</p>
        </>
      },
      {
        q: "What do the colors mean?",
        a: <>
          <ul>
            <li><strong>🟩 Green</strong> — the most straightforward category</li>
            <li><strong>🟧 Orange</strong> — medium difficulty</li>
            <li><strong>🟪 Purple</strong> — tricky</li>
            <li><strong>🟥 Red</strong> — the toughest category, usually the one with the most overlap traps</li>
          </ul>
        </>
      },
    ]
  },
  {
    label: "Puzzle Schedule",
    items: [
      {
        q: "How often does a new Survivor Connections puzzle come out?",
        a: <><p>A new puzzle goes live every <strong>Wednesday</strong>. It stays up as that week's puzzle until the
          next one drops.</p></>
      },
      {
        q: "Can I play old Survivor Connections puzzles?",
        a: <><p>Yes — every past puzzle is available in the <Link to="/connections/archive">Archive</Link>. Archive
          games are just for fun and don't affect your stats or streak.</p></>
      },
      {
        q: "I made a mistake I want to fix. Can I keep guessing after 4 mistakes?",
        a: <><p>After your 4th mistake, the result is locked in for your stats, but you can choose to keep guessing
          on bonus attempts just to see the rest of the board — those extra guesses are never tracked.</p></>
      },
    ]
  },
  {
    label: "Custom Puzzles",
    items: [
      {
        q: "Can I make my own Survivor Connections puzzle?",
        a: <><p>Yes! Head to the <Link to="/connections/custom">Custom tab</Link>, fill in 4 categories with 4 items
          each, and you'll get a shareable link. It doesn't have to be Survivor-themed — build whatever puzzle you
          want.</p></>
      },
      {
        q: "How do I share a custom puzzle with friends?",
        a: <><p>Once you create a custom puzzle, you'll get a short link (like
          survivordle.com/connections/custom/aB3xK9) you can text, DM, or post anywhere. Anyone who opens it can
          play your exact puzzle.</p></>
      },
      {
        q: "Do custom puzzles affect my stats?",
        a: <><p>No. Custom puzzles, like Archive puzzles, are just for fun and never touch your stats or
          streak.</p></>
      },
    ]
  },
  {
    label: "Technical",
    items: [
      {
        q: "Is Survivor Connections free?",
        a: <><p>Yes, completely free, no account required.</p></>
      },
      {
        q: "Is this affiliated with the New York Times or CBS's Survivor?",
        a: <><p>No. Survivor Connections is an independent fan-made project inspired by NYT's Connections format and
          themed around the Survivor TV show. It isn't affiliated with, endorsed by, or connected to the New York
          Times, CBS, Survivor, or its producers.</p></>
      },
      {
        q: "Where are my stats stored?",
        a: <><p>Locally in your browser. They never leave your device, so clearing your browser data or switching
          devices will reset them.</p></>
      },
    ]
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? " open" : ""}`}>
      <button className="faq-question" onClick={() => setOpen(o => !o)}>
        <span className="faq-q-text">{q}</span>
        <span className="faq-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
}

// Plain-text version of each answer, for the FAQPage structured data —
// Google needs a text string here, not JSX.
const FAQ_JSONLD_TEXT = {
  "What is Survivor Connections?": "Survivor Connections is a free daily puzzle game where you sort 16 Survivor-themed tiles into 4 hidden groups of 4. It's inspired by the New York Times' Connections game, but every category is built around Survivor.",
  "How do I play Survivor Connections?": "Select four tiles you think belong together and hit Submit. Guess correctly and that group is revealed with its category name. Guess wrong and it counts as a mistake — you get 4 mistakes before the game ends.",
  "How many answers does each category have?": "Exactly four, never more. Every category has four correct tiles among the 16 on the board.",
  "How often does a new Survivor Connections puzzle come out?": "A new puzzle goes live every Wednesday.",
  "Can I play old Survivor Connections puzzles?": "Yes, every past puzzle is available in the Archive tab, and playing them doesn't affect your stats or streak.",
  "Can I make my own Survivor Connections puzzle?": "Yes. The Custom tab lets you build your own 4x4 puzzle with any theme and get a shareable link for it.",
  "Is Survivor Connections free?": "Yes, completely free, no account required.",
};

export default function ConnectionsFAQ() {
  useSEO({
    title: "Survivor Connections FAQ | Survivordle",
    description: "Frequently asked questions about Survivor Connections: how to play, when new puzzles drop, custom puzzles, sharing, and more.",
    canonical: "https://survivordle.com/connections/faq",
  });

  useEffect(() => {
    const mainEntity = Object.entries(FAQ_JSONLD_TEXT).map(([q, a]) => ({
      "@type": "Question",
      "name": q,
      "acceptedAnswer": { "@type": "Answer", "text": a },
    }));
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <>
      <style>{CONNECTIONS_FAQ_CSS}</style>
      <header className="header">
        <div className="logo">
          <span className="logo-surv">SURV</span>
          <span className="logo-torch">
            <span className="logo-torch-flame">🔥</span>
            <span className="logo-torch-stem" />
          </span>
          <span className="logo-vor">VOR</span>
          <span className="logo-dle">DLE</span>
        </div>
        <div className="torch-row">
          <div className="torch-line" />
          <div className="torch-line r" />
        </div>
        <div className="tagline">Connections FAQ</div>
      </header>

      <div className="faq-page">
        <div className="faq-hero">
          <h1>Survivor Connections FAQ</h1>
          <p>Everything you need to know about the Survivor Connections puzzle game.</p>
        </div>

        {SECTIONS.map(section => (
          <div key={section.label}>
            <div className="faq-section-label">{section.label}</div>
            <div className="faq-list">
              {section.items.map(item => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        ))}

        <div className="faq-contact">
          <p>Don't see your question answered here?</p>
          <a href="mailto:survivordlegame@gmail.com">survivordlegame@gmail.com</a>
        </div>
      </div>
    </>
  );
}
