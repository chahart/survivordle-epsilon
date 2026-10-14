export const config = {
  matcher: "/((?!_next|api|.*\\.[\\w]+$).*)",
};

const BB_TITLE = "Big Brotherdle: Daily Big Brother Houseguest Guessing Game";
const BB_DESCRIPTION = "Guess the Big Brother houseguest in 8 tries. New puzzle every day: match by season, comp wins, placement, age, and more!";

const CONNECTIONS_TITLE = "Survivor Connections: Daily Survivor Word Grouping Puzzle";
const CONNECTIONS_DESCRIPTION = "Group 16 Survivor words into 4 hidden categories. Play the daily puzzle or community-made puzzles!";

// bigbrotherdle.com normally 301s to survivordle.com (see vercel.json / domain settings).
// That redirect is invisible to real browsers but breaks most link-preview crawlers, which
// either don't follow cross-domain redirects or key the preview to the pasted URL. So for
// the two URLs people actually share — the bare domain and /bb — serve a tiny same-origin
// page with correct OG tags + an instant client-side redirect, instead of letting the
// redirect fire. Every other bigbrotherdle.com/* path is untouched (falls through below).
function bigBrotherdleRedirectPage() {
  const target = "https://survivordle.com/bb";
  const image = "https://bigbrotherdle.com/Big_Brotherdle_Thumbnail.png";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${BB_TITLE}</title>
    <meta name="description" content="${BB_DESCRIPTION}" />
    <link rel="canonical" href="${target}" />

    <meta property="og:title" content="${BB_TITLE}" />
    <meta property="og:description" content="${BB_DESCRIPTION}" />
    <meta property="og:url" content="${target}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${image}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${BB_TITLE}" />
    <meta name="twitter:description" content="${BB_DESCRIPTION}" />
    <meta name="twitter:image" content="${image}" />

    <meta http-equiv="refresh" content="0; url=${target}" />
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </head>
  <body>
    <p>Redirecting to <a href="${target}">${target}</a>&hellip;</p>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);

  const host = url.hostname.replace(/^www\./, "");
  const isBBDomainShareLink = host === "bigbrotherdle.com" && (url.pathname === "/" || url.pathname === "/bb");
  if (isBBDomainShareLink) {
    return bigBrotherdleRedirectPage();
  }

  const isBB = url.pathname === "/bb" || url.pathname.startsWith("/bb/");
  const isConnections = url.pathname === "/connections" || url.pathname.startsWith("/connections/");
  if (!isBB && !isConnections) return;

  const BB_TITLE_ = isBB ? BB_TITLE : CONNECTIONS_TITLE;
  const BB_DESCRIPTION_ = isBB ? BB_DESCRIPTION : CONNECTIONS_DESCRIPTION;

  // og:url/canonical intentionally stay pinned to the production domain (SEO identity).
  // og:image must use the requesting host so crawlers can actually fetch it on preview deployments.
  const BB_IMAGE = `${url.origin}/${isBB ? "Big_Brotherdle_Thumbnail.png" : "og-connections-image.png"}`;

  const response = await fetch(new URL("/index.html", url));
  let html = await response.text();

  html = html
    .replace(
      /<title>.*?<\/title>/,
      `<title>${BB_TITLE_}</title>`
    )
    .replace(
      /<meta name="description" content=".*?" \/>/,
      `<meta name="description" content="${BB_DESCRIPTION_}" />`
    )
    .replace(
      /<meta property="og:title" content=".*?" \/>/,
      `<meta property="og:title" content="${BB_TITLE_}" />`
    )
    .replace(
      /<meta property="og:description" content=".*?" \/>/,
      `<meta property="og:description" content="${BB_DESCRIPTION_}" />`
    )
    .replace(
      /<meta property="og:url" content=".*?" \/>/,
      `<meta property="og:url" content="https://survivordle.com${url.pathname}" />`
    )
    .replace(
      /<meta property="og:image" content=".*?" \/>/,
      `<meta property="og:image" content="${BB_IMAGE}" />`
    )
    .replace(
      /<meta name="twitter:title" content=".*?" \/>/,
      `<meta name="twitter:title" content="${BB_TITLE_}" />`
    )
    .replace(
      /<meta name="twitter:description" content=".*?" \/>/,
      `<meta name="twitter:description" content="${BB_DESCRIPTION_}" />`
    )
    .replace(
      /<meta name="twitter:image" content=".*?" \/>/,
      `<meta name="twitter:image" content="${BB_IMAGE}" />`
    )
    .replace(
      /<link rel="canonical" href=".*?" \/>/,
      `<link rel="canonical" href="https://survivordle.com${url.pathname}" />`
    );

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
