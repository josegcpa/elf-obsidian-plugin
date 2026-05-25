import { LLMProvider, getJson, postJson } from "./base";
import { LLMRequest, LLMResponse } from "../types";

/**
 * Provider for the OpenAI chat-completions API.
 * Also supports any OpenAI-compatible endpoint via the optional `baseUrl` parameter.
 */
export class OpenAIProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string = "https://api.openai.com/v1"
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
      "OpenAI API error"
    )) as { choices: { message: { content: string } }[] };

    return { text: data.choices[0].message.content ?? "" };
  }

  /**
   * Fetches available GPT models from the OpenAI `/models` endpoint.
   * Returns an empty array if the request fails.
   *
   * Filters to include only text generation models (excludes DALL-E, TTS,
   * Whisper, embedding models, and other non-chat models).
   */
  async listModels(): Promise<string[]> {
    const data = await getJson(`${this.baseUrl}/models`, {
      Authorization: `Bearer ${this.apiKey}`,
    }) as { data: { id: string }[] } | null;
    if (!data) return [];

    // Include GPT and O-series models, exclude known non-text prefixes
    const textPrefixes = ["gpt", "o1", "o3"];
    const nonTextPatterns = [
      "dall-e", "tts", "whisper", 
      "embedding", "text-embedding", 
      "babbage", "davinci",
      "audio", "transcribe", 
      "realtime", "-image-",
    ];

    return data.data
      .map((m) => m.id)
      .filter((id) => {
        const lowerId = id.toLowerCase();
        // Must start with a text model prefix
        if (!textPrefixes.some((p) => lowerId.startsWith(p))) return false;
        // Must NOT match non-text patterns
        if (nonTextPatterns.some((p) => lowerId.includes(p))) return false;
        return true;
      })
      .sort();
  }
}
