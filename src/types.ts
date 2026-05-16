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
 * - `{{context}}` — the paragraph text up to the cursor (collaborate mode)
 * - `{{selected}}` — the currently selected text (rewrite / variations mode)
 * - `{{before}}` — the text immediately before the selection (rewrite / variations mode)
 * - `{{after}}` — the text immediately after the selection (rewrite / variations mode)
 * - `{{n}}` — number of variations to generate (variations mode only)
 */
export interface Prompt {
  /** Unique identifier (stable across saves). */
  id: string;
  /** Human-readable label shown in dropdowns and the prompt picker. */
  name: string;
  /** Which plugin mode this prompt belongs to. */
  mode: ModeType;
  /** Instruction given to the model as the system message. */
  systemPrompt: string;
  /** User message sent to the model; may contain `{{context}}` or `{{selected}}`. */
  userPromptTemplate: string;
}

/** Persisted plugin configuration (stored via Obsidian's `Plugin.saveData`). */
export interface PluginSettings {
  /** Active provider. */
  provider: ProviderType;
  /** Model identifier sent to the provider API. */
  model: string;
  /** API key for cloud providers (not used by Ollama). */
  apiKey: string;
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
  /** GitHub personal access token (gist scope) for prompt sync. */
  githubToken: string;
  /** GitHub Gist ID used for prompt sync; empty string means "create on first push". */
  githubGistId: string;
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

/** Prompts shipped with the plugin and used when no user prompts exist. */
export const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: "collaborate-default",
    name: "Continue writing",
    mode: "collaborate",
    systemPrompt:
      "You are a skilled writing assistant. Continue the text provided by the user, maintaining their voice, style, and tone. Output only the continuation — do not repeat what was already written.",
    userPromptTemplate: "Continue writing from here:\n\n{{context}}",
  },
  {
    id: "rewrite-default",
    name: "Improve clarity",
    mode: "rewrite",
    systemPrompt:
      "You are an expert editor. You will be given a passage with a marked section to rewrite. " +
      "Rewrite only the marked section to improve clarity and flow while preserving the original meaning. " +
      "Your output must fit naturally between the text that comes before and after it. " +
      "Output only the rewritten text — no labels, no surrounding context.",
    userPromptTemplate:
      "Text before:\n{{before}}\n\n[REWRITE THIS]:\n{{selected}}\n\n[END REWRITE]\n\nText after:\n{{after}}",
  },
  {
    id: "rewrite-concise",
    name: "Make concise",
    mode: "rewrite",
    systemPrompt:
      "You are an expert editor. You will be given a passage with a marked section to rewrite. " +
      "Rewrite only the marked section to make it more concise without losing meaning. " +
      "Your output must fit naturally between the text that comes before and after it. " +
      "Output only the rewritten text — no labels, no surrounding context.",
    userPromptTemplate:
      "Text before:\n{{before}}\n\n[REWRITE THIS]:\n{{selected}}\n\n[END REWRITE]\n\nText after:\n{{after}}",
  },
  {
    id: "variations-default",
    name: "Generate variations",
    mode: "variations",
    systemPrompt:
      "You are a creative writing assistant. You will be given a passage with a marked section to rewrite. " +
      "Generate exactly {{n}} distinct variations of the marked section. " +
      "Each variation must fit naturally between the text before and after it. " +
      "Output each variation on its own line, prefixed with its number and a period (e.g. \"1. ...\"). " +
      "Output nothing else — no labels, no surrounding context.",
    userPromptTemplate:
      "Text before:\n{{before}}\n\n[VARY THIS]:\n{{selected}}\n\n[END VARY]\n\nText after:\n{{after}}\n\nGenerate {{n}} variations.",
  },
];

/** Factory-default settings applied on first install. */
export const DEFAULT_SETTINGS: PluginSettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  apiKey: "",
  ollamaBaseUrl: "http://localhost:11434",
  defaultCollaboratePromptId: "collaborate-default",
  defaultRewritePromptId: "rewrite-default",
  defaultVariationsPromptId: "variations-default",
  prompts: DEFAULT_PROMPTS,
  githubToken: "",
  githubGistId: "",
};
