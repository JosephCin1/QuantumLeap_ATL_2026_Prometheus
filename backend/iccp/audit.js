// ---------------------------------------------------------------------------
// In-memory audit log for ICCP decisions
// ---------------------------------------------------------------------------
const auditLog = [];

/**
 * Record an ICCP enforcement event.
 * Accepts any extra fields (endpoint, user_id, etc.) via spread.
 */
function logEvent(event) {
  auditLog.push({
    ...event,
    timestamp: new Date().toISOString(),
  });

  // Cap at 1 000 entries so memory stays bounded
  if (auditLog.length > 1000) {
    auditLog.splice(0, auditLog.length - 1000);
  }
}

/**
 * Return the most recent `limit` log entries.
 */
function getRecentLogs(limit = 50) {
  return auditLog.slice(-limit);
}

module.exports = { logEvent, getRecentLogs };
