const PANEL_FONT = `'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif`;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

module.exports = { PANEL_FONT, escapeXml, truncate };
