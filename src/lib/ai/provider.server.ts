// AI Provider abstraction — server-only.
// Configure via env: AI_PROVIDER=lovable|openai|anthropic|gemini|groq
// Keys: LOVABLE_API_KEY (default), OPENAI_API_KEY, ANTHROPIC_API_KEY,
//       GEMINI_API_KEY, GROQ_API_KEY. Optional AI_MODEL override.

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type ProviderId = "lovable" | "openai" | "anthropic" | "gemini" | "groq";

const DEFAULT_MODELS: Record<ProviderId, string> = {
  lovable: "google/gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
};

function pickProvider(): { id: ProviderId; apiKey: string; model: string } {
  const id = ((process.env.AI_PROVIDER as ProviderId) || "lovable") as ProviderId;
  const model = process.env.AI_MODEL || DEFAULT_MODELS[id];
  const keyEnv: Record<ProviderId, string> = {
    lovable: "LOVABLE_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    groq: "GROQ_API_KEY",
  };
  const apiKey = process.env[keyEnv[id]];
  if (!apiKey) throw new Error(`Missing ${keyEnv[id]} for provider "${id}"`);
  return { id, apiKey, model };
}

async function openAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  json: boolean,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function anthropicChat(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  json: boolean,
): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: json ? `${system}\n\nReturn ONLY valid JSON.` : system,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.[0]?.text ?? "";
}

async function geminiChat(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  json: boolean,
): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: json ? { responseMimeType: "application/json" } : {},
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function aiChat(opts: {
  system?: string;
  user: string;
  json?: boolean;
}): Promise<string> {
  const { id, apiKey, model } = pickProvider();
  const messages: ChatMsg[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });

  switch (id) {
    case "lovable":
      return openAICompatible("https://ai.gateway.lovable.dev/v1", apiKey, model, messages, !!opts.json);
    case "openai":
      return openAICompatible("https://api.openai.com/v1", apiKey, model, messages, !!opts.json);
    case "groq":
      return openAICompatible("https://api.groq.com/openai/v1", apiKey, model, messages, !!opts.json);
    case "anthropic":
      return anthropicChat(apiKey, model, messages, !!opts.json);
    case "gemini":
      return geminiChat(apiKey, model, messages, !!opts.json);
  }
}

export async function aiJSON<T = unknown>(opts: { system?: string; user: string }): Promise<T> {
  const text = await aiChat({ ...opts, json: true });
  const trimmed = text.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Fallback: extract first JSON object
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error(`AI did not return valid JSON: ${trimmed.slice(0, 200)}`);
  }
}

export function activeProvider(): ProviderId {
  return ((process.env.AI_PROVIDER as ProviderId) || "lovable") as ProviderId;
}
