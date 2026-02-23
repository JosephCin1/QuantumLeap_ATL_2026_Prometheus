require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/*
 * -----------------------------------------------------------------------
 * Quantum Leap – ICCP-governed AI middleware backend
 * -----------------------------------------------------------------------
 */

// ── App setup ────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── Load data (CSV-based, no database) ───────────────────────────────────
// All CSV data is loaded inside iccp/enforce.js – no need to duplicate here

// ── In-memory sessions (shared module – avoids circular require) ─────────
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const { sessions } = require("./state/sessions");

// ── ICCP modules ─────────────────────────────────────────────────────────
const { enforce } = require("./iccp/enforce");
const { getRecentLogs } = require("./iccp/audit");

// ── LLM service ──────────────────────────────────────────────────────────
const { generateAnswer } = require("./services/llm");

// ── Auth middleware ──────────────────────────────────────────────────────
const { requireAuth } = require("./middleware/auth");

// =========================================================================
//  AUTH ROUTES
// =========================================================================

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const user = users.find((u) => u.username === username);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  try {
    const bcrypt = require("bcrypt");
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
  } catch {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const identityScope = {
    user_id: user.user_id || user.id,
    username: user.username,
    role: user.role,
    clearance: user.clearance,
    institution: user.institution,
  };

  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  sessions.set(token, {
    identityScope,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return res.status(200).json({
    token,
    expires_at: expiresAt.toISOString(),
    identity_scope: identityScope,
  });
});

app.get("/auth/me", requireAuth, (req, res) => {
  return res.status(200).json({ identity_scope: req.identityScope });
});

// =========================================================================
//  ICCP ROUTES
// =========================================================================

/**
 * POST /iccp/query
 * Body: { user_id, prompt, requested_resources: ["resource_id:subject_id"] }
 */
app.post("/iccp/query", async (req, res) => {
  const { user_id, username, prompt, requested_resources } = req.body;
  const uid = user_id || username; // accept UserID (numeric) or username

  if (!uid || !prompt || !Array.isArray(requested_resources)) {
    return res
      .status(400)
      .json({ error: "user_id, prompt, and requested_resources are required" });
  }

  const result = enforce(String(uid), prompt, requested_resources);
  const body = result.body;

  // On ALLOW → call LLM with governed context
  if (body.decision === "ALLOW") {
    body.answer = await generateAnswer({
      prompt,
      governedContext: body._governedContext,
      traceId: body.trace_id,
      identityScope: body._identityScope,
      constraints: body._constraints,
    });

    // Strip internal fields before sending to client
    delete body._governedContext;
    delete body._constraints;
    delete body._identityScope;
  }

  return res.status(result.status).json(body);
});

/**
 * GET /iccp/audit
 * Returns last 50 audit log entries.
 */
app.get("/iccp/audit", (req, res) => {
  return res.status(200).json({ logs: getRecentLogs(50) });
});

//  START SERVER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
