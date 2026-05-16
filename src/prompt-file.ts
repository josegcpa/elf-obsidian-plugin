import { App, TFile } from "obsidian";
import { DEFAULT_PROMPTS, ModeType, Prompt } from "./types";

/** Path of the prompt library file relative to the vault root. */
export const PROMPTS_FILE_PATH = "prompts.md";

/**
 * Serialise a prompt array to the `prompts.md` format.
 *
 * Format per prompt:
 * ```
 * ## <name>
 *
 * mode: <mode>
 * id: <id>
 *
 * ### System prompt
 *
 * <systemPrompt>
 *
 * ### User prompt
 *
 * <userPromptTemplate>
 * ```
 * Prompts are separated by `---`.
 */
export function serialisePrompts(prompts: Prompt[]): string {
  const header =
    "<!-- Writer Rewriter prompt library — edit freely, the plugin will reload on save -->\n\n";

  const blocks = prompts.map((p) =>
    [
      `## ${p.name}`,
      "",
      `mode: ${p.mode}`,
      `id: ${p.id}`,
      "",
      "### System prompt",
      "",
      p.systemPrompt,
      "",
      "### User prompt",
      "",
      p.userPromptTemplate,
    ].join("\n")
  );

  return header + blocks.join("\n\n---\n\n") + "\n";
}

/**
 * Parse a `prompts.md` string back to a `Prompt[]`.
 * Returns `DEFAULT_PROMPTS` if the file is empty or malformed.
 */
export function parsePrompts(content: string): Prompt[] {
  const blocks = content
    .replace(/^<!--[\s\S]*?-->\n*/m, "")
    .split(/\n---\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) return DEFAULT_PROMPTS;

  const results: Prompt[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");

    const nameLine = lines.find((l) => l.startsWith("## "));
    if (!nameLine) continue;
    const name = nameLine.slice(3).trim();

    const modeLine = lines.find((l) => l.startsWith("mode: "));
    const idLine = lines.find((l) => l.startsWith("id: "));
    const mode = (modeLine?.slice(6).trim() ?? "rewrite") as ModeType;
    const id =
      idLine?.slice(4).trim() ??
      `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const sysSepIdx = lines.findIndex((l) => l === "### System prompt");
    const userSepIdx = lines.findIndex((l) => l === "### User prompt");

    const systemPrompt =
      sysSepIdx >= 0
        ? lines
            .slice(sysSepIdx + 1, userSepIdx >= 0 ? userSepIdx : undefined)
            .join("\n")
            .trim()
        : "";

    const userPromptTemplate =
      userSepIdx >= 0
        ? lines
            .slice(userSepIdx + 1)
            .join("\n")
            .trim()
        : "";

    results.push({ id, name, mode, systemPrompt, userPromptTemplate });
  }

  return results.length > 0 ? results : DEFAULT_PROMPTS;
}

/**
 * Read the prompts file from the vault, creating it with defaults if absent.
 *
 * @param app - The Obsidian App instance.
 * @param filePath - Vault-relative path (defaults to `PROMPTS_FILE_PATH`).
 * @returns Parsed prompt array.
 */
export async function loadPromptsFile(
  app: App,
  filePath = PROMPTS_FILE_PATH
): Promise<Prompt[]> {
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof TFile) {
    const content = await app.vault.read(existing);
    return parsePrompts(content);
  }
  const defaults = DEFAULT_PROMPTS;
  await app.vault.create(filePath, serialisePrompts(defaults));
  return defaults;
}

/**
 * Write the prompt array to the prompts file, creating or overwriting as needed.
 *
 * @param app - The Obsidian App instance.
 * @param prompts - The prompt array to persist.
 * @param filePath - Vault-relative path (defaults to `PROMPTS_FILE_PATH`).
 */
export async function savePromptsFile(
  app: App,
  prompts: Prompt[],
  filePath = PROMPTS_FILE_PATH
): Promise<void> {
  const content = serialisePrompts(prompts);
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}
