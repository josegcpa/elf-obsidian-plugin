/** Identifier for each supported AI provider. */
export type ProviderType =
  | "openrouter"
  | "anthropic"
  | "google"
  | "openai"
  | "mistral"
  | "ollama";

/** The three operating modes of the plugin. */
export type ModeType = "collaborate" | "rewrite" | "variations";

/**
 * A user-defined prompt stored in the prompt library.
 *
 * Templates support these placeholders:
 * - `{{before}}` — text before the cursor / selection (up to 500 characters)
 * - `{{after}}` — text after the cursor / selection (up to 500 characters; rewrite / variations only)
 * - `{{selected}}` — the currently selected text (rewrite / variations mode only)
 * - `{{n}}` — number of variations to generate (variations mode only)
 *
 * `[[wikilinks]]` anywhere in `userPromptTemplate` are resolved to vault file
 * contents and appended to the user message before it reaches the model.
 */
export interface Prompt {
  /** Unique identifier derived from the prompt name (slug). */
  id: string;
  /** Human-readable label shown in dropdowns and the prompt picker. */
  name: string;
  /** Which plugin mode this prompt belongs to. */
  mode: ModeType;
  /**
   * Instruction given to the model as the system message.
   * When empty/absent, the mode's default system prompt is used instead.
   */
  systemPrompt: string;
  /** User message sent to the model; may contain `{{before}}`, `{{after}}`, `{{selected}}`, `{{n}}`, or `[[wikilinks]]`. */
  userPromptTemplate: string;
}

/** Default system prompts per mode, stored in the prompt file's YAML front-matter. */
export interface DefaultSystemPrompts {
  collaborate: string;
  rewrite: string;
  variations: string;
}

/** Persisted plugin configuration (stored via Obsidian's `Plugin.saveData`). */
export interface PluginSettings {
  /** Active provider. */
  provider: ProviderType;
  /** Model identifier sent to the provider API. */
  model: string;
  /** Last-used model for each provider, used to restore selection when switching. */
  modelPerProvider: Partial<Record<ProviderType, string>>;
  /** API keys keyed by provider (not used by Ollama). */
  apiKeys: Record<string, string>;
  /** Base URL for a local Ollama server. */
  ollamaBaseUrl: string;
  /** ID of the prompt used by default in Collaborate mode. */
  defaultCollaboratePromptId: string;
  /** ID of the prompt used by default in Rewrite mode. */
  defaultRewritePromptId: string;
  /** ID of the prompt used by default in Variations mode. */
  defaultVariationsPromptId: string;
  /** Full prompt library. */
  prompts: Prompt[];
  /** Vault-relative path to the prompts markdown file. */
  promptsFilePath: string;
  /** How many variations to generate in Variations mode. */
  variationCount: number;
  /** Default system prompt per mode, shown in the prompt file's YAML front-matter. */
  defaultSystemPrompts: DefaultSystemPrompts;
}

/** Payload sent to any `LLMProvider.complete` call. */
export interface LLMRequest {
  /** Content of the system message. */
  systemPrompt: string;
  /** Content of the user message. */
  userPrompt: string;
  /** Maximum number of tokens to generate (default: 1024). */
  maxTokens?: number;
}

/** Value returned by any `LLMProvider.complete` call. */
export interface LLMResponse {
  /** The generated text from the model. */
  text: string;
}

/**
 * Default system prompts per mode.
 *
 * These describe the structure of the user message and the general rules for
 * each mode. They do NOT encode any specific writing task — that belongs in the
 * user prompt template.
 *
 * The user message may contain:
 * - `[FILE: path]` markers where `[[wikilinks]]` were found, with the actual
 *   file contents appended at the end under `[CONTENTS OF FILE: path]` blocks.
 */
export const DEFAULT_SYSTEM_PROMPTS: DefaultSystemPrompts = {
  collaborate:
    "You are a skilled writing assistant. " +
    "The user message contains the text written so far (up to the cursor). " +
    "It may also include the contents of linked vault files, appended after " +
    "[CONTENTS OF FILE: ...] markers — use them as additional context when relevant. " +
    "Continue the text naturally, maintaining the author's voice, style, and tone. " +
    "Output only the continuation — do not repeat what was already written.",
  rewrite:
    "You are an expert editor. " +
    "The user message contains: the text before the selection, the section to rewrite " +
    "(marked with [REWRITE THIS] / [END REWRITE]), and the text after. " +
    "It may also include the contents of linked vault files, appended after " +
    "[CONTENTS OF FILE: ...] markers — use them as additional context when relevant. " +
    "Rewrite only the marked section so it fits naturally between the surrounding text. " +
    "Output only the rewritten text — no labels, no surrounding context.",
  variations:
    "You are a creative writing assistant. " +
    "The user message contains: the text before the selection, the section to vary " +
    "(marked with [VARY THIS] / [END VARY]), and the text after. " +
    "It may also include the contents of linked vault files, appended after " +
    "[CONTENTS OF FILE: ...] markers — use them as additional context when relevant. " +
    "Generate the requested number of distinct variations of the marked section. " +
    "Each variation must fit naturally between the surrounding text. " +
    "Output each variation prefixed with its number and a period (e.g. \"1. ...\"). " +
    "Output nothing else — no labels, no surrounding context.",
};

/** Prompts shipped with the plugin and used when no user prompts exist. */
export const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: "continue-writing",
    name: "Continue writing",
    mode: "collaborate",
    systemPrompt: "",
    userPromptTemplate: "Continue writing from here:\n\n{{before}}",
  },
  {
    id: "improve-clarity",
    name: "Improve clarity",
    mode: "rewrite",
    systemPrompt: "",
    userPromptTemplate:
      "Rewrite the marked section to improve clarity and flow while preserving the original meaning.\n\nText before:\n{{before}}\n\n[REWRITE THIS]:\n{{selected}}\n\n[END REWRITE]\n\nText after:\n{{after}}",
  },
  {
    id: "make-concise",
    name: "Make concise",
    mode: "rewrite",
    systemPrompt: "",
    userPromptTemplate:
      "Rewrite the marked section to make it more concise without losing meaning.\n\nText before:\n{{before}}\n\n[REWRITE THIS]:\n{{selected}}\n\n[END REWRITE]\n\nText after:\n{{after}}",
  },
  {
    id: "generate-variations",
    name: "Generate variations",
    mode: "variations",
    systemPrompt: "",
    userPromptTemplate:
      "Generate {{n}} variations of the marked section.\n\nText before:\n{{before}}\n\n[VARY THIS]:\n{{selected}}\n\n[END VARY]\n\nText after:\n{{after}}",
  },
];

/** Factory-default settings applied on first install. */
export const DEFAULT_SETTINGS: PluginSettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  modelPerProvider: {},
  apiKeys: { openai: "", anthropic: "", google: "", mistral: "", openrouter: "", ollama: "" },
  ollamaBaseUrl: "http://localhost:11434",
  defaultCollaboratePromptId: "continue-writing",
  defaultRewritePromptId: "improve-clarity",
  defaultVariationsPromptId: "generate-variations",
  prompts: DEFAULT_PROMPTS,
  promptsFilePath: "prompts.md",
  variationCount: 3,
  defaultSystemPrompts: DEFAULT_SYSTEM_PROMPTS,
};
