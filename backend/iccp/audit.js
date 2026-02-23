// ---------------------------------------------------------------------------
// In-memory audit log for ICCP decisions
// ---------------------------------------------------------------------------
const auditLog = [];

/**
 * Record an ICCP enforcement event.
 */
function logEvent({ trace_id, username, role, requested_resources, decision, reason }) {
  auditLog.push({
    trace_id,
    username,
    role,
    requested_resources,
    decision,
    reason,
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
