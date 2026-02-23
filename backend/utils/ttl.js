// ---------------------------------------------------------------------------
// In-memory TTL cache for resource fetches
// Key: "resource_id:subject_id"   Value: { data, fetchedAt }
// ---------------------------------------------------------------------------
const cache = new Map();

/**
 * Return cached data if still within ttl, otherwise "refetch" (mock).
 */
function getFetchedResource(resourceId, subjectId, ttlSeconds) {
  const key = `${resourceId}:${subjectId}`;
  const entry = cache.get(key);

  if (entry) {
    const ageSeconds = (Date.now() - entry.fetchedAt) / 1000;
    if (ageSeconds < ttlSeconds) {
      return { data: entry.data, fromCache: true, fetchedAt: entry.fetchedAt };
    }
    cache.delete(key);          // expired → drop
  }

  // Mock fetch
  const data = mockFetch(resourceId, subjectId);
  const now = Date.now();
  cache.set(key, { data, fetchedAt: now });
  return { data, fromCache: false, fetchedAt: now };
}

// ---------------------------------------------------------------------------
// Mock data generator (replace with real SIS calls later)
// ---------------------------------------------------------------------------
function mockFetch(resourceId, subjectId) {
  if (resourceId === "student-grades") {
    return {
      subject_id: subjectId,
      resource_id: resourceId,
      ssn: "123-45-6789",
      gpa: 3.2,
      grades: [
        { course: "CS101", grade: "A" },
        { course: "MATH201", grade: "B+" },
      ],
    };
  }

  if (resourceId === "student-discipline") {
    return {
      subject_id: subjectId,
      resource_id: resourceId,
      ssn: "123-45-6789",
      records: [
        { date: "2025-09-15", type: "warning", description: "Academic integrity violation" },
      ],
    };
  }

  return { subject_id: subjectId, resource_id: resourceId };
}

module.exports = { getFetchedResource };
