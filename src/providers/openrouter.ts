import { LLMProvider, getJson, postJson } from "./base";
import { LLMRequest, LLMResponse } from "../types";

/**
 * Provider for OpenRouter — a unified gateway that routes to many models.
 * See https://openrouter.ai for available model IDs.
 */
export class OpenRouterProvider implements LLMProvider {
  private readonly baseUrl = "https://openrouter.ai/api/v1";

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  /** @inheritdoc */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const data = (await postJson(
      `${this.baseUrl}/chat/completions`,
      {
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "obsidian://writer-rewriter",
        "X-Title": "Writer Rewriter Plugin",
      },
      {
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        max_tokens: request.maxTokens ?? 1024,
      },
      "OpenRouter API error"
    )) as { choices: { message: { content: string } }[] };

    return { text: data.choices[0].message.content ?? "" };
  }

  /**
   * Fetches all models available via OpenRouter.
   * Returns an empty array if the request fails.
   */
  async listModels(): Promise<string[]> {
    const data = await getJson(`${this.baseUrl}/models`, {
      Authorization: `Bearer ${this.apiKey}`,
    }) as { data: { id: string }[] } | null;
    if (!data) return [];
    return data.data.map((m) => m.id).sort();
  }
}
