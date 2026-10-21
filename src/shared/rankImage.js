// Draws the "My Ranking" board to a PNG (canvas, text only, no photos) so it
// looks like the on-page list: one row per winner with a tribe-color bar.

const TRIBE_HEX = {
  "Magenta": "#c0306a", "Red": "#c0392b", "Orange": "#d9822b", "Yellow/Gold": "#d4a72c",
  "Purple": "#7d4fb0", "Blue/Teal": "#2a8fa8", "Green": "#3d8f4f", "Brown": "#8a6040",
};

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

export async function renderRankImage(ids, byId, { title = "My Ranking", light = false } = {}) {
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
  ctx.fillStyle = c.text;
  ctx.textAlign = "center";
  ctx.font = "88px 'Bebas Neue', Impact, sans-serif";
  ctx.fillText(title.toUpperCase(), W / 2, 112);
  ctx.fillStyle = c.dim;
  ctx.font = "500 26px 'DM Sans', Arial, sans-serif";
  ctx.fillText("Survivor winners", W / 2, 156);

  const x0 = PAD;
  const x1 = W - PAD;
  list.forEach((w, i) => {
    const y = HEAD_H + i * ROW_H;
    ctx.fillStyle = c.row;
    ctx.fillRect(x0, y, x1 - x0, ROW_H);
    ctx.fillStyle = TRIBE_HEX[w.tribe_color] || c.dim;
    ctx.fillRect(x0, y, 8, ROW_H);
    ctx.fillStyle = c.line;
    ctx.fillRect(x0, y + ROW_H - 1, x1 - x0, 1);

    const mid = y + ROW_H / 2;
    ctx.textBaseline = "middle";

    ctx.textAlign = "right";
    ctx.fillStyle = c.dim;
    ctx.font = "500 26px 'DM Sans', Arial, sans-serif";
    ctx.fillText(String(i + 1), x0 + 70, mid);

    ctx.textAlign = "right";
    ctx.font = "500 22px 'DM Sans', Arial, sans-serif";
    const season = `S${w.season} · ${w.seasonName}`;
    const seasonText = fit(ctx, season, 330);
    ctx.fillText(seasonText, x1 - 22, mid);
    const seasonW = ctx.measureText(seasonText).width;

    ctx.textAlign = "left";
    ctx.fillStyle = c.text;
    ctx.font = "600 28px 'DM Sans', Arial, sans-serif";
    ctx.fillText(fit(ctx, w.name, x1 - 22 - seasonW - 20 - (x0 + 96)), x0 + 96, mid);
  });

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = c.dim;
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
