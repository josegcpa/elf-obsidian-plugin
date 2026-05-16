/**
 * Integration tests for provider model calls.
 * Requires API keys to be set in environment variables:
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY,
 *   MISTRAL_API_KEY, OPENROUTER_API_KEY
 * Ollama tests require a running local Ollama instance.
 */

import { OpenAIProvider } from "../providers/openai";
import { AnthropicProvider } from "../providers/anthropic";
import { GoogleProvider } from "../providers/google";
import { MistralProvider } from "../providers/mistral";
import { OllamaProvider } from "../providers/ollama";
import { OpenRouterProvider } from "../providers/openrouter";

const SIMPLE_REQUEST = {
  systemPrompt: "Reply with one word only.",
  userPrompt: "Say 'hi'.",
  maxTokens: 10,
};

describe("OpenAI provider", () => {
  const key = process.env.OPENAI_API_KEY;
  const skip = !key;

  (skip ? it.skip : it)("completes a request", async () => {
    const provider = new OpenAIProvider(key!, "gpt-4.1-nano");
    const res = await provider.complete(SIMPLE_REQUEST);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(0);
  });

  (skip ? it.skip : it)("lists models", async () => {
    const provider = new OpenAIProvider(key!, "gpt-4.1-nano");
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    models.forEach((m) => expect(typeof m).toBe("string"));
  });
});

describe("Anthropic provider", () => {
  const key = process.env.ANTHROPIC_API_KEY;
  const skip = !key;

  (skip ? it.skip : it)("completes a request", async () => {
    const provider = new AnthropicProvider(key!, "claude-haiku-4-5");
    const res = await provider.complete(SIMPLE_REQUEST);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(0);
  });

  (skip ? it.skip : it)("lists models", async () => {
    const provider = new AnthropicProvider(key!, "claude-haiku-4-5");
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    models.forEach((m) => expect(typeof m).toBe("string"));
  });
});

describe("Google provider", () => {
  const key = process.env.GOOGLE_API_KEY;
  const skip = !key;
  const model_id = "gemini-2.5-flash";

  (skip ? it.skip : it)("completes a request", async () => {
    const provider = new GoogleProvider(key!, model_id);
    const res = await provider.complete(SIMPLE_REQUEST);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(0);
  });

  (skip ? it.skip : it)("lists models", async () => {
    const provider = new GoogleProvider(key!, model_id);
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    models.forEach((m) => expect(typeof m).toBe("string"));
  });
});

describe("Mistral provider", () => {
  const key = process.env.MISTRAL_API_KEY;
  const skip = !key;

  (skip ? it.skip : it)("completes a request", async () => {
    const provider = new MistralProvider(key!, "open-mistral-nemo");
    const res = await provider.complete(SIMPLE_REQUEST);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(0);
  });

  (skip ? it.skip : it)("lists models", async () => {
    const provider = new MistralProvider(key!, "open-mistral-nemo");
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    models.forEach((m) => expect(typeof m).toBe("string"));
  });
});

describe("Ollama provider", () => {
  const base = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_MODEL;

  let ollamaReachable = false;
  let ollamaHasModels = false;
  beforeAll(async () => {
    if (!base || !model) return;
    try {
      const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (!r.ok) return;
      ollamaReachable = true;
      const data = (await r.json()) as { models?: { name: string }[] };
      ollamaHasModels = (data.models ?? []).length > 0;
    } catch {
      ollamaReachable = false;
    }
  });

  it("lists models (skipped if unreachable)", async () => {
    if (!ollamaReachable) return;
    const provider = new OllamaProvider(base!, model!);
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    models.forEach((m) => expect(typeof m).toBe("string"));
  });

  it("completes a request (skipped if no models pulled)", async () => {
    if (!ollamaReachable || !ollamaHasModels) return;
    const provider = new OllamaProvider(base!, model!);
    const res = await provider.complete(SIMPLE_REQUEST);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(0);
  }, 15000);
});

describe("OpenRouter provider", () => {
  const key = process.env.OPENROUTER_API_KEY;
  const skip = !key;

  (skip ? it.skip : it)("completes a request", async () => {
    const provider = new OpenRouterProvider(key!, "google/gemini-2.0-flash-lite-001");
    const res = await provider.complete(SIMPLE_REQUEST);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(0);
  });

  (skip ? it.skip : it)("lists models", async () => {
    const provider = new OpenRouterProvider(key!, "google/gemini-2.0-flash-lite-001");
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThanOrEqual(3);
    models.forEach((m) => expect(typeof m).toBe("string"));
  });
});
