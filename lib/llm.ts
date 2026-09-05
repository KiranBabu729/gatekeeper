import Anthropic from "@anthropic-ai/sdk";

/**
 * Single seam for every LLM call in the app. `GATEKEEPER_USE_STUB_LLM=true`
 * (the default until a real ANTHROPIC_API_KEY is set) routes every call
 * through deterministic fakes so the pipeline runs end-to-end with zero
 * API cost. Flip the env var off once a real key is in .env.local — no
 * caller code changes.
 */

const MODEL = "claude-sonnet-4-6";
const useStub = process.env.GATEKEEPER_USE_STUB_LLM !== "false";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function callStructuredLLM<T>(opts: {
  system: string;
  prompt: string;
  schema: { parse: (v: unknown) => T };
  stubResponse: () => T;
}): Promise<T> {
  if (useStub) return opts.stubResponse();

  const anthropic = getClient();
  const attempt = async () => {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : text;
    return opts.schema.parse(JSON.parse(raw));
  };

  try {
    return await attempt();
  } catch {
    return await attempt(); // one retry on parse failure, per spec
  }
}

export const GATEKEEPER_MODEL = useStub ? "stub-deterministic" : MODEL;
