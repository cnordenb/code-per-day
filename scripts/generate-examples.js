// Code Per Day - GitHub Action
// Author: MPGE (https://github.com/mpge)
// Licensed under MIT
//
// Generates example SVGs with realistic sample data for README screenshots.

const fs = require("fs");
const path = require("path");
const { processData } = require("../src/aggregator");
const { generateSVG } = require("../src/svg/generator");
const { getTheme, getAllThemeNames } = require("../src/svg/themes");

// Seed-based pseudo-random for reproducible output
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateSampleCommits(days) {
  const rand = seededRandom(42);
  const commits = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - d - 1));

    // Simulate realistic coding patterns
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseActivity = isWeekend ? 0.4 : 1.0;

    // Some days have bursts, some are quiet
    const burst = rand() > 0.7 ? 2.5 : 1.0;
    const quiet = rand() > 0.85 ? 0 : 1.0; // ~15% chance of zero-commit day

    const numCommits = Math.floor(rand() * 6 * baseActivity * burst * quiet) + (quiet > 0 ? 1 : 0);

    for (let c = 0; c < numCommits; c++) {
      // Additions tend to be higher than deletions (net growth)
      const additions = Math.floor(rand() * 200 * burst + 5);
      const deletions = Math.floor(rand() * 80 * burst + 2);

      commits.push({
        additions,
        deletions,
        date: date.toISOString(),
      });
    }
  }

  return commits;
}

// Generate sample data
const days = 30;
const now = new Date();
const since = new Date(now);
since.setDate(since.getDate() - days);
const yearAgo = new Date(now);
yearAgo.setFullYear(yearAgo.getFullYear() - 1);

// Generate commits for the full year for yearly averages
const yearCommits = generateSampleCommits(365);
const { chartData, stats } = processData(yearCommits, since, now, yearAgo);

console.log("Sample stats:");
console.log(`  Today:    +${stats.today.additions} / -${stats.today.deletions}`);
console.log(`  30d Avg:  +${stats.periodAvg.additions} / -${stats.periodAvg.deletions}`);
console.log(`  Year Avg: +${stats.yearAvg.additions} / -${stats.yearAvg.deletions}`);
console.log(`  Streak:   ${stats.streak} days`);
console.log(`  Chart data points: ${chartData.length}`);

// Ensure output dirs
const examplesDir = path.join(__dirname, "..", "examples");
fs.mkdirSync(examplesDir, { recursive: true });

// Sample language data for the leaderboard and the two donuts
const languages = {
  kloc: [
    { name: "JavaScript", color: "#f1e05a", lines: 42310 },
    { name: "C++", color: "#f34b7d", lines: 31040 },
    { name: "C", color: "#555555", lines: 12790 },
    { name: "Python", color: "#3572A5", lines: 6120 },
    { name: "HTML", color: "#e34c26", lines: 2430 },
    { name: "CSS", color: "#663399", lines: 1180 },
    { name: "Shell", color: "#89e051", lines: 240 },
  ],
  byRepo: [
    { name: "JavaScript", color: "#f1e05a", value: 9 },
    { name: "C", color: "#555555", value: 3 },
    { name: "HTML", color: "#e34c26", value: 3 },
    { name: "C++", color: "#f34b7d", value: 3 },
    { name: "Python", color: "#3572A5", value: 3 },
  ],
  byCommit: [
    { name: "C++", color: "#f34b7d", value: 480 },
    { name: "JavaScript", color: "#f1e05a", value: 440 },
    { name: "HTML", color: "#e34c26", value: 22 },
    { name: "Python", color: "#3572A5", value: 18 },
  ],
};

// One card per theme, plus an area-chart variant of the dark theme
for (const themeName of getAllThemeNames()) {
  const svg = generateSVG(chartData, stats, languages, getTheme(themeName), { chartType: "bars" });
  const file = path.join(examplesDir, `profile-card-${themeName}.svg`);
  fs.writeFileSync(file, svg, "utf8");
  console.log(`Generated: ${file}`);
}

const areaSvg = generateSVG(chartData, stats, languages, getTheme("dark"), { chartType: "area" });
fs.writeFileSync(path.join(examplesDir, "profile-card-dark-area.svg"), areaSvg, "utf8");

console.log("Done! All example SVGs generated in /examples");
