import { LLMProvider, getJson, postJson } from "./base";
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
        temperature: request.temperature ?? 0.7,
      },
      "Mistral API error"
    )) as { choices: { message: { content: string } }[] };

    return { text: data.choices[0].message.content ?? "" };
  }

  /**
   * Fetches available models from the Mistral `/models` endpoint.
   * Returns an empty array if the request fails.
   *
   * Filters to include only text generation models (excludes embedding,
   * moderation, and multimodal models like pixtral and voxtral).
   */
  async listModels(): Promise<string[]> {
    const data = await getJson(`${this.baseUrl}/models`, {
      Authorization: `Bearer ${this.apiKey}`,
    }) as { data: { id: string }[] } | null;
    if (!data) return [];

    // Exclude known non-text model prefixes
    const nonTextPrefixes = ["pixtral", "voxtral", "mistral-embed", "moderation"];
    return data.data
      .map((m) => m.id)
      .filter((id) => !nonTextPrefixes.some((prefix) => id.toLowerCase().startsWith(prefix)))
      .sort();
  }
}
