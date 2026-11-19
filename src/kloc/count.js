// Line counting ported from repo-kloc-counter (src/count.js, MIT,
// https://github.com/cnordenb/repo-kloc-counter). The counting rules, the
// extension list and the comment styles are unchanged; the only addition is
// that lines are tallied per file extension so they can be split by language.

const extensions = require("../data/extensions.json");
const styles = require("../data/comments.json");

const CODE = new Set(extensions);
const COMMENTS = new Map(
  styles.flatMap((style) => style.extensions.map((extension) => [extension, pattern(style)]))
);
const READERS = 8;

function pattern({ line, block }) {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = block.map(([open, close]) => `${escape(open)}[\\s\\S]*?${escape(close)}`);
  const lines = line.map((marker) => `^[ \\t]*${escape(marker)}.*$`);
  return new RegExp([...blocks, ...lines].join("|"), "gm");
}

function extensionOf(path) {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  for (let dot = name.indexOf("."); dot !== -1; dot = name.indexOf(".", dot + 1)) {
    if (CODE.has(name.slice(dot))) return name.slice(dot);
  }
  return null;
}

function countLines(text, path) {
  const comment = COMMENTS.get(extensionOf(path));
  const kept = comment ? text.replace(comment, (found) => found.replace(/[^\r\n]/g, "")) : text;
  return kept.split(/\r\n|\r|\n/).filter((line) => /\S/.test(line)).length;
}

/**
 * Count one repository.
 * `source` supplies listFiles() -> { paths, truncated } and readFile(path) -> text | null.
 * Returns { files, lines, missed, truncated, byExtension: { ".js": lines, ... } }.
 */
async function countRepository(source) {
  const list = await source.listFiles();
  const paths = list.paths.filter((path) => extensionOf(path) !== null);
  const totals = { files: 0, lines: 0, missed: 0, truncated: list.truncated, byExtension: {} };
  await inParallel(paths, async (path) => {
    const text = await source.readFile(path);
    if (text === null) {
      totals.missed += 1;
      return;
    }
    const lines = countLines(text, path);
    const extension = extensionOf(path);
    totals.files += 1;
    totals.lines += lines;
    totals.byExtension[extension] = (totals.byExtension[extension] || 0) + lines;
  });
  return totals;
}

async function inParallel(items, work) {
  let next = 0;
  const reader = async () => {
    while (next < items.length) {
      next += 1;
      await work(items[next - 1]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(READERS, items.length) }, reader));
}

module.exports = { countLines, countRepository, extensionOf };
