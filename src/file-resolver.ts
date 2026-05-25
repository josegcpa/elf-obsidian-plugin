import { App, TFile } from "obsidian";

/** Regex that matches `[[wikilink]]` and `[[wikilink|alias]]` forms. */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

/** Regex that matches fenced code blocks with a given language tag. */
const FENCED_BLOCK_RE = (lang: string) =>
  new RegExp("```" + lang + "\\s*\\n([\\s\\S]*?)```", "gi");

/** Type guard: returns true when `f` looks like a TFile (has a string `.path`). */
function isTFile(f: unknown): f is TFile {
  return typeof (f as TFile)?.path === "string";
}

/**
 * Attempt to resolve a vault path fragment to a `TFile`.
 * Tries exact match first, then searches all markdown files for a basename match.
 *
 * @param app - Obsidian App instance.
 * @param rawPath - Path or basename from a wikilink.
 * @returns The matching `TFile`, or `null` if not found.
 */
function resolveVaultFile(app: App, rawPath: string): TFile | null {
  const withMd = rawPath.endsWith(".md") ? rawPath : `${rawPath}.md`;
  const exact =
    app.vault.getAbstractFileByPath(withMd) ??
    app.vault.getAbstractFileByPath(rawPath);
  if (isTFile(exact)) return exact;

  const lower = rawPath.toLowerCase();
  return (
    app.vault
      .getMarkdownFiles()
      .find(
        (f) =>
          f.basename.toLowerCase() === lower ||
          f.path.toLowerCase() === lower ||
          f.path.toLowerCase() === `${lower}.md`
      ) ?? null
  );
}

/**
 * Render all `dataview` and `dataviewjs` fenced code blocks in `content`
 * by querying the Dataview plugin API. Falls back to a plain text notice if
 * the plugin is unavailable.
 *
 * @param app - Obsidian App instance.
 * @param content - Raw markdown content of a vault file.
 * @returns Content with dataview blocks replaced by their rendered output.
 */
async function resolveDataviewBlocks(
  app: App,
  content: string
): Promise<string> {
  const dvPlugin = (app as any).plugins?.plugins?.["dataview"];
  if (!dvPlugin?.api) {
    return content
      .replace(FENCED_BLOCK_RE("dataview"), "[dataview block — plugin not installed]")
      .replace(FENCED_BLOCK_RE("dataviewjs"), "[dataviewjs block — plugin not installed]");
  }

  const api = dvPlugin.api;

  async function replaceBlocks(src: string, lang: string): Promise<string> {
    const re = FENCED_BLOCK_RE(lang);
    const matches = [...src.matchAll(re)];
    for (const match of matches) {
      const query = match[1].trim();
      try {
        const result = await api.queryMarkdown(query);
        const rendered = result?.successful
          ? result.value
          : `[dataview error: ${result?.error ?? "unknown"}]`;
        src = src.replace(match[0], rendered);
      } catch {
        src = src.replace(match[0], "[dataview error: query failed]");
      }
    }
    return src;
  }

  content = await replaceBlocks(content, "dataview");
  content = await replaceBlocks(content, "dataviewjs");
  return content;
}

/**
 * Resolve all `[[wikilinks]]` found in `text`, returning the text with
 * each link replaced by `[FILE: <path>]` and all file contents appended.
 *
 * Handles:
 * - `dataview` / `dataviewjs` fenced blocks inside linked files (via plugin API)
 * - Recursive wikilinks inside linked files (one level deep, deduped)
 * - Infinite-recursion prevention via a `visited` set of resolved paths
 *
 * @param text - The prompt string to process (e.g. `userPromptTemplate`).
 * @param app - Obsidian App instance.
 * @param visited - Set of already-resolved file paths (prevents re-inclusion).
 * @returns The processed prompt string with appended file contents section.
 */
export async function resolveFileLinks(
  text: string,
  app: App,
  visited: Set<string> = new Set()
): Promise<string> {
  const matches = [...text.matchAll(WIKILINK_RE)];
  if (matches.length === 0) return text;

  const fileContents: { path: string; content: string }[] = [];

  for (const match of matches) {
    const rawPath = match[1].trim();
    const file = resolveVaultFile(app, rawPath);

    if (!file) {
      text = text.replace(match[0], `[FILE: ${rawPath} — not found]`);
      continue;
    }

    text = text.replace(match[0], `[FILE: ${file.path}]`);

    if (visited.has(file.path)) continue;
    visited.add(file.path);

    let raw = await app.vault.read(file);
    raw = await resolveDataviewBlocks(app, raw);

    // Recursively resolve wikilinks inside the included file (deduped via visited)
    if (WIKILINK_RE.test(raw)) {
      WIKILINK_RE.lastIndex = 0;
      raw = await resolveFileLinks(raw, app, visited);
    }

    fileContents.push({ path: file.path, content: raw });
  }

  if (fileContents.length === 0) return text;

  const appendix = fileContents
    .map((f) => `[CONTENTS OF FILE: ${f.path}]\n${f.content}`)
    .join("\n\n");

  return `${text}\n\n${appendix}`;
}
