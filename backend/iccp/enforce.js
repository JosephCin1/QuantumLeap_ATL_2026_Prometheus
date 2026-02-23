// ---------------------------------------------------------------------------
// ICCP Enforcement Engine – CSV-based data sources
// ---------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { buildContextPacket } = require("./contextPacket");
const { logEvent } = require("./audit");
const { parseCSV } = require("../utils/parseCSV");

// ---------------------------------------------------------------------------
// Role → clearance mapping (4 tiers)
// ---------------------------------------------------------------------------
const CLEARANCE_MAP = {
  Student: "basic",
  Staff: "staff",
  Faculty: "faculty",
  Administrator: "admin",
};

// ---------------------------------------------------------------------------
// Load all 3 CSV data sources into memory, keyed by UserID
// ---------------------------------------------------------------------------
const dataDir = path.join(__dirname, "..", "data");

// users_context  → Map<UserID, { UserID, role, name, username, role_on_project, context }>
const rawContext = parseCSV(path.join(dataDir, "users_context.csv"));
const usersContextMap = new Map();
for (const row of rawContext) {
  let ctx = {};
  try { ctx = JSON.parse(row.context || "{}"); } catch { /* ignore */ }
  usersContextMap.set(row.UserID, {
    UserID: row.UserID,
    role: row.role,
    name: row.name,
    username: row.username,
    role_on_project: row.role_on_project,
    clearance: CLEARANCE_MAP[row.role] || "basic",
    institution: "MockUniversity",
    context: ctx,
  });
}

// user_credentials → Map<UserID, { UserID, Username, CreationDate, LastLoginTime }>
// NOTE: Password is NEVER stored in this map – stripped at load time
const rawCreds = parseCSV(path.join(dataDir, "user_credentials.csv"));
const userCredsMap = new Map();
for (const row of rawCreds) {
  userCredsMap.set(row.UserID, {
    UserID: row.UserID,
    Username: row.Username,
    CreationDate: row.CreationDate,
    LastLoginTime: row.LastLoginTime,
    // Password intentionally omitted
  });
}

// user_transactions → Map<UserID, Array<{ TransactionID, Input, Output }>>
const rawTxns = parseCSV(path.join(dataDir, "user_transactions.csv"));
const userTxnMap = new Map();
for (const row of rawTxns) {
  if (!userTxnMap.has(row.UserID)) userTxnMap.set(row.UserID, []);
  userTxnMap.get(row.UserID).push({
    TransactionID: row.TransactionID,
    Input: row.Input,
    Output: row.Output,
  });
}

// ---------------------------------------------------------------------------
// Reverse-lookup maps – resolve by email or username, not just UserID
// ---------------------------------------------------------------------------
const emailToUserIdMap = new Map();
const usernameToUserIdMap = new Map();

for (const row of rawContext) {
  if (row.email) emailToUserIdMap.set(row.email.toLowerCase(), row.UserID);
  if (row.username) usernameToUserIdMap.set(row.username.toLowerCase(), row.UserID);
}

function resolveUserId(input) {
  const s = String(input).trim();
  if (usersContextMap.has(s)) return s;                                // numeric UserID
  const byUsername = usernameToUserIdMap.get(s.toLowerCase());
  if (byUsername) return byUsername;                                    // username (jdoe23)
  const byEmail = emailToUserIdMap.get(s.toLowerCase());
  if (byEmail) return byEmail;                                         // email
  return null;
}

// Load policy + resource descriptors (JSON)
const resources = JSON.parse(
  fs.readFileSync(path.join(dataDir, "resources.json"), "utf-8")
);
const policies = JSON.parse(
  fs.readFileSync(path.join(dataDir, "policies.json"), "utf-8")
);

