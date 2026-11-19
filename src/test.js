const assert = require("assert");
const { processData } = require("./aggregator");
const { getOutputFileName } = require("./index");
const { countLines, countRepository, extensionOf } = require("./kloc/count");
const { linesByLanguage } = require("./kloc/languages");
const { reposPerLanguage, repoExcluder } = require("./languages");
const { generateSVG } = require("./svg/generator");
const { formatKloc, LEADERBOARD_ROWS } = require("./svg/leaderboard");
const { getTheme, getAllThemeNames } = require("./svg/themes");

function makeDate(date) {
  return new Date(`${date}T12:00:00Z`);
}

function testProcessDataTracksCommitCounts() {
  const commits = [
    { date: "2026-05-01T12:00:00Z", additions: 10, deletions: 3, commits: 1 },
    { date: "2026-05-01T15:00:00Z", additions: 4, deletions: 1, commits: 1 },
    { date: "2026-05-03T09:00:00Z", additions: 2, deletions: 2, commits: 1 },
  ];

  const calendar = new Map([
    ["2026-05-01", 2],
    ["2026-05-02", 0],
    ["2026-05-03", 1],
  ]);

  const { chartData, stats } = processData(
    commits,
    makeDate("2026-05-01"),
    makeDate("2026-05-03"),
    makeDate("2025-05-03"),
    calendar
  );

  assert.strictEqual(chartData.length, 3);
  assert.strictEqual(chartData[0].commits, 2);
  assert.strictEqual(stats.periodTotal.commits, 3);
  return { chartData, stats };
}

function testOutputFileName() {
  assert.strictEqual(getOutputFileName("dark"), "profile-card-dark.svg");
}

function testCountLines() {
  // blank and comment-only lines are not counted
  assert.strictEqual(countLines("// hi\n\nconst a = 1; // trailing\n/* block\n still */\nlet b;\n", "a.js"), 2);
  assert.strictEqual(countLines("# note\nx = 1\n\n", "a.py"), 1);
  assert.strictEqual(extensionOf("src/Thing.CPP"), ".cpp");
  assert.strictEqual(extensionOf("README.md"), null);
}

async function testCountRepositorySplitsByExtension() {
  const files = { "a.js": "let a;\nlet b;\n", "lib/b.py": "x = 1\n", "notes.md": "text\n", "gone.js": null };
  const totals = await countRepository({
    listFiles: async () => ({ paths: Object.keys(files), truncated: false }),
    readFile: async (path) => files[path],
  });
  assert.deepStrictEqual(totals.byExtension, { ".js": 2, ".py": 1 });
  assert.strictEqual(totals.files, 2);
  assert.strictEqual(totals.lines, 3);
  assert.strictEqual(totals.missed, 1);
}

function testAmbiguousExtensionsFollowTheRepo() {
  // .h follows whichever candidate language the repo actually contains
  assert.deepStrictEqual(linesByLanguage({ ".h": 10, ".cpp": 90 }), { "C++": 100 });
  assert.deepStrictEqual(linesByLanguage({ ".h": 10, ".c": 90, ".cpp": 5 }), { C: 100, "C++": 5 });
  // no evidence: the extension's default language
  assert.deepStrictEqual(linesByLanguage({ ".h": 10 }), { C: 10 });
  assert.deepStrictEqual(linesByLanguage({ ".rs": 7, ".html": 3 }), { Rust: 7, HTML: 3 });
  // grouped languages roll up (TSX is part of TypeScript)
  assert.deepStrictEqual(linesByLanguage({ ".ts": 5, ".tsx": 5 }), { TypeScript: 10 });
}

function testReposPerLanguage() {
  const lang = (name) => ({ primaryLanguage: { name, color: "#000" } });
  const top = reposPerLanguage([lang("C"), lang("JavaScript"), lang("JavaScript"), { primaryLanguage: null }]);
  assert.deepStrictEqual(top.map((l) => [l.name, l.value]), [["JavaScript", 2], ["C", 1]]);
}

function testRepoExcluder() {
  const isExcluded = repoExcluder(" Junction2026_Sargas , someone/Other ");
  assert.ok(isExcluded("cnordenb/junction2026_sargas"));
  assert.ok(isExcluded("AnyOrg/Junction2026_Sargas"));
  assert.ok(isExcluded("someone/other"));
  assert.ok(!isExcluded("else/other2"));
  assert.ok(!repoExcluder("")("a/b"));
}

function testCardRenders({ chartData, stats }) {
  assert.strictEqual(formatKloc(42345), "42.3");
  const kloc = Array.from({ length: 12 }, (_, i) => ({ name: `Lang${i}`, color: "#abcdef", lines: 50000 - i * 4000 }));
  const pie = [{ name: "JavaScript", color: "#f1e05a", value: 3 }, { name: "C++", color: "#f34b7d", value: 1 }];
  for (const name of getAllThemeNames()) {
    for (const languages of [{ kloc, byRepo: pie, byCommit: pie.slice(0, 1) }, { kloc: [], byRepo: [], byCommit: [] }]) {
      const svg = generateSVG(chartData, stats, languages, getTheme(name), { chartType: "bars" });
      assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"));
      assert.ok(!svg.includes("NaN") && !svg.includes("undefined"), `bad value in ${name} card`);
      for (const title of ["Code Per Day", "Tech Stack (KLOC)", "Top Languages by Repo", "Top Languages by Commit"]) {
        assert.ok(svg.includes(title), `${title} missing`);
      }
      assert.ok(!svg.includes(`Lang${LEADERBOARD_ROWS}<`), "leaderboard shows too many rows");
    }
  }
}

async function run() {
  const sample = testProcessDataTracksCommitCounts();
  testOutputFileName();
  testCountLines();
  await testCountRepositorySplitsByExtension();
  testAmbiguousExtensionsFollowTheRepo();
  testReposPerLanguage();
  testRepoExcluder();
  testCardRenders(sample);
  console.log("All tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
