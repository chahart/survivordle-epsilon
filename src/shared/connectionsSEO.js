// Per-page SEO for Survivor Connections. Shared by the client (useSEO in
// Connections.jsx) and middleware.js, so crawlers and link-preview bots that
// don't run JS see the same title/description/canonical as real browsers.
const ORIGIN = "https://survivordle.com";

const PAGES = {
  daily: {
    path: "/connections",
    title: "Survivor Connections – Free Daily Puzzle Game | Survivordle",
    description: "Play Survivor Connections, a free daily puzzle game where you group 16 Survivor-themed tiles into 4 hidden categories. New puzzle every Wednesday, plus an archive of past puzzles and custom puzzles you can make and share with friends.",
  },
  archive: {
    path: "/connections/archive",
    title: "Survivor Connections Archive – Play Past Puzzles | Survivordle",
    description: "Catch up on every past Survivor Connections puzzle. Replay old weekly Survivor word-grouping puzzles any time, free, with no account and no effect on your streak.",
  },
  custom: {
    path: "/connections/custom",
    title: "Survivor Custom Connections – Make Your Own Puzzle | Survivordle",
    description: "Build your own Survivor Custom Connections puzzle with any theme: 4 groups of 4 Survivor-themed tiles. Get a shareable link to send to friends, or submit it to the community.",
  },
  community: {
    path: "/connections/community",
    title: "Survivor Connections Community Puzzles – Fan-Made | Survivordle",
    description: "Play custom Survivor Connections puzzles made by fans, or submit your own. Browse and search community-made Survivor puzzles with new themes added all the time.",
  },
  faq: {
    path: "/connections/faq",
    title: "Survivor Connections FAQ | Survivordle",
    description: "Frequently asked questions about Survivor Connections: how to play, when new puzzles drop, custom puzzles, sharing, and more.",
  },
  stats: {
    path: "/connections/stats",
    title: "Survivor Connections Stats & Streaks | Survivordle",
    description: "Track your Survivor Connections win rate, streaks, and mistakes.",
  },
};

// Returns { title, description, canonical } for a /connections* pathname, or null.
export function getConnectionsSEO(pathname) {
  const p = pathname.replace(/\/$/, "");
  if (p !== "/connections" && !p.startsWith("/connections/")) return null;

  // An individual shared puzzle: custom-specific title, canonical to itself.
  if (p.startsWith("/connections/custom/")) {
    return {
      title: "Play a Survivor Custom Connections Puzzle | Survivordle",
      description: "A fan-made Survivor Custom Connections puzzle. Group the 16 tiles into 4 hidden categories, then make your own and share it.",
      canonical: ORIGIN + p,
    };
  }
  const page = Object.values(PAGES).find(x => x.path === p) || PAGES.daily;
  return { title: page.title, description: page.description, canonical: ORIGIN + page.path };
}
