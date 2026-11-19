// Donut panel modelled on github-profile-summary-cards' donut chart card
// (MIT, https://github.com/vn7n24fzkq/github-profile-summary-cards): title,
// square legend swatches on the left, donut on the right. Drawn without a
// frame of its own so it sits inside the combined card.

const { PANEL_FONT, escapeXml, truncate } = require("./text");

const TITLE_SIZE = 22;
const LABEL_SIZE = 14;
const LABEL_STEP = LABEL_SIZE * 1.8;
const OUTER_RADIUS = 60;
const INNER_RADIUS = 35;
const EMPTY_COLOR = "#586e75";

function point(cx, cy, radius, angle) {
  // angle 0 = 12 o'clock, clockwise
  return [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
}

function arcPath(cx, cy, start, end) {
  const f = (n) => n.toFixed(2);
  // A full circle cannot be drawn as a single arc; split it in two.
  if (end - start >= Math.PI * 2 - 1e-9) {
    const half = start + Math.PI;
    return `${arcPath(cx, cy, start, half)} ${arcPath(cx, cy, half, start + Math.PI * 2)}`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(cx, cy, OUTER_RADIUS, start);
  const [x2, y2] = point(cx, cy, OUTER_RADIUS, end);
  const [x3, y3] = point(cx, cy, INNER_RADIUS, end);
  const [x4, y4] = point(cx, cy, INNER_RADIUS, start);
  return (
    `M${f(x1)},${f(y1)}A${OUTER_RADIUS},${OUTER_RADIUS},0,${large},1,${f(x2)},${f(y2)}` +
    `L${f(x3)},${f(y3)}A${INNER_RADIUS},${INNER_RADIUS},0,${large},0,${f(x4)},${f(y4)}Z`
  );
}

/**
 * data: [{ name, value, color }] in legend order (largest first).
 * opts: { x, y, width, emptyLines } - y is the top of the panel.
 */
function renderDonutPanel(title, data, theme, opts) {
  const { x, y, width, emptyLines = [] } = opts;
  const items =
    data.length > 0 ? data : emptyLines.map((name) => ({ name, value: 1, color: EMPTY_COLOR }));
  const separator = theme.bg === "transparent" ? "none" : theme.bg;

  const cx = x + width - OUTER_RADIUS - 2;
  const legendTop = y + 43;
  const cy = legendTop + OUTER_RADIUS;
  // Room for a label before it would run into the donut.
  const maxChars = Math.floor((cx - OUTER_RADIUS - 8 - (x + 10 + LABEL_SIZE * 1.2)) / (LABEL_SIZE * 0.52));

  let svg = `<text x="${x}" y="${y + 24}" fill="${theme.title}" font-size="${TITLE_SIZE}" font-family="${PANEL_FONT}">${escapeXml(title)}</text>`;

  items.forEach((item, i) => {
    const top = legendTop + i * LABEL_STEP;
    svg += `<rect x="${x + 10}" y="${top.toFixed(1)}" width="${LABEL_SIZE}" height="${LABEL_SIZE}" fill="${item.color}" stroke="${separator}" stroke-width="1"/>`;
    svg += `<text x="${(x + 10 + LABEL_SIZE * 1.2).toFixed(1)}" y="${(top + 12).toFixed(1)}" fill="${theme.text}" font-size="${LABEL_SIZE}" font-family="${PANEL_FONT}">${escapeXml(truncate(item.name, maxChars))}</text>`;
  });

  const total = items.reduce((sum, item) => sum + item.value, 0);
  let angle = 0;
  for (const item of items) {
    const sweep = total > 0 ? (item.value / total) * Math.PI * 2 : 0;
    if (sweep > 0) {
      svg += `<path d="${arcPath(cx, cy, angle, angle + sweep)}" fill="${item.color}" stroke="${separator}" stroke-width="2"><title>${escapeXml(item.name)}</title></path>`;
    }
    angle += sweep;
  }

  return svg;
}

module.exports = { renderDonutPanel };
