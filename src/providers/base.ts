import { LLMRequest, LLMResponse } from "../types";

/**
 * Common interface implemented by every provider.
 * Adding a new provider requires only implementing these two methods.
 */
export interface LLMProvider {
  /**
   * Send a completion request and return the generated text.
   *
   * @param request - The system prompt, user prompt, and optional token limit.
   * @returns The model's response.
   * @throws If the HTTP request fails or the response is malformed.
   */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Return the list of model identifiers available for this provider.
   * Returns an empty array when the list cannot be fetched (e.g. no key).
   */
  listModels(): Promise<string[]>;
}

/**
 * Send a JSON POST request and return the parsed response body.
 *
 * @param url - Target URL.
 * @param headers - HTTP headers (Content-Type is always set to application/json).
 * @param body - Request payload (will be JSON-serialised).
 * @param errorPrefix - Prefix used in the thrown error message on non-2xx status.
 * @returns Parsed JSON response.
 * @throws If the server returns a non-2xx status.
 */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  errorPrefix: string
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${errorPrefix} (${response.status}): ${text}`);
  }

  return response.json();
}
