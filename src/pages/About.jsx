import { Link } from "react-router-dom";
import useSEO from "../shared/useSEO";

export default function About() {
  useSEO({
    title: "About Survivordle",
    description: "Survivordle is a daily guessing game for Survivor fans. Learn how to play, meet the creator, and find out what makes each puzzle tick.",
    canonical: "https://survivordle.com/about",
  });

  return (
    <>
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
        <div className="tagline">About</div>
      </header>

      <div className="about-page">

        <section className="about-section">
          <p className="about-body">
            Also a Big Brother fan? Check out <Link to="/bb" className="about-link">Bigbrotherdle 👁</Link>, the Big Brother houseguest guessing game from the same creator.
          </p>
        </section>

        <div className="about-divider" />

        <section className="about-section">
          <h2 className="about-heading">What is Survivordle?</h2>
          <p className="about-body">
            Survivordle is a free daily guessing game for fans of the TV show Survivor. Every day at midnight ET, a new castaway is selected from the full cast history of the show — spanning every season from Survivor: Borneo all the way through the most recent season. Your goal is to identify who that castaway is in 8 guesses or fewer.
          </p>
          <p className="about-body">
            After each guess, the game board gives you color-coded feedback across six attributes: season, placement, gender, tribe color, returnee status, and age. A green cell means your guess exactly matches the answer for that attribute. An orange cell means you are close but not exact — within a few seasons, a few placement spots, or a few years of age. A gray cell means no match. Use that feedback to narrow down who the answer could be, one guess at a time.
          </p>
          <p className="about-body">
            Beyond the daily puzzle, Survivordle offers two additional modes. Archive mode lets you replay every past daily puzzle from the very beginning, so you can catch up on puzzles you missed or replay your favorites. Unlimited mode lets you play as many games as you want with a randomly selected castaway each time — perfect for practicing or just passing time between daily puzzles.
          </p>
          <p className="about-body">
            Not affiliated with the Survivor TV show, CBS, or its producers in any way — just a tribute to the greatest show on television.
          </p>
        </section>

        <div className="about-divider" />

        <section className="about-section">
          <h2 className="about-heading">How to Play</h2>
          <p className="about-body">
            When you load Survivordle, a hidden castaway has already been selected for the day. Type any Survivor castaway's name into the search box and select them from the dropdown to make your first guess. The game will immediately show you how that castaway compares to the hidden answer across all six columns.
          </p>
          <p className="about-body">
            Here is what each column means and how the color coding works:
          </p>
          <ul className="about-list">
            <li><strong>Season</strong> — the season number the castaway appeared on. Green if exact, orange if within two seasons of the answer, gray otherwise.</li>
            <li><strong>Placement</strong> — their finishing position in the game, where 1st place is the winner. Green if exact, orange if within three places of the answer. An arrow indicates whether the answer placed better or worse than your guess.</li>
            <li><strong>Gender</strong> — green if it matches exactly, gray if not. No orange for this column.</li>
            <li><strong>Tribe Color</strong> — the color of the castaway's starting tribe, sourced from the Survivor Wiki. Green if exact, gray if not. No orange for this column.</li>
            <li><strong>Returnee</strong> — whether this castaway has played Survivor more than once. Yes or No. Green if it matches, gray if not.</li>
            <li><strong>Age</strong> — their age at the time of filming. Green if exact, orange if within five years of the answer, gray otherwise.</li>
          </ul>
          <p className="about-body">
            If you are stuck, two hints are available after your first guess. The Outcome hint reveals whether the answer was a pre-jury boot, a juror, a finalist, or the winner — along with the episode and day they were eliminated. The Voted-Out Neighbors hint reveals the names of the castaways eliminated just before and just after the answer, giving you a reference point in the season's boot order. Using hints is noted in your shared result but does not affect your personal stats.
          </p>
          <p className="about-body">
            You have 8 guesses total. If you solve it, your result is saved to your personal stats and you can share your result. If you run out of guesses or choose to give up, the answer is revealed and your streak resets. A new puzzle is available every day at midnight ET.
          </p>
        </section>

        <div className="about-divider" />

        <section className="about-section">
          <h2 className="about-heading">The Creator</h2>
          <p className="about-body">
            Hey! I'm Charlie Hart, the creator of Survivordle. I built this game because I love Survivor and wanted to create something fun and challenging for the community. 
            What started as a side project has grown into something I'm really proud of, and I'm grateful to everyone who plays, shares, and sends feedback.
          </p>
        </section>

        <div className="about-divider" />

        <section className="about-section">
          <h2 className="about-heading">From the Blog</h2>
          <p className="about-body">
            I write about building Survivordle, the data behind the game, and what's coming next.
          </p>
          <div className="about-links">
            <Link to="/blog/how-i-built-survivordle" className="about-link">
              📝 How I Built Survivordle: A Daily Survivor Castaway Guessing Game
            </Link>
          </div>
        </section>

        <div className="about-divider" />

        <section className="about-section">
          <h2 className="about-heading">Get in Touch</h2>
          <p className="about-body">
            Have feedback, spot an error in the data, or just want to talk Survivor? Reach out — I'd love to hear from you.
          </p>
          <div className="about-links">
            <a href="mailto:survivordlegame@gmail.com" className="about-link">
              ✉️ survivordlegame@gmail.com
            </a>
            <a href="https://x.com/Survivordle" target="_blank" rel="noopener noreferrer" className="about-link">
              𝕏 @Survivordle
            </a>
            <a href="https://instagram.com/charl13hart" target="_blank" rel="noopener noreferrer" className="about-link">
              📷 @charl13hart
            </a>
            <a href="https://www.buymeacoffee.com/chahart" target="_blank" rel="noopener noreferrer">
              <img
                src="https://img.buymeacoffee.com/button-api/?text=Buy me a beer&emoji=🍺&slug=chahart&button_colour=ffc64d&font_colour=000000&font_family=Poppins&outline_colour=000000&coffee_colour=FFDD00"
                alt="Buy me a beer"
                className="bmc-img"
              />
            </a>
          </div>
        </section>

      </div>
    </>
  );
}
