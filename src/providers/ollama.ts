import { LLMProvider, postJson } from "./base";
import { LLMRequest, LLMResponse } from "../types";

/**
 * Provider for a locally-running Ollama server.
 * No API key required — configure the base URL in settings.
 */
export class OllamaProvider implements LLMProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  /** @inheritdoc */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const data = (await postJson(
      `${this.baseUrl}/api/chat`,
      {},
      {
        model: this.model,
        stream: false,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        options: { num_predict: request.maxTokens ?? 1024 },
      },
      "Ollama API error"
    )) as { message?: { content?: string } };

    return { text: data.message?.content ?? "" };
  }

  /**
   * Lists models currently pulled in the local Ollama instance.
   * Returns an empty array when Ollama is not running.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json() as { models: { name: string }[] };
      return data.models.map((m) => m.name).sort();
    } catch {
      return [];
    }
  }
}
