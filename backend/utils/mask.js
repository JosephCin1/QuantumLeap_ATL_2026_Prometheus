// ---------------------------------------------------------------------------
// Field-level masking utilities
// ---------------------------------------------------------------------------

/**
 * SSN → "***-**-6789"  (show last 4 only)
 */
function maskSsn(value) {
  if (value == null) return value;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return "***-**-" + digits.slice(-4);
}

/**
 * GPA → range string   e.g. 3.2 → "3.0-3.5"
 * Only applied when role is NOT Registrar.
 */
function gpaToRange(gpa) {
  const num = parseFloat(gpa);
  if (isNaN(num)) return gpa;
  const lower = Math.floor(num * 2) / 2;   // round down to nearest 0.5
  const upper = lower + 0.5;
  return `${lower.toFixed(1)}-${upper.toFixed(1)}`;
}

/**
 * Apply masking rules to a data object.
 * @param {object}   data           – raw resource data
 * @param {string[]} maskFieldsList – fields that must always be masked (from descriptor)
 * @param {string}   role           – caller's role (controls GPA masking)
 */
function maskFields(data, maskFieldsList, role) {
  const masked = { ...data };

  for (const field of maskFieldsList) {
    if (field === "ssn" && masked.ssn !== undefined) {
      masked.ssn = maskSsn(masked.ssn);
    }
  }

  // GPA → range unless Registrar
  if (role !== "Registrar" && masked.gpa !== undefined) {
    masked.gpa = gpaToRange(masked.gpa);
  }

  return masked;
}

module.exports = { maskSsn, gpaToRange, maskFields };
