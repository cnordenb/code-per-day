// Splits per-extension line counts into per-language line counts.
// The extension -> language table is generated from GitHub Linguist by
// scripts/update-languages.js.

const table = require("../data/languages.json");

const FALLBACK_COLOR = "#586e75";

function grouped(name) {
  return table.languages[name]?.group || name;
}

function languageColor(name) {
  return table.languages[name]?.color || FALLBACK_COLOR;
}

/**
 * Turn { ".h": 120, ".cpp": 900 } into { "C++": 1020 }.
 *
 * Extensions claimed by a single language go straight to it. An extension
 * several languages claim (".h", ".m", ...) goes to whichever of its candidate
 * languages has the most unambiguous lines in the same repository; without
 * such evidence it goes to the extension's default language.
 */
function linesByLanguage(byExtension) {
  const evidence = {};
  const result = {};
  const add = (target, name, lines) => {
    target[name] = (target[name] || 0) + lines;
  };

  const unsure = [];
  for (const [extension, lines] of Object.entries(byExtension)) {
    const entry = table.extensions[extension];
    if (!entry) continue;
    if (entry.sure) {
      add(evidence, entry.langs[0], lines);
      add(result, grouped(entry.langs[0]), lines);
    } else {
      unsure.push([entry, lines]);
    }
  }

  for (const [entry, lines] of unsure) {
    let best = entry.langs[0];
    let bestLines = 0;
    for (const name of entry.langs) {
      if ((evidence[name] || 0) > bestLines) {
        best = name;
        bestLines = evidence[name];
      }
    }
    add(result, grouped(best), lines);
  }

  return result;
}

module.exports = { linesByLanguage, languageColor };
