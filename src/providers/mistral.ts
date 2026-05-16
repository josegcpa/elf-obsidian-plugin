import { LLMProvider, postJson } from "./base";
import { LLMRequest, LLMResponse } from "../types";

/** Provider for the Mistral AI chat-completions API. */
export class MistralProvider implements LLMProvider {
  private readonly baseUrl = "https://api.mistral.ai/v1";

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  /** @inheritdoc */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const data = (await postJson(
      `${this.baseUrl}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        max_tokens: request.maxTokens ?? 1024,
      },
      "Mistral API error"
    )) as { choices: { message: { content: string } }[] };

    return { text: data.choices[0].message.content ?? "" };
  }

  /**
   * Fetches available models from the Mistral `/models` endpoint.
   * Returns an empty array if the request fails.
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json() as { data: { id: string }[] };
    return data.data.map((m) => m.id).sort();
  }
}
