import { chatRequestSchema } from "@/lib/validation/schemas";
import { detectLanguage } from "@/lib/rag/language";
import { extractProfile, missingKeyFacts } from "@/lib/rag/profile";
import { retrieveForChat } from "@/lib/schemes/repository";
import { toCitation, toContext } from "@/lib/schemes/present";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { llmConfigured, streamAnswer } from "@/lib/ai/client";
import { takeLlmBudget } from "@/lib/ai/budget";
import { apiError, logError, readJsonLimited } from "@/lib/errors";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";
import type { SchemeView } from "@/lib/schemes/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Response is NDJSON: one JSON event per line.
// {type:"meta"} -> {type:"text"}* -> {type:"done"}   or   {type:"fallback"} when AI is unavailable.
export async function POST(req: Request) {
  const rl = rateLimit(`chat:${clientKey(req)}`, 15, 60_000);
  if (!rl.ok) return apiError("rate_limited", "Too many messages. Please wait a moment.", { "Retry-After": String(rl.retryAfterSec) });

  const body = await readJsonLimited(req, 64_000);
  if (body === "too_large") return apiError("too_large", "Conversation is too long. Start a new chat.");
  const parsed = chatRequestSchema.safeParse(body === "invalid" ? null : body);
  if (!parsed.success) return apiError("bad_request", "Message could not be read. Please try again.");

  const { messages, locale } = parsed.data;
  const last = messages[messages.length - 1].content;
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const language = detectLanguage(last);
  const profile = extractProfile(userText);
  const missing = missingKeyFacts(profile);

  let schemes: SchemeView[] = [];
  let searchFailed = false;
  try {
    // Search with the latest message plus earlier user turns, so follow-up answers keep context.
    schemes = await retrieveForChat(`${last} ${userText}`.slice(0, 1000), profile, 6);
  } catch (e) {
    logError("api/chat retrieve", e);
    searchFailed = true;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const fallback = (reason: string) => send({ type: "fallback", reason, schemes: schemes.map(toCitation) });

      send({ type: "meta", language, citations: schemes.map(toCitation) });
      if (searchFailed) { fallback("search_unavailable"); controller.close(); return; }
      if (!llmConfigured()) { fallback("ai_not_configured"); controller.close(); return; }
      if (!takeLlmBudget()) { fallback("ai_daily_limit"); controller.close(); return; }

      try {
        const system = buildSystemPrompt({ language, profile, missing, schemes: schemes.map((s) => toContext(s, locale)) });
        for await (const delta of streamAnswer(system, messages)) send({ type: "text", delta });
        send({ type: "done" });
      } catch (e) {
        logError("api/chat llm", e);
        fallback("ai_unavailable");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
