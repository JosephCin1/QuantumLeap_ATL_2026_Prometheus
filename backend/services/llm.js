// ---------------------------------------------------------------------------
// LLM Service – generates AI answers from governed context
// Falls back to a smart mock when OPENAI_API_KEY is not set.
// ---------------------------------------------------------------------------
const OpenAI = require("openai");

/**
 * @param {object} opts
 * @param {string} opts.prompt          – user's original question
 * @param {Array}  opts.governedContext  – masked resource data
 * @param {string} opts.traceId         – ICCP trace id
 * @param {object} opts.identityScope   – caller identity
 * @param {Array}  opts.constraints     – active context constraints
 * @returns {Promise<string>}           – plain-text answer
 */
async function generateAnswer({ prompt, governedContext, traceId, identityScope, constraints }) {
  // ── No key → intelligent mock ──────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-openai-api-key-here") {
    return buildMockAnswer({ prompt, governedContext, traceId, identityScope, constraints });
  }

  // ── Real OpenAI call ───────────────────────────────────────────────────
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const systemMessage = [
    "You are an ICCP-governed AI assistant for a university.",
    "You may ONLY use the governed context provided below to answer the user's question.",
    "Do NOT invent data. If the context does not contain enough information, say so.",
    "Be concise and helpful.",
  ].join(" ");

  const userMessage = [
    `[trace_id: ${traceId}]`,
    `[user: ${identityScope.username} | role: ${identityScope.role}]`,
    `[constraints: ${constraints.join(", ")}]`,
    "",
    "--- GOVERNED CONTEXT (masked) ---",
    JSON.stringify(governedContext, null, 2),
    "--- END CONTEXT ---",
    "",
    `User question: ${prompt}`,
  ].join("\n");

  try {
    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
    });

    return response.output_text || "(No response from model)";
  } catch (err) {
    console.error("[LLM] OpenAI error:", err.message);
    return `[LLM_ERROR] Could not reach model. trace_id=${traceId}. Falling back: ${buildMockAnswer({ prompt, governedContext, traceId, identityScope, constraints })}`;
  }
}

// ---------------------------------------------------------------------------
// Mock answer – summarises governed context without hardcoding domain answers
// ---------------------------------------------------------------------------
function buildMockAnswer({ prompt, governedContext, traceId, identityScope, constraints }) {
  const resourceSummary = governedContext
    .map((r) => `${r.resource_id || "unknown_resource"} for subject ${r.subject_id || "?"}`)
    .join("; ");

  return [
    `[MOCK LLM] trace_id=${traceId}`,
    `Role: ${identityScope.role} (${identityScope.username})`,
    `Constraints applied: ${constraints.join(", ")}`,
    `Data available: ${resourceSummary}`,
    `Your question: "${prompt}"`,
    `— This is a mock response. Connect an OpenAI API key for real answers.`,
  ].join("\n");
}

module.exports = { generateAnswer, generateVisionAnswer };

// ---------------------------------------------------------------------------
// Vision answer – analyses an uploaded image via OpenAI Responses API
// Falls back to mock when OPENAI_API_KEY is not set.
// ---------------------------------------------------------------------------
/**
 * @param {object}  opts
 * @param {string}  opts.prompt         – user question about the image
 * @param {Buffer}  opts.imageBuffer    – raw image bytes
 * @param {string}  opts.imageMimeType  – e.g. "image/png"
 * @param {string}  opts.traceId        – ICCP trace id
 * @param {object}  opts.identityScope  – caller identity
 * @param {Array}   opts.constraints    – context constraints
 * @returns {Promise<string>}           – plain-text answer
 */
async function generateVisionAnswer({ prompt, imageBuffer, imageMimeType, traceId, identityScope, constraints }) {
  const noKey = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-openai-api-key-here";

  if (noKey) {
    return [
      `[MOCK VISION] trace_id=${traceId}`,
      `Role: ${identityScope.role} (${identityScope.username})`,
      `Constraints: ${constraints.join(", ")}`,
      `Image received: ${(imageBuffer.length / 1024).toFixed(1)} KB (${imageMimeType})`,
      `Prompt: "${prompt}"`,
      `— No API key configured. This is a mock vision response.`,
    ].join("\n");
  }

  // ── Real OpenAI vision call ────────────────────────────────────────────
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model  = process.env.OPENAI_MODEL_VISION || "gpt-4o";

  const base64Image = imageBuffer.toString("base64");
  const dataUrl     = `data:${imageMimeType};base64,${base64Image}`;

  const systemMessage = [
    "You are an ICCP-governed AI assistant for a university with vision capabilities.",
    "Analyse the provided image using ONLY what is visible.",
    "Do NOT invent information. Be concise and helpful.",
  ].join(" ");

  try {
    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: systemMessage },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `[trace_id: ${traceId}]`,
                `[user: ${identityScope.username} | role: ${identityScope.role}]`,
                `[constraints: ${constraints.join(", ")}]`,
                "",
                `Question: ${prompt}`,
              ].join("\n"),
            },
            {
              type: "input_image",
              image_url: dataUrl,
            },
          ],
        },
      ],
    });

    return response.output_text || "(No response from vision model)";
  } catch (err) {
    console.error("[LLM-VISION] OpenAI error:", err.message);
    return `[LLM_VISION_ERROR] Could not reach vision model. trace_id=${traceId}. Error: ${err.message}`;
  }
}
