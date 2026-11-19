// KLOC per language across the token owner's repositories.
//
// Files are fetched the way repo-kloc-counter does it (Git Trees listing, then
// one raw download per code file), authenticated with the action's token so
// private repositories work too. Each repository's result is cached by its
// head commit SHA in the GitHub Actions cache, so unchanged repositories are
// not downloaded again on later runs. Nothing is written to the repository.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { countRepository } = require("./count");
const { linesByLanguage, languageColor } = require("./languages");

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const TRIES = 2;
const CACHE_VERSION = 1;
const CACHE_PREFIX = `code-per-day-kloc-v${CACHE_VERSION}-`;

function cacheFile() {
  const dir = path.join(process.env.RUNNER_TEMP || os.tmpdir(), "code-per-day-cache");
  return path.join(dir, "kloc.json");
}

async function restoreCache() {
  const file = cacheFile();
  try {
    const cache = require("@actions/cache");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const hit = await cache.restoreCache([file], `${CACHE_PREFIX}${Date.now()}`, [CACHE_PREFIX]);
    console.log(hit ? `KLOC cache restored (${hit})` : "KLOC cache: nothing to restore");
  } catch (err) {
    console.warn(`KLOC cache restore skipped: ${err.message}`);
  }
  try {
    const stored = JSON.parse(fs.readFileSync(file, "utf8"));
    if (stored.version === CACHE_VERSION && stored.repos) return stored.repos;
  } catch {
    // no usable cache file
  }
  return {};
}

async function saveCache(repos) {
  const file = cacheFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ version: CACHE_VERSION, repos }));
    const cache = require("@actions/cache");
    // Cache entries are immutable, so every save gets a fresh key; restores
    // pick the newest entry by prefix.
    await cache.saveCache([file], `${CACHE_PREFIX}${Date.now()}`);
    console.log("KLOC cache saved");
  } catch (err) {
    console.warn(`KLOC cache save skipped: ${err.message}`);
  }
}

function sourceFor(token, repo) {
  const headers = { authorization: `token ${token}`, "user-agent": "code-per-day-action" };
  const base = `${repo.owner}/${repo.name}`;

  return {
    async listFiles() {
      const response = await fetch(`${API}/repos/${base}/git/trees/${repo.sha}?recursive=1`, {
        headers: { ...headers, accept: "application/vnd.github+json" },
      });
      if (response.status === 409) return { paths: [], truncated: false };
      if (!response.ok) throw new Error(`tree listing answered ${response.status}`);
      const { tree, truncated } = await response.json();
      return {
        paths: tree.filter((entry) => entry.type === "blob").map((entry) => entry.path),
        truncated: Boolean(truncated),
      };
    },

    async readFile(filePath) {
      const encoded = filePath.split("/").map(encodeURIComponent).join("/");
      const url = `${RAW}/${base}/${repo.sha}/${encoded}`;
      for (let attempt = 0; attempt < TRIES; attempt += 1) {
        try {
          const response = await fetch(url, { headers });
          if (response.ok) return await response.text();
        } catch {
          // retry
        }
      }
      return null;
    },
  };
}

/**
 * Sum lines per language over `repos` ([{ owner, name, nameWithOwner, sha }]).
 * Returns [{ name, color, lines }] sorted by lines, largest first.
 */
async function fetchKlocByLanguage(token, repos) {
  const cached = await restoreCache();
  const next = {};
  let changed = false;
  let reused = 0;
  const totals = {};

  for (const repo of repos) {
    let entry = cached[repo.nameWithOwner];
    if (entry && entry.sha === repo.sha) {
      next[repo.nameWithOwner] = entry;
      reused += 1;
    } else {
      try {
        const counted = await countRepository(sourceFor(token, repo));
        entry = { sha: repo.sha, byExtension: counted.byExtension };
        const notes = [];
        if (counted.missed > 0) notes.push(`${counted.missed} files unreadable`);
        if (counted.truncated) notes.push("file listing truncated by GitHub");
        console.log(
          `  Counted ${repo.nameWithOwner}: ${counted.lines} lines in ${counted.files} files` +
            (notes.length ? ` (${notes.join(", ")})` : "")
        );
        // Only remember complete counts, so partial ones are retried next run.
        if (counted.missed === 0) {
          next[repo.nameWithOwner] = entry;
          changed = true;
        }
      } catch (err) {
        console.warn(`  Skipping ${repo.nameWithOwner} for KLOC: ${err.message}`);
        continue;
      }
    }

    for (const [name, lines] of Object.entries(linesByLanguage(entry.byExtension))) {
      totals[name] = (totals[name] || 0) + lines;
    }
  }

  console.log(`KLOC: ${repos.length} repos, ${reused} taken from cache`);

  if (changed || Object.keys(cached).length !== Object.keys(next).length) {
    await saveCache(next);
  }

  return Object.entries(totals)
    .filter(([, lines]) => lines > 0)
    .map(([name, lines]) => ({ name, color: languageColor(name), lines }))
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));
}

module.exports = { fetchKlocByLanguage };
