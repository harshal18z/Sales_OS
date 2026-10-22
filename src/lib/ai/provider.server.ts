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
  gemini: "gemini-3.5-flash-lite",
  groq: "llama-3.3-70b-versatile",
};

export function pickProvider(): { id: ProviderId; apiKey: string; model: string } {
  let id = process.env.AI_PROVIDER as ProviderId;
  if (!id) {
    if (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY) id = "gemini";
    else if (process.env.OPENAI_API_KEY) id = "openai";
    else if (process.env.ANTHROPIC_API_KEY) id = "anthropic";
    else if (process.env.GROQ_API_KEY) id = "groq";
    else if (process.env.LOVABLE_API_KEY) id = "lovable";
    else id = "gemini";
  }
  const model = process.env.AI_MODEL || DEFAULT_MODELS[id] || "gemini-3.5-flash-lite";
  const keyEnv: Record<ProviderId, string> = {
    lovable: "LOVABLE_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    groq: "GROQ_API_KEY",
  };
  const apiKey =
    process.env[keyEnv[id]] ||
    (id === "gemini" ? process.env.VITE_GEMINI_API_KEY : undefined) ||
    process.env.GEMINI_API_KEY;
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
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
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
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
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
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("");
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
      return openAICompatible(
        "https://ai.gateway.lovable.dev/v1",
        apiKey,
        model,
        messages,
        !!opts.json,
      );
    case "openai":
      return openAICompatible("https://api.openai.com/v1", apiKey, model, messages, !!opts.json);
    case "groq":
      return openAICompatible(
        "https://api.groq.com/openai/v1",
        apiKey,
        model,
        messages,
        !!opts.json,
      );
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

export async function streamAI(opts: {
  system?: string;
  user: string;
  onToken: (token: string) => void;
}): Promise<string> {
  const { id, apiKey, model } = pickProvider();
  const messages: ChatMsg[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });

  if (id === "gemini") {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const parts = j.candidates?.[0]?.content?.parts || [];
          for (const p of parts) {
            if (p.text) {
              full += p.text;
              opts.onToken(p.text);
            }
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
    return full;
  }

  const baseUrls: Record<string, string> = {
    lovable: "https://ai.gateway.lovable.dev/v1",
    openai: "https://api.openai.com/v1",
    groq: "https://api.groq.com/openai/v1",
  };
  const baseUrl = baseUrls[id];
  if (baseUrl) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`AI ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return full;
        try {
          const j = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            opts.onToken(delta);
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
    return full;
  }

  // Fallback for providers without streaming (e.g. anthropic)
  const full = await aiChat({ system: opts.system, user: opts.user });
  opts.onToken(full);
  return full;
}

export function activeProvider(): ProviderId {
  return pickProvider().id;
}
