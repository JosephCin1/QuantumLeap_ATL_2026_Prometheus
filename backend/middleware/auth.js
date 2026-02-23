const { sessions } = require("../state/sessions");

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check expiration
  if (Date.now() > new Date(session.expiresAt).getTime()) {
    sessions.delete(token);
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.identityScope = session.identityScope;
  req.token = token;
  next();
}

module.exports = { requireAuth };