// ---------------------------------------------------------------------------
// Main enforcement function
// ---------------------------------------------------------------------------
function enforce(userId, prompt, requestedResources) {
  const trace_id = crypto.randomUUID();

  // ── 1. Identity scope from users_context ───────────────────────────────
  const resolvedId = resolveUserId(userId);
  if (!resolvedId) {
    return { status: 401, body: { error: "Unknown user" } };
  }
  const user = usersContextMap.get(resolvedId);

  const identityScope = {
    user_id: user.UserID,
    username: user.username,
    name: user.name,
    role: user.role,
    clearance: user.clearance,
    institution: user.institution,
    permissions: user.context.permissions || [],
  };

  // ── 2. Parse requested resources ("resource_id" or "resource_id:subject_id")
  const parsed = requestedResources.map((r) => {
    const [resource_id, subject_id_raw] = r.split(":");
    // Resolve subject to numeric UserID (handles email / username / numeric)
    const subject_id = subject_id_raw
      ? (resolveUserId(subject_id_raw) || subject_id_raw)
      : resolvedId;
    return { resource_id, subject_id };
  });

  // ── 3. Validate each resource ──────────────────────────────────────────
  const rolePolicy = policies.role_access[user.role];
  const governedContext = [];
  const authorizedResources = [];
  const contextConstraints = [];

  for (const p of parsed) {
    // 3a. Check if resource is prohibited (user_credentials always blocked)
    if (policies.prohibited_resources.includes(p.resource_id)) {
      const reason = `Resource "${p.resource_id}" is prohibited – passwords are never exposed`;
      logEvent({ trace_id, username: user.username, role: user.role, requested_resources: requestedResources, decision: "DENY", reason });
      const contextPacket = buildContextPacket({ trace_id, identityScope, authorizedResources: [], contextConstraints: [`deny:${p.resource_id}`] });
      return { status: 200, body: { trace_id, decision: "DENY", reason, context_packet: contextPacket, answer: null } };
    }

    // 3b. Check resource descriptor exists
    const desc = resources.find((r) => r.resource_id === p.resource_id);
    if (!desc) {
      const reason = `Unknown resource: ${p.resource_id}`;
      logEvent({ trace_id, username: user.username, role: user.role, requested_resources: requestedResources, decision: "DENY", reason });
      const contextPacket = buildContextPacket({ trace_id, identityScope, authorizedResources: [], contextConstraints: [] });
      return { status: 200, body: { trace_id, decision: "DENY", reason, context_packet: contextPacket, answer: null } };
    }

    // 3c. Check role is allowed for this resource
    if (!desc.allowed_roles.includes(user.role)) {
      const reason = `Role ${user.role} not allowed for ${p.resource_id}`;
      logEvent({ trace_id, username: user.username, role: user.role, requested_resources: requestedResources, decision: "DENY", reason });
      const contextPacket = buildContextPacket({ trace_id, identityScope, authorizedResources: [], contextConstraints: [`deny:${p.resource_id}`] });
      return { status: 200, body: { trace_id, decision: "DENY", reason, context_packet: contextPacket, answer: null } };
    }

    // 3d. Self-only enforcement: Students can only query their own data
    if (rolePolicy.self_only && String(p.subject_id) !== String(user.UserID)) {
      const reason = `${user.role} can only access own data (requested subject ${p.subject_id})`;
      logEvent({ trace_id, username: user.username, role: user.role, requested_resources: requestedResources, decision: "DENY", reason });
      const contextPacket = buildContextPacket({ trace_id, identityScope, authorizedResources: [], contextConstraints: ["self_only"] });
      return { status: 200, body: { trace_id, decision: "DENY", reason, context_packet: contextPacket, answer: null } };
    }

    // 3e. Fetch actual CSV data for this resource + subject
    const data = fetchCSVData(p.resource_id, String(p.subject_id));
    governedContext.push({ resource_id: p.resource_id, subject_id: p.subject_id, ...data });

    authorizedResources.push({
      resource_id: p.resource_id,
      subject_id: p.subject_id,
      origin: desc.origin,
      sensitivity: desc.sensitivity,
      ttl_seconds: desc.ttl_seconds,
    });

    contextConstraints.push(`ttl:${desc.ttl_seconds}`);
  }

  // Always note that passwords are prohibited
  contextConstraints.push("deny:user_credentials (passwords never exposed)");

  const contextPacket = buildContextPacket({ trace_id, identityScope, authorizedResources, contextConstraints });

  const reason = "Authorized";
  logEvent({ trace_id, username: user.username, role: user.role, requested_resources: requestedResources, decision: "ALLOW", reason });

  return {
    status: 200,
    body: {
      trace_id,
      decision: "ALLOW",
      reason,
      context_packet: contextPacket,
      answer: null,
      _governedContext: governedContext,
      _constraints: contextConstraints,
      _identityScope: identityScope,
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch data from the in-memory CSV maps
// ---------------------------------------------------------------------------
function fetchCSVData(resourceId, subjectId) {
  if (resourceId === "users_context") {
    const u = usersContextMap.get(subjectId);
    if (!u) return { found: false };
    return {
      found: true,
      name: u.name,
      role: u.role,
      username: u.username,
      role_on_project: u.role_on_project,
      context: u.context,
    };
  }

  if (resourceId === "user_transactions") {
    const txns = userTxnMap.get(subjectId) || [];
    return { found: txns.length > 0, transactions: txns };
  }

  return { found: false };
}

module.exports = { enforce };
