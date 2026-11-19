// Code Per Day - GitHub Action
// Author: MPGE (https://github.com/mpge)
// Licensed under MIT

const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const { fetchAllCommitData, createClient } = require("./github");
const { processData } = require("./aggregator");
const { getOwnedRepos, reposPerLanguage, commitsPerLanguage } = require("./languages");
const { fetchKlocByLanguage } = require("./kloc");
const { generateSVG } = require("./svg/generator");
const { getTheme, getAllThemeNames } = require("./svg/themes");

function getOutputFileName(themeName) {
  return `profile-card-${themeName}.svg`;
}

async function run() {
  try {
    // Read inputs
    const token = core.getInput("github_token", { required: true });
    const themeName = core.getInput("theme") || "dark";
    const period = parseInt(core.getInput("period") || "30", 10);
    const outputPath = core.getInput("output_path") || "./code-per-day";
    const allThemes = core.getInput("all_themes") === "true";
    const chartType = core.getInput("chart_type") || "bars";

    // Code per day
    const { login, commits, since, now, yearAgo, calendar } = await fetchAllCommitData(
      token,
      undefined,
      period
    );
    const { chartData, stats } = processData(commits, since, now, yearAgo, calendar);
    console.log(
      `\nLast ${chartData.length} days for @${login}: +${stats.periodTotal.additions} / -${stats.periodTotal.deletions} lines`
    );

    // Languages: donuts and KLOC leaderboard, same token
    const gql = createClient(token);
    const ownedRepos = await getOwnedRepos(gql, login);
    console.log(`\nOwned non-fork repos: ${ownedRepos.length}`);

    const byRepo = reposPerLanguage(ownedRepos);
    const byCommit = await commitsPerLanguage(gql, login);
    console.log(`Top languages by repo:   ${byRepo.map((l) => `${l.name} ${l.value}`).join(", ")}`);
    console.log(`Top languages by commit: ${byCommit.map((l) => `${l.name} ${l.value}`).join(", ")}`);

    console.log("\nCounting lines of code...");
    const kloc = await fetchKlocByLanguage(
      token,
      ownedRepos.filter((repo) => repo.sha)
    );
    console.log(`KLOC by language: ${kloc.map((l) => `${l.name} ${(l.lines / 1000).toFixed(1)}`).join(", ")}`);

    const languages = { kloc, byRepo, byCommit };

    // Write the card(s)
    fs.mkdirSync(outputPath, { recursive: true });
    const names = allThemes ? getAllThemeNames() : [themeName];
    let lastFilePath = null;
    for (const name of names) {
      const svg = generateSVG(chartData, stats, languages, getTheme(name), { chartType });
      lastFilePath = path.join(outputPath, getOutputFileName(name));
      fs.writeFileSync(lastFilePath, svg, "utf8");
      console.log(`Generated: ${lastFilePath}`);
    }
    core.setOutput("svg_path", allThemes ? outputPath : lastFilePath);

    console.log("Done!");
  } catch (err) {
    core.setFailed(err.message);
  }
}

module.exports = { getOutputFileName, run };

if (require.main === module) {
  run();
}
