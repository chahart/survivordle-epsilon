// Draws the "My Ranking" board to a PNG (canvas, text only, no photos) so it
// looks like the on-page list: one row per winner with a tribe-color bar.

import { subOf, barColors } from "./rank";
import { inkOn } from "./rankTiers";

const ACCENT = "#e8742a"; // Survivordle orange; change for BB
const W = 1080;
const PAD = 56;
const ROW_H = 64;
const HEAD_H = 200;
const FOOT_H = 110;

function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

export async function renderRankImage(ids, byId, { title = "My Ranking", subtitle = "Survivor winners", light = false } = {}) {
  try { await document.fonts.load("64px 'Bebas Neue'"); await document.fonts.load("600 28px 'DM Sans'"); } catch { /* fall back to system fonts */ }

  const list = ids.map(id => byId.get(id)).filter(Boolean);
  const H = HEAD_H + list.length * ROW_H + FOOT_H;
  const c = {
    bg: light ? "#f5f0e8" : "#1a1a1a",
    row: light ? "#ebe4d6" : "#222222",
    line: light ? "#d8cfbd" : "#303030",
    text: light ? "#1a1a1a" : "#f0ede6",
    dim: light ? "#6b6558" : "#888888",
  };

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ACCENT;
  ctx.textAlign = "center";
  ctx.font = "88px 'Bebas Neue', Impact, sans-serif";
  ctx.fillText(title.toUpperCase(), W / 2, 112);
  ctx.fillStyle = c.dim;
  ctx.font = "500 26px 'DM Sans', Arial, sans-serif";
  ctx.fillText(subtitle, W / 2, 156);

  const x0 = PAD;
  const x1 = W - PAD;
  list.forEach((w, i) => {
    const y = HEAD_H + i * ROW_H;
    ctx.fillStyle = c.row;
    ctx.fillRect(x0, y, x1 - x0, ROW_H);
    const cols = barColors(w);
    cols.forEach((col, k) => {
      ctx.fillStyle = col;
      ctx.fillRect(x0, y + (k * ROW_H) / cols.length, 8, ROW_H / cols.length);
    });
    ctx.fillStyle = c.line;
    ctx.fillRect(x0, y + ROW_H - 1, x1 - x0, 1);

    const mid = y + ROW_H / 2;
    ctx.textBaseline = "middle";

    ctx.textAlign = "right";
    ctx.fillStyle = ACCENT;
    ctx.font = "700 26px 'DM Sans', Arial, sans-serif";
    ctx.fillText(String(i + 1), x0 + 70, mid);

    ctx.textAlign = "right";
    ctx.font = "500 22px 'DM Sans', Arial, sans-serif";
    const seasonText = fit(ctx, subOf(w), 400);
    ctx.fillText(seasonText, x1 - 22, mid);
    const seasonW = ctx.measureText(seasonText).width;

    ctx.textAlign = "left";
    ctx.fillStyle = c.text;
    ctx.font = "600 28px 'DM Sans', Arial, sans-serif";
    ctx.fillText(fit(ctx, w.name, x1 - 22 - seasonW - 20 - (x0 + 96)), x0 + 96, mid);
  });

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = ACCENT;
  ctx.font = "600 28px 'DM Sans', Arial, sans-serif";
  ctx.fillText("survivordle.com/rank", W / 2, H - 46);

  return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}

// Uses the native share sheet with the image when the device supports it,
// otherwise downloads the PNG.
export async function shareOrDownloadImage(blob, filename) {
  if (!blob) return false;
  const file = new File([blob], filename, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return true;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return false; // user closed the sheet
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Tier list as a PNG: one row per tier (colored label, then the names as wrapped pills).
// Unplaced items are left out.
export async function renderTierImage(tiers, byId, { title = "My Tier List", subtitle = "", light = false } = {}) {
  try { await document.fonts.load("64px 'Bebas Neue'"); await document.fonts.load("600 24px 'DM Sans'"); } catch { /* fall back to system fonts */ }

  const LAB = 150, PILL_H = 46, GAP = 8, ROW_PAD = 12;
  const c = {
    bg: light ? "#f5f0e8" : "#1a1a1a",
    row: light ? "#ebe4d6" : "#222222",
    pill: light ? "#f5f0e8" : "#2e2e2e",
    text: light ? "#1a1a1a" : "#f0ede6",
    dim: light ? "#6b6558" : "#888888",
  };
  const PILL_FONT = "600 24px 'DM Sans', Arial, sans-serif";
  const maxW = W - 2 * PAD - LAB - 2 * ROW_PAD;

  // Lay the pills out first (needs a context to measure text), so the canvas height is known.
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = PILL_FONT;
  const rows = tiers.map(t => {
    const pills = [];
    let x = 0, line = 0;
    for (const w of t.items.map(id => byId.get(id)).filter(Boolean)) {
      const text = fit(measure, w.name, maxW - 40);
      const pw = measure.measureText(text).width + 34;
      if (x && x + pw > maxW) { x = 0; line++; }
      pills.push({ text, x, line, pw, col: barColors(w)[0] });
      x += pw + GAP;
    }
    return { t, pills, h: 2 * ROW_PAD + (line + 1) * PILL_H + line * GAP };
  });

  const H = HEAD_H + rows.reduce((s, r) => s + r.h + 6, 0) + FOOT_H;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = ACCENT;
  ctx.font = "88px 'Bebas Neue', Impact, sans-serif";
  ctx.fillText(title.toUpperCase(), W / 2, 112);
  ctx.fillStyle = c.dim;
  ctx.font = "500 26px 'DM Sans', Arial, sans-serif";
  ctx.fillText(subtitle, W / 2, 156);

  let y = HEAD_H;
  ctx.textBaseline = "middle";
  for (const { t, pills, h } of rows) {
    ctx.fillStyle = c.row;
    ctx.fillRect(PAD, y, W - 2 * PAD, h);
    ctx.fillStyle = t.color;
    ctx.fillRect(PAD, y, LAB, h);
    ctx.fillStyle = inkOn(t.color);
    ctx.textAlign = "center";
    ctx.font = "56px 'Bebas Neue', Impact, sans-serif";
    ctx.fillText(fit(ctx, (t.name || "?").toUpperCase(), LAB - 16), PAD + LAB / 2, y + h / 2 + 3);

    ctx.textAlign = "left";
    ctx.font = PILL_FONT;
    for (const p of pills) {
      const px = PAD + LAB + ROW_PAD + p.x;
      const py = y + ROW_PAD + p.line * (PILL_H + GAP);
      ctx.fillStyle = c.pill;
      ctx.fillRect(px, py, p.pw, PILL_H);
      ctx.fillStyle = p.col;
      ctx.fillRect(px, py, 6, PILL_H);
      ctx.fillStyle = c.text;
      ctx.fillText(p.text, px + 20, py + PILL_H / 2 + 1);
    }
    y += h + 6;
  }

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = ACCENT;
  ctx.font = "600 28px 'DM Sans', Arial, sans-serif";
  ctx.fillText("survivordle.com/rank", W / 2, H - 46);

  return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
}
