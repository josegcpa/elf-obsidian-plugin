import { PluginSettings, ProviderType } from "../types";
import { LLMProvider } from "./base";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { MistralProvider } from "./mistral";
import { OllamaProvider } from "./ollama";
import { OpenRouterProvider } from "./openrouter";

/**
 * Instantiate the correct `LLMProvider` for the given plugin settings.
 *
 * @param settings - Current plugin settings.
 * @returns A ready-to-use provider instance.
 * @throws If `settings.provider` is not a recognised `ProviderType`.
 */
export function createProvider(settings: PluginSettings): LLMProvider {
  const { provider, model, apiKeys, ollamaBaseUrl } = settings;
  const apiKey = (apiKeys ?? {})[provider] ?? "";

  switch (provider as ProviderType) {
    case "openai":
      return new OpenAIProvider(apiKey, model);
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "google":
      return new GoogleProvider(apiKey, model);
    case "mistral":
      return new MistralProvider(apiKey, model);
    case "ollama":
      return new OllamaProvider(ollamaBaseUrl, model);
    case "openrouter":
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/** Sensible default model for each provider, used when switching providers in settings. */
export const PROVIDER_DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  google: "gemini-1.5-flash",
  mistral: "mistral-small-latest",
  ollama: "llama3",
  openrouter: "openai/gpt-4o-mini",
};
