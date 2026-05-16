import { LLMProvider, postJson } from "./base";
import { LLMRequest, LLMResponse } from "../types";

/** Provider for the Anthropic Messages API. */
export class AnthropicProvider implements LLMProvider {
  private readonly baseUrl = "https://api.anthropic.com/v1";

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  /** @inheritdoc */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const data = (await postJson(
      `${this.baseUrl}/messages`,
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      {
        model: this.model,
        max_tokens: request.maxTokens ?? 1024,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
      },
      "Anthropic API error"
    )) as { content?: { text?: string }[] };

    return { text: data.content?.[0]?.text ?? "" };
  }

  /**
   * Fetches available models from the Anthropic `/v1/models` endpoint.
   * Returns an empty array if the request fails.
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { data: { id: string }[] };
    return data.data.map((m) => m.id).sort();
  }
}
