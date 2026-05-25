import { App, TFile } from "obsidian";
import { DEFAULT_PROMPTS, DEFAULT_SYSTEM_PROMPTS, DefaultSystemPrompts, ModeType, Prompt } from "./types";

/** Path of the prompt library file relative to the vault root. */
export const PROMPTS_FILE_PATH = "prompts.md";

/**
 * Convert a human-readable prompt name to a URL/id-safe slug.
 *
 * @param name - Display name (e.g. `"My Prompt"`).
 * @returns Lowercase hyphen-separated slug (e.g. `"my-prompt"`).
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Assign stable, deduplicated slug IDs to a list of prompts.
 * Duplicate slugs get a numeric suffix (`"my-prompt"`, `"my-prompt-2"`, …).
 *
 * @param prompts - Prompts without IDs (or with stale ones).
 * @returns New array with `id` set on every prompt.
 */
export function assignIds(prompts: Omit<Prompt, "id">[]): Prompt[] {
  const seen = new Map<string, number>();
  return prompts.map((p) => {
    const base = nameToSlug(p.name) || "prompt";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return { ...p, id } as Prompt;
  });
}

/**
 * Serialise a prompt array to the `prompts.md` format.
 *
 * Format:
 * ```
 * ---
 * default_system_prompts:
 *   collaborate: "..."
 *   rewrite: "..."
 *   variations: "..."
 * ---
 *
 * ## <name>
 *
 * mode: <mode>
 *
 * ### System prompt
 *
 * <systemPrompt>   (omitted when empty — default will be used)
 *
 * ### User prompt
 *
 * <userPromptTemplate>
 * ```
 * Prompts are separated by `---`.
 */
export function serialisePrompts(
  prompts: Prompt[],
  defaultSystemPrompts = DEFAULT_SYSTEM_PROMPTS
): string {
  const yamlValue = (s: string) => JSON.stringify(s);
  const frontMatter = [
    "---",
    `default_system_prompt_collaborate: ${yamlValue(defaultSystemPrompts.collaborate)}`,
    `default_system_prompt_rewrite: ${yamlValue(defaultSystemPrompts.rewrite)}`,
    `default_system_prompt_variations: ${yamlValue(defaultSystemPrompts.variations)}`,
    "---",
    "",
    "<!-- Elf prompt library — edit freely, the plugin will reload on save -->",
    "",
  ].join("\n");

  const blocks = prompts.map((p) => {
    const lines = [
      `## ${p.name}`,
      "",
      `mode: ${p.mode}`,
    ];
    if (p.systemPrompt) {
      lines.push("", "### System prompt", "", p.systemPrompt);
    }
    lines.push("", "### User prompt", "", p.userPromptTemplate);
    return lines.join("\n");
  });

  return frontMatter + blocks.join("\n\n---\n\n") + "\n";
}

/**
 * Extract the YAML front-matter block from a markdown string (between `---` fences).
 * Returns `null` if no front-matter is present.
 *
 * @param content - Raw file content.
 * @returns The raw YAML string (without the `---` delimiters), or `null`.
 */
function extractFrontMatter(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  return match ? match[1] : null;
}

/**
 * Parse the `default_system_prompts` block from a YAML front-matter string.
 * Falls back to `DEFAULT_SYSTEM_PROMPTS` for any missing key.
 *
 * Only handles the simple `key: "value"` / `key: 'value'` form produced by
 * `serialisePrompts` — no full YAML parser required.
 *
 * @param yaml - Raw YAML string.
 * @returns Parsed `DefaultSystemPrompts`.
 */
function parseFrontMatterSystemPrompts(yaml: string): DefaultSystemPrompts {
  const result = { ...DEFAULT_SYSTEM_PROMPTS };
  const mapping: Record<string, keyof DefaultSystemPrompts> = {
    default_system_prompt_collaborate: "collaborate",
    default_system_prompt_rewrite: "rewrite",
    default_system_prompt_variations: "variations",
  };
  for (const [flatKey, modeKey] of Object.entries(mapping)) {
    const re = new RegExp(`^${flatKey}:\\s*(['"])([\\s\\S]*?)\\1\\s*$`, "m");
    const m = yaml.match(re);
    if (m) {
      try {
        result[modeKey] = JSON.parse(`"${m[2].replace(/"/g, '\\"').replace(/\\'/g, "'")}"`);
      } catch {
        result[modeKey] = m[2];
      }
    }
  }
  return result;
}

/**
 * Parse a `prompts.md` string back to a `Prompt[]` and the default system prompts.
 * Returns defaults if the file is empty or malformed.
 *
 * @param content - Raw file content.
 * @returns Object with `prompts` array and resolved `defaultSystemPrompts`.
 */
export function parsePrompts(content: string): {
  prompts: Prompt[];
  defaultSystemPrompts: DefaultSystemPrompts;
} {
  const fm = extractFrontMatter(content);
  const defaultSystemPrompts = fm
    ? parseFrontMatterSystemPrompts(fm)
    : { ...DEFAULT_SYSTEM_PROMPTS };

  const bodyStart = fm ? content.indexOf("\n---\n") + 5 : 0;
  const body = content
    .slice(bodyStart)
    .replace(/^<!--[\s\S]*?-->\n*/m, "")
    .split(/\n---\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (body.length === 0) return { prompts: DEFAULT_PROMPTS, defaultSystemPrompts };

  const raw: Omit<Prompt, "id">[] = [];

  for (const block of body) {
    const lines = block.split("\n");

    const nameLine = lines.find((l) => l.startsWith("## "));
    if (!nameLine) continue;
    const name = nameLine.slice(3).trim();

    const modeLine = lines.find((l) => l.startsWith("mode: "));
    const mode = (modeLine?.slice(6).trim() ?? "rewrite") as ModeType;

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
        ? lines.slice(userSepIdx + 1).join("\n").trim()
        : "";

    raw.push({ name, mode, systemPrompt, userPromptTemplate });
  }

  const prompts = assignIds(raw);
  return { prompts: prompts.length > 0 ? prompts : DEFAULT_PROMPTS, defaultSystemPrompts };
}

/**
 * Read the prompts file from the vault, creating it with defaults if absent.
 *
 * @param app - The Obsidian App instance.
 * @param filePath - Vault-relative path (defaults to `PROMPTS_FILE_PATH`).
 * @returns Parsed prompts and default system prompts.
 */
export async function loadPromptsFile(
  app: App,
  filePath = PROMPTS_FILE_PATH
): Promise<{ prompts: Prompt[]; defaultSystemPrompts: DefaultSystemPrompts }> {
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof TFile) {
    const content = await app.vault.read(existing);
    return parsePrompts(content);
  }
  await app.vault.create(filePath, serialisePrompts(DEFAULT_PROMPTS));
  return { prompts: DEFAULT_PROMPTS, defaultSystemPrompts: DEFAULT_SYSTEM_PROMPTS };
}

/**
 * Write the prompt array to the prompts file, creating or overwriting as needed.
 *
 * @param app - The Obsidian App instance.
 * @param prompts - The prompt array to persist.
 * @param defaultSystemPrompts - Default system prompts to embed in front-matter.
 * @param filePath - Vault-relative path (defaults to `PROMPTS_FILE_PATH`).
 */
export async function savePromptsFile(
  app: App,
  prompts: Prompt[],
  defaultSystemPrompts: DefaultSystemPrompts,
  filePath = PROMPTS_FILE_PATH
): Promise<void> {
  const content = serialisePrompts(prompts, defaultSystemPrompts);
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}
