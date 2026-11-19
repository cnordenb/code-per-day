// "Tech Stack (KLOC)" leaderboard: languages ranked by thousands of lines of
// code. Each row: rank, language colour swatch, language name, KLOC.

const { PANEL_FONT, escapeXml, truncate } = require("./text");

const TITLE_SIZE = 22;
const ROW_SIZE = 14;
const ROW_STEP = 19;
const SWATCH = 12;
// As many rows as fit between the title and the bottom of the card.
const LEADERBOARD_ROWS = 7;

function formatKloc(lines) {
  return (lines / 1000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * rows: [{ name, color, lines }] already sorted and cut to LEADERBOARD_ROWS.
 * opts: { x, y, width } - y is the top of the panel.
 */
function renderLeaderboard(rows, theme, opts) {
  const { x, y, width } = opts;
  const separator = theme.bg === "transparent" ? "none" : theme.bg;
  const text = (attrs, content) =>
    `<text ${attrs} font-family="${PANEL_FONT}">${escapeXml(content)}</text>`;

  let svg = text(`x="${x}" y="${y + 24}" fill="${theme.title}" font-size="${TITLE_SIZE}"`, "Tech Stack (KLOC)");

  if (rows.length === 0) {
    return svg + text(`x="${x}" y="${y + 55}" fill="${theme.text}" font-size="${ROW_SIZE}"`, "No code to show");
  }

  const rankRight = x + 18;
  const swatchX = x + 26;
  const nameX = swatchX + SWATCH + 6;
  const valueRight = x + width;

  rows.forEach((row, i) => {
    const baseline = y + 55 + i * ROW_STEP;
    const value = formatKloc(row.lines);
    const maxChars = Math.floor((valueRight - value.length * 8 - 8 - nameX) / (ROW_SIZE * 0.52));
    svg += text(
      `x="${rankRight}" y="${baseline}" fill="${theme.textSecondary}" font-size="${ROW_SIZE}" text-anchor="end"`,
      `${i + 1}.`
    );
    svg += `<rect x="${swatchX}" y="${baseline - SWATCH + 1}" width="${SWATCH}" height="${SWATCH}" fill="${row.color}" stroke="${separator}" stroke-width="1"/>`;
    svg += text(`x="${nameX}" y="${baseline}" fill="${theme.text}" font-size="${ROW_SIZE}"`, truncate(row.name, maxChars));
    svg += text(
      `x="${valueRight}" y="${baseline}" fill="${theme.title}" font-size="${ROW_SIZE}" text-anchor="end"`,
      value
    );
  });

  return svg;
}

module.exports = { renderLeaderboard, formatKloc, LEADERBOARD_ROWS };
