// Regenerates src/data/languages.json from GitHub Linguist's languages.yml.
//
// For every counted extension (src/data/extensions.json, taken from
// repo-kloc-counter) it records which Linguist languages claim it, with the
// default language first, and whether that assignment is unambiguous.
//
// Usage: node scripts/update-languages.js [path/to/languages.yml]

const fs = require("fs");
const path = require("path");

const SOURCE = "https://raw.githubusercontent.com/github-linguist/linguist/main/lib/linguist/languages.yml";
const DATA = path.join(__dirname, "..", "src", "data");

// Tie-breaker for extensions several languages claim (Linguist itself uses
// content heuristics here). Earlier entries win when a repo gives no evidence.
const WELL_KNOWN = [
  "JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift",
  "Kotlin", "HTML", "CSS", "Shell", "SQL", "R", "Perl", "Objective-C", "MATLAB", "Scala", "Dart", "Lua",
  "Haskell", "F#", "Verilog", "GLSL", "PowerShell", "Assembly", "Fortran", "Pascal", "Julia", "Elixir",
  "Erlang", "OCaml", "Clojure", "Groovy", "Visual Basic .NET", "Prolog", "Common Lisp", "Scheme", "TeX",
];

function parseLanguages(yaml) {
  const blocks = yaml.replaceAll("\r", "").split(/\n(?=[^\s#-])/);
  const languages = [];
  for (const block of blocks) {
    const head = block.match(/^("?)([^\n]+?)\1:\n/);
    if (!head || block.startsWith("#") || block.startsWith("---")) continue;
    const field = (name) => {
      const found = block.match(new RegExp(`^  ${name}: (.*)$`, "m"));
      return found ? found[1].trim().replace(/^(["'])(.*)\1$/, "$2") : null;
    };
    const list = block.match(/^  extensions:\n((?:  - .*(?:\n|$))+)/m);
    const extensions = list
      ? list[1].trim().split("\n").map((line) => JSON.parse(line.trim().slice(2)).toLowerCase())
      : [];
    languages.push({
      name: head[2],
      type: field("type"),
      color: field("color"),
      group: field("group"),
      extensions,
    });
  }
  return languages;
}

async function main() {
  const local = process.argv[2];
  let yaml;
  if (local) {
    yaml = fs.readFileSync(local, "utf8");
  } else {
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`${SOURCE} answered ${response.status}`);
    yaml = await response.text();
  }

  const languages = parseLanguages(yaml);
  const counted = JSON.parse(fs.readFileSync(path.join(DATA, "extensions.json"), "utf8"));

  const extensions = {};
  const used = new Set();
  for (const extension of counted) {
    // Candidates in languages.yml order.
    const candidates = languages.filter((language) => language.extensions.includes(extension));
    if (candidates.length === 0) continue;
    // Default order: well-known languages first, then languages whose
    // first-listed (primary) extension this is, then languages.yml order.
    const primary = candidates.filter((language) => language.extensions[0] === extension);
    const rank = (language) => {
      const known = WELL_KNOWN.indexOf(language.name);
      return (known === -1 ? WELL_KNOWN.length : known) * 2 + (primary.includes(language) ? 0 : 1);
    };
    const ordered = [...candidates].sort((a, b) => rank(a) - rank(b));
    const sure = candidates.length === 1 || (primary.length === 1 && primary[0] === ordered[0]);
    extensions[extension] = { langs: ordered.map((language) => language.name), sure };
    ordered.forEach((language) => used.add(language.name));
  }

  const meta = {};
  for (const language of languages) {
    if (language.group) used.has(language.name) && used.add(language.group);
  }
  for (const language of languages) {
    if (!used.has(language.name)) continue;
    const entry = {};
    if (language.color) entry.color = language.color;
    if (language.group) entry.group = language.group;
    meta[language.name] = entry;
  }

  const target = path.join(DATA, "languages.json");
  fs.writeFileSync(target, `${JSON.stringify({ extensions, languages: meta })}\n`);
  const unsure = Object.values(extensions).filter((entry) => !entry.sure).length;
  console.log(
    `${Object.keys(extensions).length} of ${counted.length} extensions mapped (${unsure} ambiguous), ` +
      `${Object.keys(meta).length} languages -> ${target}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
