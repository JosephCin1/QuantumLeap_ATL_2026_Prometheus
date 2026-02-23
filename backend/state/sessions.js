// ---------------------------------------------------------------------------
// Shared in-memory session store
// Map<token, { identityScope, createdAt, expiresAt }>
// ---------------------------------------------------------------------------
const sessions = new Map();

module.exports = { sessions };
