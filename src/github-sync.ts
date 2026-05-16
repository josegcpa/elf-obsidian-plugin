import { Prompt } from "./types";

/** Filename used inside the Gist for the prompt library. */
const GIST_FILENAME = "writer-rewriter-prompts.json";

/** GitHub REST API base URL for Gists. */
const GIST_API = "https://api.github.com/gists";

/**
 * Push the prompt library to a GitHub Gist.
 *
 * - Creates a **new** private Gist when `gistId` is empty.
 * - Patches an **existing** Gist when `gistId` is provided.
 *
 * @param prompts - Current prompt library to serialise.
 * @param token - GitHub personal access token (requires `gist` scope).
 * @param gistId - Existing Gist ID, or empty string to create a new one.
 * @returns The Gist ID (useful when a new Gist was created).
 * @throws On non-2xx HTTP responses.
 */
export async function pushPromptsToGist(
  prompts: Prompt[],
  token: string,
  gistId: string
): Promise<string> {
  const url = gistId ? `${GIST_API}/${gistId}` : GIST_API;

  const response = await fetch(url, {
    method: gistId ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      description: "Writer Rewriter Plugin – Prompt Library",
      public: false,
      files: {
        [GIST_FILENAME]: { content: JSON.stringify(prompts, null, 2) },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GitHub Gist sync failed (${response.status}): ${err}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

/**
 * Pull the prompt library from an existing GitHub Gist.
 *
 * @param token - GitHub personal access token (requires `gist` scope).
 * @param gistId - ID of the Gist to read from.
 * @returns Parsed array of `Prompt` objects.
 * @throws On non-2xx HTTP responses or if the expected file is missing.
 */
export async function pullPromptsFromGist(
  token: string,
  gistId: string
): Promise<Prompt[]> {
  const response = await fetch(`${GIST_API}/${gistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GitHub Gist pull failed (${response.status}): ${err}`);
  }

  const data = await response.json() as {
    files?: Record<string, { content?: string }>;
  };
  const fileContent = data.files?.[GIST_FILENAME]?.content;
  if (!fileContent) throw new Error("Prompt file not found in Gist.");
  return JSON.parse(fileContent) as Prompt[];
}
