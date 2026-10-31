import Anthropic from "@anthropic-ai/sdk";

// Server-side only. The API key is never sent to the browser.
export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.LLM_MODEL);
}

export async function* streamAnswer(system: string, messages: { role: "user" | "assistant"; content: string }[]) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });
  const stream = await client.messages.create({
    model: process.env.LLM_MODEL as string,
    max_tokens: 1024,
    system,
    messages,
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
}
