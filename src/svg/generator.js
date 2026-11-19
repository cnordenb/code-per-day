// Code Per Day - GitHub Action
// Author: MPGE (https://github.com/mpge)
// Licensed under MIT

const { renderBarChart, renderAreaChart, formatNum } = require("./chart");
const { renderDonutPanel } = require("./donut");
const { renderLeaderboard, LEADERBOARD_ROWS } = require("./leaderboard");
const { escapeXml } = require("./text");

const WIDTH = 840;
const HEIGHT = 446;
const PADDING = 24;

// Top: the code-per-day chart.
const CHART_TOP = 72;
const CHART_HEIGHT = 160;

// Bottom row: leaderboard + two donuts, all inside the one card border.
const ROW_TOP = 285;
const BOARD = { x: PADDING, width: 220 };
const DONUT_WIDTH = 272;
const DONUT_REPO_X = 260;
const DONUT_COMMIT_X = 544;

function renderAnimations() {
  return `
    <style>
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .cpd-header  { animation: fadeInUp 0.5s ease both; }
      .cpd-chart   { animation: fadeInUp 0.5s ease 0.15s both; }
      .cpd-legend  { animation: fadeInUp 0.5s ease 0.3s both; }
      .cpd-stack   { animation: fadeInUp 0.5s ease 0.45s both; }
    </style>`;
}

/**
 * Render the combined profile card.
 *
 * chartData / stats   - from aggregator.processData
 * languages.kloc      - [{ name, color, lines }], largest first
 * languages.byRepo    - [{ name, color, value }]
 * languages.byCommit  - [{ name, color, value }]
 */
function generateSVG(chartData, stats, languages, theme, options = {}) {
  const { chartType = "bars" } = options;

  const chartX = PADDING + 48;
  const chartW = WIDTH - PADDING * 2 - 56;
  const chartOpts = { chartX, chartY: CHART_TOP, chartW, chartH: CHART_HEIGHT };
  const chartContent =
    chartType === "area"
      ? renderAreaChart(chartData, theme, chartOpts)
      : renderBarChart(chartData, theme, chartOpts);

  const legendY = CHART_TOP + CHART_HEIGHT + 32;
  const legendContent = `
    <circle cx="${PADDING + 6}" cy="${legendY}" r="5" fill="${theme.additions}"/>
    <text x="${PADDING + 16}" y="${legendY + 4}" fill="${theme.text}" font-size="11" font-family="'Segoe UI', sans-serif">Additions</text>
    <circle cx="${PADDING + 100}" cy="${legendY}" r="5" fill="${theme.deletions}"/>
    <text x="${PADDING + 110}" y="${legendY + 4}" fill="${theme.text}" font-size="11" font-family="'Segoe UI', sans-serif">Deletions</text>
    <text x="${WIDTH - PADDING}" y="${legendY + 4}" fill="${theme.textSecondary}" font-size="10" font-family="'Segoe UI', sans-serif" text-anchor="end">Last ${chartData.length} days · ${formatNum(stats.periodTotal.additions)} / ${formatNum(-stats.periodTotal.deletions)} lines</text>`;

  const board = renderLeaderboard(languages.kloc.slice(0, LEADERBOARD_ROWS), theme, {
    x: BOARD.x,
    y: ROW_TOP,
    width: BOARD.width,
  });
  const byRepo = renderDonutPanel("Top Languages by Repo", languages.byRepo, theme, {
    x: DONUT_REPO_X,
    y: ROW_TOP,
    width: DONUT_WIDTH,
    emptyLines: ["There are no", "repos to show"],
  });
  const byCommit = renderDonutPanel("Top Languages by Commit", languages.byCommit, theme, {
    x: DONUT_COMMIT_X,
    y: ROW_TOP,
    width: DONUT_WIDTH,
    emptyLines: ["There are no", "commits to show"],
  });

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${renderAnimations()}

  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="12" fill="${theme.bg}" ${theme.bg === "transparent" ? "" : `stroke="${theme.border}" stroke-width="1"`}/>

  <g class="cpd-header">
    <text x="${PADDING}" y="${PADDING + 20}" fill="${theme.title}" font-size="18" font-family="'Segoe UI', sans-serif" font-weight="700">${escapeXml("Code Per Day")}</text>
  </g>

  <g class="cpd-chart">
    ${chartContent}
  </g>

  <g class="cpd-legend">
    ${legendContent}
  </g>

  <g class="cpd-stack">
    ${board}
    ${byRepo}
    ${byCommit}
  </g>
</svg>`;
}

module.exports = { generateSVG, WIDTH, HEIGHT };
