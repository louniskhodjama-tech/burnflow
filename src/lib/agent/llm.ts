import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

/**
 * Client LLM unique de la plateforme (GOAL §Agent IA).
 * - Serveur uniquement, jamais depuis le navigateur.
 * - Jamais de donnée nominative (la plateforme n'en stocke pas).
 * - Toutes les capacités sont suggestives et fail-open.
 */

export const LLM_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getLLM(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

const promptCache = new Map<string, string>();

/** Charge un prompt versionné depuis lib/agent/prompts/<name>.md */
export function loadPrompt(name: string): string {
  const cached = promptCache.get(name);
  if (cached) return cached;
  const p = path.join(process.cwd(), "src", "lib", "agent", "prompts", `${name}.md`);
  const content = fs.readFileSync(p, "utf8");
  promptCache.set(name, content);
  return content;
}

/**
 * Appel texte simple, température basse, avec timeout.
 * Retourne null en cas d'échec quelconque (fail-open pour l'appelant).
 */
export async function askLLM(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const llm = getLLM();
  if (!llm) return null;
  try {
    const res = await llm.messages.create(
      {
        model: LLM_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: 0.2,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      },
      { timeout: opts.timeoutMs ?? 20_000 },
    );
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : null;
  } catch (err) {
    console.error("[agent] appel LLM en échec :", err);
    return null;
  }
}

/** Extrait le premier objet JSON d'une réponse (tolère les fences markdown). */
export function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
