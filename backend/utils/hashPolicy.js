// ---------------------------------------------------------------------------
// SHA-256 hash of the policies.json file (used in Context Packets)
// ---------------------------------------------------------------------------
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const policiesPath = path.join(__dirname, "..", "data", "policies.json");

function hashPolicy() {
  const raw = fs.readFileSync(policiesPath, "utf-8");
  return "sha256-" + crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = { hashPolicy };
