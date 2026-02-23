// ---------------------------------------------------------------------------
// Minimal CSV parser – handles quoted fields with embedded commas/newlines
// No external dependencies.
// ---------------------------------------------------------------------------
const fs = require("fs");

/**
 * Parse a CSV string into an array of objects keyed by header row.
 * Handles double-quoted fields that contain commas and escaped quotes ("").
 */
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = splitCSVRows(raw);

  if (rows.length === 0) return [];

  const headers = splitCSVFields(rows[0]);
  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const fields = splitCSVFields(rows[i]);
    if (fields.length === 0 || (fields.length === 1 && fields[0] === "")) continue;

    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j].trim()] = (fields[j] || "").trim();
    }
    results.push(obj);
  }

  return results;
}

// ── Split raw CSV text into rows (respecting quoted newlines) ────────────
function splitCSVRows(text) {
  const rows = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++; // skip \r\n
      if (current.length > 0) rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

// ── Split a single CSV row into fields (respecting quoted commas) ────────
function splitCSVFields(row) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];

    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'; // escaped quote
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

module.exports = { parseCSV };
