require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

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
const { resolveUserId, usersContextMap } = require("./iccp/enforce");
const { getRecentLogs, logEvent } = require("./iccp/audit");
const { hashPolicy } = require("./utils/hashPolicy");

// ── LLM service ──────────────────────────────────────────────────────────
const { generateAnswer, generateVisionAnswer } = require("./services/llm");

// ── Multer (image upload, memory only, 5 MB limit) ──────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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

// =========================================================================
//  ICCP VISION ROUTE
// =========================================================================

/** Allowed MIME types for image upload */
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Roles permitted to use vision capability */
const VISION_ALLOWED_ROLES = ["Faculty", "Administrator", "Staff"];

/**
 * POST /iccp/vision-query
 * multipart/form-data: user_id (string), prompt (string), image (file)
 *
 * ICCP enforcement:
 *   - Students → DENY
 *   - Faculty / Admin / Staff → ALLOW → call vision LLM
 */
app.post("/iccp/vision-query", upload.single("image"), async (req, res) => {
  const { user_id, prompt } = req.body;
  const file = req.file;

  // ── Input validation ─────────────────────────────────────────────────
  if (!user_id || !prompt) {
    return res.status(400).json({ error: "user_id and prompt are required" });
  }
  if (!file) {
    return res.status(400).json({ error: "image file is required" });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return res.status(400).json({
      error: `Unsupported image type: ${file.mimetype}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    });
  }

  // ── Resolve identity ─────────────────────────────────────────────────
  const resolvedId = resolveUserId(String(user_id));
  if (!resolvedId) {
    return res.status(401).json({ error: "Unknown user" });
  }
  const user = usersContextMap.get(resolvedId);

  const identityScope = {
    user_id:     user.UserID,
    username:    user.username,
    name:        user.name,
    role:        user.role,
    clearance:   user.clearance,
    institution: user.institution,
    permissions: user.context.permissions || [],
  };

  // ── Generate trace_id + context packet ────────────────────────────────
  const trace_id    = crypto.randomUUID();
  const visionModel = process.env.OPENAI_MODEL_VISION || "gpt-4o";
  const hasKey       = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your-openai-api-key-here";

  const constraints = [
    "capability:vision",
    "role_required:Faculty|Admin",
    "deny_student",
    "ttl:60",
  ];

  const context_packet = {
    ccp_version: "1.0",
    trace_id,
    identity_scope: identityScope,
    selected_model: {
      model_id:   visionModel,
      provider:   hasKey ? "openai" : "mock",
      risk_level: "medium",
    },
    authorized_resources: [
      {
        resource_id:  "image_input",
        origin:       "upload",
        sensitivity:  "medium",
        ttl_seconds:  60,
      },
    ],
    context_constraints: constraints,
    policy_hash: hashPolicy(),
  };

  // ── ICCP role enforcement ────────────────────────────────────────────
  if (!VISION_ALLOWED_ROLES.includes(user.role)) {
    const reason = `Role "${user.role}" is not allowed to use image analysis (requires Faculty or Admin)`;
    logEvent({
      trace_id,
      endpoint:  "/iccp/vision-query",
      user_id:   resolvedId,
      username:  user.username,
      role:      user.role,
      decision:  "DENY",
      reason,
    });
    return res.status(200).json({
      trace_id,
      decision:       "DENY",
      reason,
      context_packet,
      answer:         null,
    });
  }

  // ── ALLOW → call vision LLM ──────────────────────────────────────────
  const reason = "Authorized";
  logEvent({
    trace_id,
    endpoint:  "/iccp/vision-query",
    user_id:   resolvedId,
    username:  user.username,
    role:      user.role,
    decision:  "ALLOW",
    reason,
  });

  const answer = await generateVisionAnswer({
    prompt,
    imageBuffer:   file.buffer,
    imageMimeType: file.mimetype,
    traceId:       trace_id,
    identityScope,
    constraints,
  });

  return res.status(200).json({
    trace_id,
    decision: "ALLOW",
    reason,
    context_packet,
    answer,
  });
});

//  START SERVER
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
