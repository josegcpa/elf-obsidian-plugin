import { LLMProvider, postJson } from "./base";
import { LLMRequest, LLMResponse } from "../types";


/** Provider for the Google Generative Language (Gemini) API. */
export class GoogleProvider implements LLMProvider {
  private readonly generateBaseUrl =
    "https://generativelanguage.googleapis.com/v1beta/models";
  private readonly listBaseUrl =
    "https://generativelanguage.googleapis.com/v1/models";

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  /** @inheritdoc */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.generateBaseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const data = (await postJson(
      url,
      {},
      {
        system_instruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: { maxOutputTokens: request.maxTokens ?? 1024 },
      },
      "Google API error"
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };

    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
  }

  /**
   * Fetches available models from the Google ListModels endpoint,
   * filtered to those that support `generateContent`.
   * Returns an empty array if the request fails.
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(
      `${this.listBaseUrl}?key=${this.apiKey}`
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .sort();
  }
}
