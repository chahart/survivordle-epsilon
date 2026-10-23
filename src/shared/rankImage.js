// Draws the "My Ranking" board to a PNG (canvas, text only, no photos) so it
// looks like the on-page list: one row per winner with a tribe-color bar.

import { subOf, barColors } from "./rank";

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
