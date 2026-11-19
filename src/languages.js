// Data for the "Top Languages by Repo" and "Top Languages by Commit" donuts.
// Logic ported from github-profile-summary-cards (MIT,
// https://github.com/vn7n24fzkq/github-profile-summary-cards):
//   by repo   = number of owned, non-fork repositories per primary language
//   by commit = commit contributions over every contribution year, attributed
//               to the primary language of the repository they landed in
// Both show the top 5 languages.

const FALLBACK_COLOR = "#586e75";
const TOP = 5;
const YEAR_CHUNK_SIZE = 5;

/**
 * Every non-fork repository owned by `login`, with its primary language and
 * the head commit of its default branch (used by the KLOC counter).
 */
async function getOwnedRepos(gql, login, isExcluded = () => false) {
  const repos = [];
  let cursor = null;
  let hasNext = true;

  while (hasNext) {
    const { user } = await gql(
      `query($login: String!, $cursor: String) {
        user(login: $login) {
          repositories(isFork: false, first: 100, after: $cursor, ownerAffiliations: OWNER) {
            nodes {
              name
              nameWithOwner
              owner { login }
              isPrivate
              primaryLanguage { name color }
              defaultBranchRef { target { oid } }
            }
            pageInfo { endCursor hasNextPage }
          }
        }
      }`,
      { login, cursor }
    );

    const page = user.repositories;
    for (const node of page.nodes) {
      if (isExcluded(node.nameWithOwner)) continue;
      repos.push({
        owner: node.owner.login,
        name: node.name,
        nameWithOwner: node.nameWithOwner,
        isPrivate: node.isPrivate,
        primaryLanguage: node.primaryLanguage,
        sha: node.defaultBranchRef?.target?.oid || null,
      });
    }
    hasNext = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return repos;
}

function tally(map, language, count) {
  const entry = map.get(language.name);
  if (entry) entry.value += count;
  else map.set(language.name, { name: language.name, color: language.color || FALLBACK_COLOR, value: count });
}

function topLanguages(map) {
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, TOP);
}

function reposPerLanguage(repos) {
  const map = new Map();
  for (const repo of repos) {
    if (repo.primaryLanguage) tally(map, repo.primaryLanguage, 1);
  }
  return topLanguages(map);
}

async function commitContributionsWindow(gql, login, from, to) {
  const { user } = await gql(
    `query($login: String!, $from: DateTime, $to: DateTime) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          commitContributionsByRepository(maxRepositories: 100) {
            repository { nameWithOwner primaryLanguage { name color } }
            contributions { totalCount }
          }
        }
      }
    }`,
    { login, from, to }
  );
  return user.contributionsCollection.commitContributionsByRepository;
}

async function commitContributionsForYear(gql, login, year) {
  try {
    return await commitContributionsWindow(gql, login, `${year}-01-01T00:00:00Z`, `${year}-12-31T23:59:59Z`);
  } catch (err) {
    if (!/resource limits|timeout|timed out/i.test(err.message || "")) throw err;
    // Very busy years can exceed GitHub's query cost limit; two half-year
    // windows pass and sum to the same totals.
    const halves = await Promise.all([
      commitContributionsWindow(gql, login, `${year}-01-01T00:00:00Z`, `${year}-06-30T23:59:59Z`),
      commitContributionsWindow(gql, login, `${year}-07-01T00:00:00Z`, `${year}-12-31T23:59:59Z`),
    ]);
    return halves.flat();
  }
}

async function commitsPerLanguage(gql, login, isExcluded = () => false) {
  const { user } = await gql(
    `query($login: String!) {
      user(login: $login) { contributionsCollection { contributionYears } }
    }`,
    { login }
  );
  const years = [...user.contributionsCollection.contributionYears].sort((a, b) => b - a);

  const map = new Map();
  for (let i = 0; i < years.length; i += YEAR_CHUNK_SIZE) {
    const chunk = years.slice(i, i + YEAR_CHUNK_SIZE);
    const perYear = await Promise.all(chunk.map((year) => commitContributionsForYear(gql, login, year)));
    for (const node of perYear.flat()) {
      if (node.repository.primaryLanguage && !isExcluded(node.repository.nameWithOwner)) {
        tally(map, node.repository.primaryLanguage, node.contributions.totalCount);
      }
    }
  }
  return topLanguages(map);
}

/**
 * Build a matcher from a comma-separated list of repositories. Entries match
 * case-insensitively, either by bare name ("repo") or by "owner/repo".
 */
function repoExcluder(list) {
  const entries = new Set(
    String(list || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
  return (nameWithOwner) => {
    const full = String(nameWithOwner || "").toLowerCase();
    return entries.has(full) || entries.has(full.slice(full.indexOf("/") + 1));
  };
}

module.exports = { repoExcluder, getOwnedRepos, reposPerLanguage, commitsPerLanguage };
