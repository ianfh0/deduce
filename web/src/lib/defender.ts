// defender.ts — calls Anthropic API to run the defender AI

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function callDefender(
  systemPrompt: string,
  model: string,
  messages: Message[]
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// build anthropic messages from conversation history
export function buildMessages(
  conversation: { role: "attacker" | "defender"; content: string }[]
): Message[] {
  return conversation.map((turn) => ({
    role: turn.role === "attacker" ? "user" : "assistant",
    content: turn.content,
  }));
}
