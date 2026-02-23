// ---------------------------------------------------------------------------
// Build a CCP-compliant Context Packet
// ---------------------------------------------------------------------------
const { hashPolicy } = require("../utils/hashPolicy");

function buildContextPacket({ trace_id, identityScope, authorizedResources, contextConstraints }) {
  return {
    ccp_version: "1.0",
    trace_id,
    identity_scope: identityScope,
    selected_model: {
      model_id: "mock-model",
      provider: "none",
      risk_level: "low",
    },
    authorized_resources: authorizedResources,
    context_constraints: contextConstraints,
    policy_hash: hashPolicy(),
  };
}

module.exports = { buildContextPacket };
