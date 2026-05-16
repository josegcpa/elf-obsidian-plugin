import { Editor } from "obsidian";
import { LLMProvider } from "./providers/base";
import { Prompt } from "./types";

/** Default number of variations to request when `{{n}}` is used. */
const DEFAULT_VARIATION_COUNT = 3;

/** Maximum characters of surrounding context sent with rewrite/variations prompts. */
const CONTEXT_WINDOW_CHARS = 500;

/**
 * Substitute `{{key}}` placeholders in a prompt template.
 *
 * @param template - Raw template string (e.g. `"Rewrite: {{selected}}"`).
 * @param vars - Map from placeholder name to replacement value.
 *   Unknown keys are replaced with an empty string.
 * @returns The template with all placeholders resolved.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Return the text immediately before and after the current selection,
 * up to `CONTEXT_WINDOW_CHARS` characters on each side.
 *
 * @param editor - The active Obsidian `Editor` instance.
 * @returns Object with `before` and `after` strings.
 */
export function getSelectionContext(
  editor: Editor
): { before: string; after: string } {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const fullText = editor.getValue();
  const fromOffset = editor.posToOffset(from);
  const toOffset = editor.posToOffset(to);

  const before = fullText.slice(
    Math.max(0, fromOffset - CONTEXT_WINDOW_CHARS),
    fromOffset
  );
  const after = fullText.slice(
    toOffset,
    Math.min(fullText.length, toOffset + CONTEXT_WINDOW_CHARS)
  );

  return { before, after };
}

/**
 * Collect the paragraph that contains the cursor.
 *
 * Walks backwards from the cursor line, stopping at the first blank line
 * (or the start of the document). The resulting string is used as context
 * for Collaborate-mode prompts.
 *
 * @param editor - The active Obsidian `Editor` instance.
 * @returns All non-blank lines of the current paragraph, joined with `\n`.
 */
export function getParagraphContext(editor: Editor): string {
  const cursor = editor.getCursor();
  const lines: string[] = [];

  for (let i = cursor.line; i >= 0; i--) {
    const line = editor.getLine(i);
    if (i < cursor.line && line.trim() === "") break;
    lines.unshift(line);
  }

  return lines.join("\n");
}

/**
 * Run **Collaborate** mode.
 *
 * Gathers the current paragraph as context, sends it to the model using
 * `prompt`, and inserts the generated continuation directly after the cursor.
 *
 * @param editor - The active editor.
 * @param provider - LLM provider to call.
 * @param prompt - Prompt whose `mode` must be `"collaborate"`.
 */
export async function runCollaborate(
  editor: Editor,
  provider: LLMProvider,
  prompt: Prompt
): Promise<void> {
  const context = getParagraphContext(editor);
  const userPrompt = renderTemplate(prompt.userPromptTemplate, { context });

  const response = await provider.complete({
    systemPrompt: prompt.systemPrompt,
    userPrompt,
  });

  const cursor = editor.getCursor("to");
  editor.replaceRange(response.text, cursor);
}

/**
 * Run **Rewrite** mode.
 *
 * Sends the selected text plus surrounding context to the model and replaces
 * the selection with the result. Templates may use `{{selected}}`,
 * `{{before}}`, and `{{after}}`.
 *
 * @param editor - The active editor.
 * @param provider - LLM provider to call.
 * @param prompt - Prompt whose `mode` must be `"rewrite"`.
 * @throws If no text is selected.
 */
export async function runRewrite(
  editor: Editor,
  provider: LLMProvider,
  prompt: Prompt
): Promise<void> {
  const selected = editor.getSelection();
  if (!selected) {
    throw new Error("Rewrite mode requires selected text.");
  }

  const { before, after } = getSelectionContext(editor);
  const userPrompt = renderTemplate(prompt.userPromptTemplate, {
    selected,
    before,
    after,
  });

  const response = await provider.complete({
    systemPrompt: prompt.systemPrompt,
    userPrompt,
  });

  editor.replaceSelection(response.text);
}

/**
 * Run **Variations** mode.
 *
 * Asks the model for `count` distinct rewrites of the selection and returns
 * them as a plain string array (one element per variation). The caller is
 * responsible for presenting the list to the user.
 *
 * @param editor - The active editor (selection must be non-empty).
 * @param provider - LLM provider to call.
 * @param prompt - Prompt whose `mode` must be `"variations"`.
 * @param count - How many variations to request (default: `DEFAULT_VARIATION_COUNT`).
 * @returns Array of variation strings (may be shorter than `count` if the model
 *   returns fewer).
 * @throws If no text is selected.
 */
export async function runVariations(
  editor: Editor,
  provider: LLMProvider,
  prompt: Prompt,
  count = DEFAULT_VARIATION_COUNT
): Promise<string[]> {
  const selected = editor.getSelection();
  if (!selected) {
    throw new Error("Variations mode requires selected text.");
  }

  const { before, after } = getSelectionContext(editor);
  const n = String(count);
  const systemPrompt = renderTemplate(prompt.systemPrompt, { n });
  const userPrompt = renderTemplate(prompt.userPromptTemplate, {
    selected,
    before,
    after,
    n,
  });

  const response = await provider.complete({
    systemPrompt,
    userPrompt,
    maxTokens: 1024 * Math.ceil(count / 2),
  });

  return parseVariations(response.text);
}

/**
 * Parse the numbered-list format the model returns for variations.
 *
 * Accepts lines like `"1. text"`, `"1) text"`, or `"1 text"` and returns
 * the text portions as a trimmed array. Falls back to splitting on blank
 * lines if no numbered prefix is found.
 *
 * @param raw - Raw model output.
 * @returns Parsed variation strings.
 */
export function parseVariations(raw: string): string[] {
  const numbered = raw
    .split("\n")
    .map((line) => line.replace(/^\d+[.)\s]\s*/, "").trim())
    .filter(Boolean);

  if (numbered.length > 0) return numbered;

  return raw
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}
