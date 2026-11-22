import { Link } from "react-router-dom";
import { isRankUnlocked } from "../shared/rankStorage";

// Rank testers get the new centered footer (no emojis, built around the fixed-size
// Playwire badge); everyone else keeps the classic one until the new look ships.
export default function Footer({ isBB }) {
  const year = new Date().getFullYear();
  if (!isRankUnlocked()) return (
<footer className="site-footer">
  <div className="site-footer-inner">
    <div className="footer-left">
      <span className={`footer-logo${isBB ? " bb" : ""}`}>{isBB ? "BIG BR👁THERDLE" : "SURV🔥VORDLE"}</span>
      <span className="footer-copy">© {year} {isBB ? "Big Brotherdle. Not affiliated with CBS or Big Brother." : "Survivordle. Not affiliated with CBS or Survivor."}</span>
      <div className="footer-nav-links">
        {!isBB && <Link to="/blog" className="footer-nav-link">Blog</Link>}
        {!isBB && <Link to="/faq" className="footer-nav-link">FAQ</Link>}
        {!isBB && <Link to="/about" className="footer-nav-link">About</Link>}
        <Link to="/privacy" className="footer-nav-link">Privacy</Link>
      </div>
    </div>
    <div className="footer-right">
      <a href="mailto:survivordlegame@gmail.com" className="footer-link" title="Email">
        ✉️ Contact
      </a>
      <a href="https://x.com/Survivordle" target="_blank" rel="noopener noreferrer" className="footer-link" title="X / Twitter">
        𝕏 Twitter
      </a>
      <a href="https://instagram.com/charl13hart" target="_blank" rel="noopener noreferrer" className="footer-link" title="Instagram">
        📷 Instagram
      </a>
      <a href="https://www.buymeacoffee.com/chahart" target="_blank" rel="noopener noreferrer" className="footer-link footer-bmc" title="Buy me a beer">
        🍺 Support
      </a>
<p><a href="https://www.playwire.com/contact-direct-sales" rel="noopener">
          <img
            src="https://www.playwire.com/hubfs/Powered-by-Playwire-Badges/Ads-Powered-by-playwire-2021-standalone-small-white-300px.png"
            alt="Ads-Powered-by-playwire-2021-standalone-small-white-300px"
            width="200"
            height="56"
            loading="lazy"
            style={{ width: "200px", marginLeft: "auto", marginRight: "auto", display: "block", height: "auto", maxWidth: "100%" }}
          />
        </a>
      </p>
      <p style={{ textAlign: "center" }}>
        <a href="https://www.playwire.com/contact-direct-sales" rel="noopener" target="_blank">
          Advertise on this site.
        </a></p>
    </div>
  </div>
</footer>
  );
  return (
    <footer className="site-footer v2">
      <style>{FOOTER_V2_CSS}</style>
      <div className="site-footer-inner">
        <span className={`footer-logo${isBB ? " bb" : ""}`}>{isBB ? "BIG BROTHERDLE" : "SURVIVORDLE"}</span>

        <nav className="footer-right" aria-label="Contact and social">
          <a href="mailto:survivordlegame@gmail.com" className="footer-link">Contact</a>
          <a href="https://x.com/Survivordle" target="_blank" rel="noopener noreferrer" className="footer-link">Twitter</a>
          <a href="https://instagram.com/charl13hart" target="_blank" rel="noopener noreferrer" className="footer-link">Instagram</a>
          <a href="https://www.buymeacoffee.com/chahart" target="_blank" rel="noopener noreferrer" className="footer-link footer-bmc">Support</a>
        </nav>

        <div className="footer-nav-links">
          {!isBB && <Link to="/blog" className="footer-nav-link">Blog</Link>}
          {!isBB && <Link to="/faq" className="footer-nav-link">FAQ</Link>}
          {!isBB && <Link to="/about" className="footer-nav-link">About</Link>}
          <Link to="/privacy" className="footer-nav-link">Privacy</Link>
        </div>

        <div className="footer-ads">
          <a href="https://www.playwire.com/contact-direct-sales" rel="noopener">
            <img
              src="https://www.playwire.com/hubfs/Powered-by-Playwire-Badges/Ads-Powered-by-playwire-2021-standalone-small-white-300px.png"
              alt="Ads-Powered-by-playwire-2021-standalone-small-white-300px"
              width="200"
              height="56"
              loading="lazy"
              style={{ width: "200px", marginLeft: "auto", marginRight: "auto", display: "block", height: "auto", maxWidth: "100%" }}
            />
          </a>
          <a href="https://www.playwire.com/contact-direct-sales" rel="noopener" target="_blank" className="footer-nav-link">
            Advertise on this site.
          </a>
        </div>

        <span className="footer-copy">© {year} {isBB ? "Big Brotherdle. Not affiliated with CBS or Big Brother." : "Survivordle. Not affiliated with CBS or Survivor."}</span>
      </div>
    </footer>
  );
}

// New-look footer styles, scoped to .v2 so the classic footer (styles.js) is untouched.
const FOOTER_V2_CSS = `
  .site-footer.v2 { padding-top: 28px; }
  @media (max-width: 500px) { .site-footer.v2 { padding-bottom: 24px; } }
  /* Centered column: everything lines up on the fixed 200px Playwire badge. */
  .v2 .site-footer-inner {
    max-width: 480px; flex-direction: column; align-items: center; justify-content: flex-start;
    flex-wrap: nowrap; gap: 14px; text-align: center;
  }
  .v2 .footer-logo { font-size: 20px; letter-spacing: 3px; }
  .v2 .footer-right { justify-content: center; gap: 6px; }
  .v2 .footer-link {
    display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px;
    font: 600 12.5px 'DM Sans', sans-serif; color: var(--text2); border: 1px solid var(--border2); transition: color .15s, border-color .15s;
  }
  .v2 .footer-link:hover { color: var(--text); border-color: var(--border); }
  .v2 .footer-bmc { color: #e8742a; border-color: color-mix(in srgb, #e8742a 40%, transparent); }
  .v2 .footer-bmc:hover { color: #e8742a; border-color: #e8742a; }
  .v2 .footer-nav-links { justify-content: center; gap: 18px; margin-top: 0; }
  .v2 .footer-nav-link { font: 500 12px 'DM Sans', sans-serif; color: var(--text3); }
  .v2 .footer-ads {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    width: 100%; padding-top: 16px; border-top: 1px solid var(--border2);
  }
  .v2 .footer-copy { line-height: 1.5; }
  @media (max-width: 500px) {
    .v2 .site-footer-inner { align-items: center; }
    .v2 .footer-link { padding: 0 14px; font-size: 12.5px; }
  }
`;
