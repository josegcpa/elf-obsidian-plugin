var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  ModelCache: () => ModelCache,
  default: () => writebraightPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/types.ts
var DEFAULT_SYSTEM_PROMPTS = {
  collaborate: "You are a skilled writing assistant. The user message contains the text written so far (up to the cursor). It may also include the contents of linked vault files, appended after [CONTENTS OF FILE: ...] markers \u2014 use them as additional context when relevant. Continue the text naturally, maintaining the author's voice, style, and tone. Output only the continuation \u2014 do not repeat what was already written.",
  rewrite: "You are an expert editor. The user message contains: the text before the selection, the section to rewrite (marked with [REWRITE THIS] / [END REWRITE]), and the text after. It may also include the contents of linked vault files, appended after [CONTENTS OF FILE: ...] markers \u2014 use them as additional context when relevant. Rewrite only the marked section so it fits naturally between the surrounding text. Output only the rewritten text \u2014 no labels, no surrounding context.",
  variations: 'You are a creative writing assistant. The user message contains: the text before the selection, the section to vary (marked with [VARY THIS] / [END VARY]), and the text after. It may also include the contents of linked vault files, appended after [CONTENTS OF FILE: ...] markers \u2014 use them as additional context when relevant. Generate the requested number of distinct variations of the marked section. Each variation must fit naturally between the surrounding text. Output each variation prefixed with its number and a period (e.g. "1. ..."). Output nothing else \u2014 no labels, no surrounding context.'
};
var DEFAULT_PROMPTS = [
  {
    id: "continue-writing",
    name: "Continue writing",
    mode: "collaborate",
    systemPrompt: "",
    userPromptTemplate: "Continue writing from here:\n\n{{before}}"
  },
  {
    id: "improve-clarity",
    name: "Improve clarity",
    mode: "rewrite",
    systemPrompt: "",
    userPromptTemplate: "Rewrite the marked section to improve clarity and flow while preserving the original meaning.\n\nText before:\n{{before}}\n\n[REWRITE THIS]:\n{{selected}}\n\n[END REWRITE]\n\nText after:\n{{after}}"
  },
  {
    id: "make-concise",
    name: "Make concise",
    mode: "rewrite",
    systemPrompt: "",
    userPromptTemplate: "Rewrite the marked section to make it more concise without losing meaning.\n\nText before:\n{{before}}\n\n[REWRITE THIS]:\n{{selected}}\n\n[END REWRITE]\n\nText after:\n{{after}}"
  },
  {
    id: "generate-variations",
    name: "Generate variations",
    mode: "variations",
    systemPrompt: "",
    userPromptTemplate: "Generate {{n}} variations of the marked section.\n\nText before:\n{{before}}\n\n[VARY THIS]:\n{{selected}}\n\n[END VARY]\n\nText after:\n{{after}}"
  }
];
var DEFAULT_SETTINGS = {
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
  defaultSystemPrompts: DEFAULT_SYSTEM_PROMPTS
};

// src/settings-tab.ts
var import_obsidian3 = require("obsidian");

// src/providers/base.ts
var import_obsidian = require("obsidian");
async function postJson(url, headers, body, errorPrefix) {
  var _a;
  const response = await (0, import_obsidian.requestUrl)({
    url,
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    let message = response.text;
    try {
      const json = JSON.parse(response.text);
      message = ((_a = json.error) == null ? void 0 : _a.message) || json.message || response.text;
    } catch (e) {
      if (message.length > 200) {
        message = message.slice(0, 200) + "\u2026";
      }
    }
    throw new Error(`Error (status code: ${response.status})! ${message}`);
  }
  return response.json;
}
async function getJson(url, headers) {
  const response = await (0, import_obsidian.requestUrl)({
    url,
    method: "GET",
    headers,
    throw: false
  });
  if (response.status < 200 || response.status >= 300) return null;
  return response.json;
}

// src/providers/openai.ts
var OpenAIProvider = class {
  constructor(apiKey, model, baseUrl = "https://api.openai.com/v1") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }
  /** @inheritdoc */
  async complete(request) {
    var _a, _b, _c;
    const data = await postJson(
      `${this.baseUrl}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt }
        ],
        max_tokens: (_a = request.maxTokens) != null ? _a : 1024,
        temperature: (_b = request.temperature) != null ? _b : 0.7
      },
      "OpenAI API error"
    );
    return { text: (_c = data.choices[0].message.content) != null ? _c : "" };
  }
  /**
   * Fetches available GPT models from the OpenAI `/models` endpoint.
   * Returns an empty array if the request fails.
   *
   * Filters to include only text generation models (excludes DALL-E, TTS,
   * Whisper, embedding models, and other non-chat models).
   */
  async listModels() {
    const data = await getJson(`${this.baseUrl}/models`, {
      Authorization: `Bearer ${this.apiKey}`
    });
    if (!data) return [];
    const textPrefixes = ["gpt", "o1", "o3"];
    const nonTextPatterns = [
      "dall-e",
      "tts",
      "whisper",
      "embedding",
      "text-embedding",
      "babbage",
      "davinci",
      "audio",
      "transcribe",
      "realtime",
      "-image-"
    ];
    return data.data.map((m) => m.id).filter((id) => {
      const lowerId = id.toLowerCase();
      if (!textPrefixes.some((p) => lowerId.startsWith(p))) return false;
      if (nonTextPatterns.some((p) => lowerId.includes(p))) return false;
      return true;
    }).sort();
  }
};

// src/providers/anthropic.ts
var AnthropicProvider = class {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://api.anthropic.com/v1";
  }
  /** @inheritdoc */
  async complete(request) {
    var _a, _b, _c, _d, _e;
    const data = await postJson(
      `${this.baseUrl}/messages`,
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      {
        model: this.model,
        max_tokens: (_a = request.maxTokens) != null ? _a : 1024,
        temperature: (_b = request.temperature) != null ? _b : 0.7,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }]
      },
      "Anthropic API error"
    );
    return { text: (_e = (_d = (_c = data.content) == null ? void 0 : _c[0]) == null ? void 0 : _d.text) != null ? _e : "" };
  }
  /**
   * Fetches available models from the Anthropic `/v1/models` endpoint.
   * Returns an empty array if the request fails.
   */
  async listModels() {
    const data = await getJson(`${this.baseUrl}/models`, {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01"
    });
    if (!data) return [];
    return data.data.map((m) => m.id).sort();
  }
};

// src/providers/google.ts
var GoogleProvider = class {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
    this.generateBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
    this.listBaseUrl = "https://generativelanguage.googleapis.com/v1/models";
  }
  /** @inheritdoc */
  async complete(request) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const url = `${this.generateBaseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const data = await postJson(
      url,
      {},
      {
        system_instruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: {
          maxOutputTokens: (_a = request.maxTokens) != null ? _a : 1024,
          temperature: (_b = request.temperature) != null ? _b : 0.7
        }
      },
      "Google API error"
    );
    return { text: (_h = (_g = (_f = (_e = (_d = (_c = data.candidates) == null ? void 0 : _c[0]) == null ? void 0 : _d.content) == null ? void 0 : _e.parts) == null ? void 0 : _f[0]) == null ? void 0 : _g.text) != null ? _h : "" };
  }
  /**
   * Fetches available models from the Google ListModels endpoint,
   * filtered to those that support `generateContent`.
   * Returns an empty array if the request fails.
   */
  async listModels() {
    var _a;
    const data = await getJson(`${this.listBaseUrl}?key=${this.apiKey}`, {});
    if (!data) return [];
    return ((_a = data.models) != null ? _a : []).filter((m) => {
      var _a2;
      return (_a2 = m.supportedGenerationMethods) == null ? void 0 : _a2.includes("generateContent");
    }).map((m) => m.name.replace(/^models\//, "")).sort();
  }
};

// src/providers/mistral.ts
var MistralProvider = class {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://api.mistral.ai/v1";
  }
  /** @inheritdoc */
  async complete(request) {
    var _a, _b, _c;
    const data = await postJson(
      `${this.baseUrl}/chat/completions`,
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt }
        ],
        max_tokens: (_a = request.maxTokens) != null ? _a : 1024,
        temperature: (_b = request.temperature) != null ? _b : 0.7
      },
      "Mistral API error"
    );
    return { text: (_c = data.choices[0].message.content) != null ? _c : "" };
  }
  /**
   * Fetches available models from the Mistral `/models` endpoint.
   * Returns an empty array if the request fails.
   *
   * Filters to include only text generation models (excludes embedding,
   * moderation, and multimodal models like pixtral and voxtral).
   */
  async listModels() {
    const data = await getJson(`${this.baseUrl}/models`, {
      Authorization: `Bearer ${this.apiKey}`
    });
    if (!data) return [];
    const nonTextPrefixes = ["pixtral", "voxtral", "mistral-embed", "moderation"];
    return data.data.map((m) => m.id).filter((id) => !nonTextPrefixes.some((prefix) => id.toLowerCase().startsWith(prefix))).sort();
  }
};

// src/providers/ollama.ts
var OllamaProvider = class {
  constructor(baseUrl, model) {
    this.baseUrl = baseUrl;
    this.model = model;
  }
  /** @inheritdoc */
  async complete(request) {
    var _a, _b, _c, _d;
    const data = await postJson(
      `${this.baseUrl}/api/chat`,
      {},
      {
        model: this.model,
        stream: false,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt }
        ],
        options: {
          num_predict: (_a = request.maxTokens) != null ? _a : 1024,
          temperature: (_b = request.temperature) != null ? _b : 0.7
        }
      },
      "Ollama API error"
    );
    return { text: (_d = (_c = data.message) == null ? void 0 : _c.content) != null ? _d : "" };
  }
  /**
   * Lists models currently pulled in the local Ollama instance.
   * Returns an empty array when Ollama is not running.
   */
  async listModels() {
    try {
      const data = await getJson(`${this.baseUrl}/api/tags`, {});
      if (!data) return [];
      return data.models.map((m) => m.name).sort();
    } catch (e) {
      return [];
    }
  }
};

// src/providers/openrouter.ts
var OpenRouterProvider = class {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://openrouter.ai/api/v1";
  }
  /** @inheritdoc */
  async complete(request) {
    var _a, _b, _c;
    const data = await postJson(
      `${this.baseUrl}/chat/completions`,
      {
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "obsidian://elf",
        "X-Title": "Elf Plugin"
      },
      {
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt }
        ],
        max_tokens: (_a = request.maxTokens) != null ? _a : 1024,
        temperature: (_b = request.temperature) != null ? _b : 0.7
      },
      "OpenRouter API error"
    );
    return { text: (_c = data.choices[0].message.content) != null ? _c : "" };
  }
  /**
   * Fetches all models available via OpenRouter.
   * Returns an empty array if the request fails.
   */
  async listModels() {
    const data = await getJson(`${this.baseUrl}/models`, {
      Authorization: `Bearer ${this.apiKey}`
    });
    if (!data) return [];
    return data.data.map((m) => m.id).sort();
  }
};

// src/providers/factory.ts
function createProvider(settings) {
  var _a;
  const { provider, model, apiKeys, ollamaBaseUrl } = settings;
  const apiKey = (_a = (apiKeys != null ? apiKeys : {})[provider]) != null ? _a : "";
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey, model);
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "google":
      return new GoogleProvider(apiKey, model);
    case "mistral":
      return new MistralProvider(apiKey, model);
    case "ollama":
      return new OllamaProvider(ollamaBaseUrl, model);
    case "openrouter":
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
var PROVIDER_DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  google: "gemini-1.5-flash",
  mistral: "mistral-small-latest",
  ollama: "llama3",
  openrouter: "openai/gpt-4o-mini"
};

// src/prompt-file.ts
var import_obsidian2 = require("obsidian");
var PROMPTS_FILE_PATH = "prompts.md";
function nameToSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function assignIds(prompts) {
  const seen = /* @__PURE__ */ new Map();
  return prompts.map((p) => {
    var _a;
    const base = nameToSlug(p.name) || "prompt";
    const count = (_a = seen.get(base)) != null ? _a : 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return { ...p, id };
  });
}
function serialisePrompts(prompts, defaultSystemPrompts = DEFAULT_SYSTEM_PROMPTS) {
  const yamlValue = (s) => JSON.stringify(s);
  const frontMatter = [
    "---",
    `default_system_prompt_collaborate: ${yamlValue(defaultSystemPrompts.collaborate)}`,
    `default_system_prompt_rewrite: ${yamlValue(defaultSystemPrompts.rewrite)}`,
    `default_system_prompt_variations: ${yamlValue(defaultSystemPrompts.variations)}`,
    "---",
    "",
    "<!-- Elf prompt library \u2014 edit freely, the plugin will reload on save -->",
    ""
  ].join("\n");
  const blocks = prompts.map((p) => {
    const lines = [
      `## ${p.name}`,
      "",
      `mode: ${p.mode}`
    ];
    if (p.systemPrompt) {
      lines.push("", "### System prompt", "", p.systemPrompt);
    }
    lines.push("", "### User prompt", "", p.userPromptTemplate);
    return lines.join("\n");
  });
  return frontMatter + blocks.join("\n\n---\n\n") + "\n";
}
function extractFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  return match ? match[1] : null;
}
function parseFrontMatterSystemPrompts(yaml) {
  const result = { ...DEFAULT_SYSTEM_PROMPTS };
  const mapping = {
    default_system_prompt_collaborate: "collaborate",
    default_system_prompt_rewrite: "rewrite",
    default_system_prompt_variations: "variations"
  };
  for (const [flatKey, modeKey] of Object.entries(mapping)) {
    const re = new RegExp(`^${flatKey}:\\s*(['"])([\\s\\S]*?)\\1\\s*$`, "m");
    const m = yaml.match(re);
    if (m) {
      try {
        result[modeKey] = JSON.parse(`"${m[2].replace(/"/g, '\\"').replace(/\\'/g, "'")}"`);
      } catch (e) {
        result[modeKey] = m[2];
      }
    }
  }
  return result;
}
function parsePrompts(content) {
  var _a;
  const fm = extractFrontMatter(content);
  const defaultSystemPrompts = fm ? parseFrontMatterSystemPrompts(fm) : { ...DEFAULT_SYSTEM_PROMPTS };
  const bodyStart = fm ? content.indexOf("\n---\n") + 5 : 0;
  const body = content.slice(bodyStart).replace(/^<!--[\s\S]*?-->\n*/m, "").split(/\n---\n/).map((b) => b.trim()).filter(Boolean);
  if (body.length === 0) return { prompts: DEFAULT_PROMPTS, defaultSystemPrompts };
  const raw = [];
  for (const block of body) {
    const lines = block.split("\n");
    const nameLine = lines.find((l) => l.startsWith("## "));
    if (!nameLine) continue;
    const name = nameLine.slice(3).trim();
    const modeLine = lines.find((l) => l.startsWith("mode: "));
    const mode = (_a = modeLine == null ? void 0 : modeLine.slice(6).trim()) != null ? _a : "rewrite";
    const sysSepIdx = lines.findIndex((l) => l === "### System prompt");
    const userSepIdx = lines.findIndex((l) => l === "### User prompt");
    const systemPrompt = sysSepIdx >= 0 ? lines.slice(sysSepIdx + 1, userSepIdx >= 0 ? userSepIdx : void 0).join("\n").trim() : "";
    const userPromptTemplate = userSepIdx >= 0 ? lines.slice(userSepIdx + 1).join("\n").trim() : "";
    raw.push({ name, mode, systemPrompt, userPromptTemplate });
  }
  const prompts = assignIds(raw);
  return { prompts: prompts.length > 0 ? prompts : DEFAULT_PROMPTS, defaultSystemPrompts };
}
async function loadPromptsFile(app, filePath = PROMPTS_FILE_PATH) {
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof import_obsidian2.TFile) {
    const content = await app.vault.read(existing);
    return parsePrompts(content);
  }
  await app.vault.create(filePath, serialisePrompts(DEFAULT_PROMPTS));
  return { prompts: DEFAULT_PROMPTS, defaultSystemPrompts: DEFAULT_SYSTEM_PROMPTS };
}
async function savePromptsFile(app, prompts, defaultSystemPrompts, filePath = PROMPTS_FILE_PATH) {
  const content = serialisePrompts(prompts, defaultSystemPrompts);
  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof import_obsidian2.TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}

// src/settings-tab.ts
var PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "mistral", label: "Mistral" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "openrouter", label: "OpenRouter" }
];
var writebraightSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    /** Index of the prompt currently open in the inline editor (-1 = none). */
    this.selectedPromptIndex = -1;
  }
  /** Re-render the entire settings panel (called on load and after provider changes). */
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Elf Settings" });
    const s = this.plugin.settings;
    const modelSectionEl = document.createElement("div");
    this.renderProviderSection(containerEl, s, modelSectionEl);
    containerEl.appendChild(modelSectionEl);
    void this.renderModelSection(modelSectionEl, s);
    this.renderVariationsSection(containerEl, s);
    this.renderDefaultPromptsSection(containerEl, s);
    this.renderPromptLibrarySection(containerEl, s);
  }
  /** Render the provider dropdown and credential input (API key or Ollama URL). */
  renderProviderSection(el, s, modelSectionEl) {
    new import_obsidian3.Setting(el).setName("Provider").setDesc("AI provider to use for completions.").addDropdown((drop) => {
      PROVIDERS.forEach(({ value, label }) => drop.addOption(value, label));
      drop.setValue(s.provider);
      drop.onChange(async (value) => {
        var _a;
        if (!s.modelPerProvider) s.modelPerProvider = {};
        s.modelPerProvider[s.provider] = s.model;
        s.provider = value;
        s.model = (_a = s.modelPerProvider[s.provider]) != null ? _a : PROVIDER_DEFAULT_MODELS[s.provider];
        await this.plugin.saveSettings();
        this.display();
      });
    });
    if (s.provider === "ollama") {
      new import_obsidian3.Setting(el).setName("Ollama base URL").setDesc("Base URL for the local Ollama server.").addText(
        (text) => text.setPlaceholder("http://localhost:11434").setValue(s.ollamaBaseUrl).onChange(async (value) => {
          s.ollamaBaseUrl = value;
          await this.plugin.saveSettings();
        })
      );
    } else {
      let keyInput;
      let visible = false;
      new import_obsidian3.Setting(el).setName("API Key").setDesc(`API key for ${s.provider}.`).addText((text) => {
        var _a, _b;
        keyInput = text;
        text.setPlaceholder("sk-\u2026").setValue((_b = ((_a = s.apiKeys) != null ? _a : {})[s.provider]) != null ? _b : "").onChange(async (value) => {
          if (!s.apiKeys) s.apiKeys = {};
          s.apiKeys[s.provider] = value;
          await this.plugin.saveSettings();
          if (value) {
            modelSectionEl.empty();
            await this.renderModelSection(modelSectionEl, s);
          }
        });
        text.inputEl.type = "password";
        text.inputEl.style.width = "100%";
      }).addButton((btn) => {
        btn.setButtonText("Show").onClick(() => {
          visible = !visible;
          keyInput.inputEl.type = visible ? "text" : "password";
          btn.setButtonText(visible ? "Hide" : "Show");
        });
      });
    }
  }
  /**
   * Render the model row.
   *
   * Shows a dropdown populated with available models. The dropdown is disabled
   * until an API key is provided and models are fetched. No manual text entry
   * is allowed — selection is only possible from the provider's model list.
   */
  async renderModelSection(el, s) {
    var _a;
    const modelSetting = new import_obsidian3.Setting(el).setName("Model");
    const hasKey = s.provider === "ollama" || !!((_a = s.apiKeys) == null ? void 0 : _a[s.provider]);
    let dropdown = null;
    const populateDropdown = (models) => {
      if (!dropdown) return;
      dropdown.selectEl.empty();
      if (models.length === 0) {
        dropdown.addOption("", "\u2014 no models available \u2014");
        dropdown.setDisabled(true);
        modelSetting.setDesc("No models available.");
      } else {
        models.forEach((m) => dropdown.addOption(m, m));
        if (!models.includes(s.model)) s.model = models[0];
        dropdown.setValue(s.model);
        dropdown.setDisabled(false);
        modelSetting.setDesc("Model to use for completions.");
      }
    };
    modelSetting.addDropdown((drop) => {
      dropdown = drop;
      drop.addOption("", hasKey ? "\u2014 select a model \u2014" : "\u2014 enter API key first \u2014");
      drop.setDisabled(!hasKey);
      drop.onChange(async (value) => {
        if (value) {
          s.model = value;
          if (!s.modelPerProvider) s.modelPerProvider = {};
          s.modelPerProvider[s.provider] = value;
          await this.plugin.saveSettings();
        }
      });
    });
    const fetchAndCache = async () => {
      const fetched = await createProvider(s).listModels();
      this.plugin.modelCache.set(s.provider, fetched);
      return fetched;
    };
    modelSetting.addButton((btn) => {
      btn.setButtonText("Refresh");
      btn.setDisabled(!hasKey);
      btn.onClick(async () => {
        btn.setDisabled(true);
        btn.setButtonText("Loading\u2026");
        this.plugin.modelCache.invalidate(s.provider);
        try {
          populateDropdown(await fetchAndCache());
        } catch (e) {
          populateDropdown([]);
        }
        btn.setButtonText("Refresh");
        btn.setDisabled(false);
      });
    });
    if (hasKey) {
      const cached = this.plugin.modelCache.get(s.provider);
      if (cached) {
        populateDropdown(cached);
      } else {
        modelSetting.setDesc("Loading models\u2026");
        try {
          populateDropdown(await fetchAndCache());
        } catch (e) {
          populateDropdown([]);
        }
      }
    } else {
      modelSetting.setDesc("Enter your API key above to load available models.");
    }
  }
  /** Render the Variations count setting. */
  renderVariationsSection(el, s) {
    new import_obsidian3.Setting(el).setName("Variations count").setDesc("Number of variations generated in Variations mode.").addSlider((slider) => {
      var _a;
      slider.setLimits(1, 10, 1).setValue((_a = s.variationCount) != null ? _a : 3).setDynamicTooltip().onChange(async (value) => {
        s.variationCount = value;
        await this.plugin.saveSettings();
      });
    });
  }
  /** Render dropdowns for the default Collaborate, Rewrite, and Variations prompts. */
  renderDefaultPromptsSection(el, s) {
    const existing = el.querySelector(".wr-default-prompts-section");
    let sectionEl;
    if (existing) {
      sectionEl = existing;
      sectionEl.empty();
    } else {
      sectionEl = el.createDiv({ cls: "wr-default-prompts-section" });
    }
    this.renderDefaultPromptsSectionInto(sectionEl, s);
  }
  /** Populate an already-mounted default-prompts container. */
  renderDefaultPromptsSectionInto(el, s) {
    el.createEl("h3", { text: "Default Prompts" });
    new import_obsidian3.Setting(el).setName("Default Collaborate prompt").addDropdown((drop) => {
      s.prompts.filter((p) => p.mode === "collaborate").forEach((p) => drop.addOption(p.id, p.name));
      drop.setValue(s.defaultCollaboratePromptId);
      drop.onChange(async (value) => {
        s.defaultCollaboratePromptId = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian3.Setting(el).setName("Default Rewrite prompt").addDropdown((drop) => {
      s.prompts.filter((p) => p.mode === "rewrite").forEach((p) => drop.addOption(p.id, p.name));
      drop.setValue(s.defaultRewritePromptId);
      drop.onChange(async (value) => {
        s.defaultRewritePromptId = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian3.Setting(el).setName("Default Variations prompt").addDropdown((drop) => {
      s.prompts.filter((p) => p.mode === "variations").forEach((p) => drop.addOption(p.id, p.name));
      drop.setValue(s.defaultVariationsPromptId);
      drop.onChange(async (value) => {
        s.defaultVariationsPromptId = value;
        await this.plugin.saveSettings();
      });
    });
  }
  /** Render inline prompt library: dropdown to select prompt + editor for selected. */
  renderPromptLibrarySection(el, s) {
    var _a;
    const existingSection = el.querySelector(".wr-prompt-library-section");
    let sectionEl;
    if (existingSection) {
      sectionEl = existingSection;
      sectionEl.empty();
    } else {
      sectionEl = el.createDiv({ cls: "wr-prompt-library-section" });
    }
    sectionEl.createEl("h3", { text: "Prompt Library" });
    const app = this.app;
    new import_obsidian3.Setting(sectionEl).setName("Prompts file").setDesc((_a = s.promptsFilePath) != null ? _a : PROMPTS_FILE_PATH).addButton((btn) => {
      btn.setButtonText("Change").onClick(() => {
        const mdFiles = app.vault.getMarkdownFiles().map((f) => f.path).sort();
        const plugin = this.plugin;
        const redisplay = () => this.display();
        class FilePicker extends import_obsidian3.FuzzySuggestModal {
          constructor() {
            super(app);
          }
          getItems() {
            return mdFiles;
          }
          getItemText(item) {
            return item;
          }
          onChooseItem(item) {
            s.promptsFilePath = item;
            void plugin.saveSettings();
            redisplay();
          }
        }
        new FilePicker().open();
      });
    });
    const promptOptions = s.prompts;
    if (this.selectedPromptIndex >= promptOptions.length) this.selectedPromptIndex = -1;
    new import_obsidian3.Setting(sectionEl).setName("Prompt").setDesc("Select a prompt to edit, or add a new one.").addDropdown((drop) => {
      drop.addOption("-1", "\u2014 select a prompt \u2014");
      promptOptions.forEach(
        (p, i) => drop.addOption(String(i), `[${p.mode}] ${p.name}`)
      );
      drop.setValue(String(this.selectedPromptIndex));
      drop.onChange((val) => {
        this.selectedPromptIndex = Number(val);
        this.renderPromptLibrarySection(el, s);
      });
    }).addButton(
      (btn) => btn.setButtonText("+ Add").onClick(async () => {
        const template = DEFAULT_PROMPTS.find((p) => p.mode === "rewrite");
        s.prompts.push({
          id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: "New prompt",
          mode: "rewrite",
          systemPrompt: template.systemPrompt,
          userPromptTemplate: template.userPromptTemplate
        });
        this.selectedPromptIndex = s.prompts.length - 1;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    const idx = this.selectedPromptIndex;
    if (idx < 0 || idx >= s.prompts.length) return;
    const prompt = s.prompts[idx];
    sectionEl.createEl("hr");
    const editorEl = sectionEl.createDiv({ cls: "wr-prompt-editor" });
    const metaRow = editorEl.createDiv({ cls: "wr-prompt-meta-row" });
    const nameWrap = metaRow.createDiv({ cls: "wr-prompt-meta-field" });
    nameWrap.createEl("label", { text: "Name", cls: "wr-field-label" });
    const nameInput = nameWrap.createEl("input", { type: "text" });
    nameInput.value = prompt.name;
    nameInput.style.width = "100%";
    nameInput.addEventListener("input", () => {
      s.prompts[idx].name = nameInput.value;
      const defaultsEl = el.querySelector(".wr-default-prompts-section");
      if (defaultsEl) {
        defaultsEl.empty();
        this.renderDefaultPromptsSectionInto(defaultsEl, s);
      }
    });
    const modeWrap = metaRow.createDiv({ cls: "wr-prompt-meta-field" });
    modeWrap.createEl("label", { text: "Mode", cls: "wr-field-label" });
    const modeSelect = modeWrap.createEl("select");
    ["collaborate", "rewrite", "variations"].forEach((m) => {
      const opt = modeSelect.createEl("option", { value: m, text: m.charAt(0).toUpperCase() + m.slice(1) });
      if (m === prompt.mode) opt.selected = true;
    });
    modeSelect.addEventListener("change", () => {
      s.prompts[idx].mode = modeSelect.value;
      const template = DEFAULT_PROMPTS.find((p) => p.mode === s.prompts[idx].mode);
      if (template) {
        sysTa.value = template.systemPrompt;
        userTa.value = template.userPromptTemplate;
        s.prompts[idx].systemPrompt = template.systemPrompt;
        s.prompts[idx].userPromptTemplate = template.userPromptTemplate;
      }
    });
    editorEl.createEl("label", { text: "System prompt", cls: "wr-field-label" });
    const sysTa = this.createTextarea(editorEl, prompt.systemPrompt, 4, (v) => {
      s.prompts[idx].systemPrompt = v;
    });
    editorEl.createEl("label", { text: "User prompt template", cls: "wr-field-label" });
    editorEl.createEl("p", {
      text: "Placeholders: {{before}} (paragraph before when collaborating, up to 500 characters before for rewrite/variations), {{after}} (up to 500 characters after for rewrite/variations), {{selected}}, {{n}}",
      cls: "setting-item-description wr-placeholder-hint"
    });
    const userTa = this.createTextarea(editorEl, prompt.userPromptTemplate, 4, (v) => {
      s.prompts[idx].userPromptTemplate = v;
    });
    const actionRow = editorEl.createDiv({ cls: "wr-prompt-action-row" });
    const saveBtn = actionRow.createEl("button", { text: "Save prompt", cls: "mod-cta" });
    saveBtn.addEventListener("click", async () => {
      await savePromptsFile(this.app, s.prompts, s.promptsFilePath);
      await this.plugin.saveSettings();
      this.selectedPromptIndex = -1;
      new import_obsidian3.Notice("Prompt saved.", 2e3);
      this.display();
    });
    const deleteBtn = actionRow.createEl("button", { text: "Delete prompt", cls: "mod-warning" });
    deleteBtn.addEventListener("click", async () => {
      s.prompts.splice(idx, 1);
      this.selectedPromptIndex = -1;
      await this.plugin.saveSettings();
      this.display();
    });
  }
  /**
   * Append a textarea to `container` and return it.
   *
   * @param container - Parent element to append the textarea to.
   * @param value - Initial text content.
   * @param rows - Initial row count for the textarea.
   * @param onChange - Callback invoked on every input event with the current value.
   */
  createTextarea(container, value, rows, onChange) {
    const ta = container.createEl("textarea", { cls: "wr-textarea" });
    ta.value = value;
    ta.rows = rows;
    ta.style.width = "100%";
    ta.style.marginBottom = "0.75em";
    ta.addEventListener("input", () => onChange(ta.value));
    return ta;
  }
};

// src/file-resolver.ts
var WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
var FENCED_BLOCK_RE = (lang) => new RegExp("```" + lang + "\\s*\\n([\\s\\S]*?)```", "gi");
function isTFile(f) {
  return typeof (f == null ? void 0 : f.path) === "string";
}
function resolveVaultFile(app, rawPath) {
  var _a, _b;
  const withMd = rawPath.endsWith(".md") ? rawPath : `${rawPath}.md`;
  const exact = (_a = app.vault.getAbstractFileByPath(withMd)) != null ? _a : app.vault.getAbstractFileByPath(rawPath);
  if (isTFile(exact)) return exact;
  const lower = rawPath.toLowerCase();
  return (_b = app.vault.getMarkdownFiles().find(
    (f) => f.basename.toLowerCase() === lower || f.path.toLowerCase() === lower || f.path.toLowerCase() === `${lower}.md`
  )) != null ? _b : null;
}
async function resolveDataviewBlocks(app, content) {
  var _a, _b;
  const dvPlugin = (_b = (_a = app.plugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["dataview"];
  if (!(dvPlugin == null ? void 0 : dvPlugin.api)) {
    return content.replace(FENCED_BLOCK_RE("dataview"), "[dataview block \u2014 plugin not installed]").replace(FENCED_BLOCK_RE("dataviewjs"), "[dataviewjs block \u2014 plugin not installed]");
  }
  const api = dvPlugin.api;
  async function replaceBlocks(src, lang) {
    var _a2;
    const re = FENCED_BLOCK_RE(lang);
    const matches = [...src.matchAll(re)];
    for (const match of matches) {
      const query = match[1].trim();
      try {
        const result = await api.queryMarkdown(query);
        const rendered = (result == null ? void 0 : result.successful) ? result.value : `[dataview error: ${(_a2 = result == null ? void 0 : result.error) != null ? _a2 : "unknown"}]`;
        src = src.replace(match[0], rendered);
      } catch (e) {
        src = src.replace(match[0], "[dataview error: query failed]");
      }
    }
    return src;
  }
  content = await replaceBlocks(content, "dataview");
  content = await replaceBlocks(content, "dataviewjs");
  return content;
}
async function resolveFileLinks(text, app, visited = /* @__PURE__ */ new Set()) {
  const matches = [...text.matchAll(WIKILINK_RE)];
  if (matches.length === 0) return text;
  const fileContents = [];
  for (const match of matches) {
    const rawPath = match[1].trim();
    const file = resolveVaultFile(app, rawPath);
    if (!file) {
      text = text.replace(match[0], `[FILE: ${rawPath} \u2014 not found]`);
      continue;
    }
    text = text.replace(match[0], `[FILE: ${file.path}]`);
    if (visited.has(file.path)) continue;
    visited.add(file.path);
    let raw = await app.vault.read(file);
    raw = await resolveDataviewBlocks(app, raw);
    if (WIKILINK_RE.test(raw)) {
      WIKILINK_RE.lastIndex = 0;
      raw = await resolveFileLinks(raw, app, visited);
    }
    fileContents.push({ path: file.path, content: raw });
  }
  if (fileContents.length === 0) return text;
  const appendix = fileContents.map((f) => `[CONTENTS OF FILE: ${f.path}]
${f.content}`).join("\n\n");
  return `${text}

${appendix}`;
}

// src/engine.ts
var DEFAULT_VARIATION_COUNT = 3;
function resolveSystemPrompt(prompt, defaults) {
  return prompt.systemPrompt.trim() || defaults[prompt.mode];
}
var CONTEXT_WINDOW_CHARS = 500;
function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    var _a;
    return (_a = vars[key]) != null ? _a : "";
  });
}
function getSelectionContext(editor) {
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
function getParagraphContext(editor) {
  const cursor = editor.getCursor();
  const lines = [];
  for (let i = cursor.line; i >= 0; i--) {
    const line = editor.getLine(i);
    if (i < cursor.line && line.trim() === "") break;
    lines.unshift(line);
  }
  return lines.join("\n");
}
async function runCollaborate(editor, provider, prompt, app, defaultSystemPrompts) {
  const before = getParagraphContext(editor);
  const resolvedTemplate = await resolveFileLinks(prompt.userPromptTemplate, app);
  const userPrompt = renderTemplate(resolvedTemplate, { before });
  const response = await provider.complete({
    systemPrompt: resolveSystemPrompt(prompt, defaultSystemPrompts),
    userPrompt
  });
  const cursor = editor.getCursor("to");
  editor.replaceRange(response.text, cursor);
}
async function runRewrite(editor, provider, prompt, app, defaultSystemPrompts) {
  const selected = editor.getSelection();
  if (!selected) {
    throw new Error("Rewrite mode requires selected text.");
  }
  const { before, after } = getSelectionContext(editor);
  const resolvedTemplate = await resolveFileLinks(prompt.userPromptTemplate, app);
  const userPrompt = renderTemplate(resolvedTemplate, {
    selected,
    before,
    after
  });
  const response = await provider.complete({
    systemPrompt: resolveSystemPrompt(prompt, defaultSystemPrompts),
    userPrompt
  });
  editor.replaceSelection(response.text);
}
async function runVariations(editor, provider, prompt, app, defaultSystemPrompts, count = DEFAULT_VARIATION_COUNT) {
  const selected = editor.getSelection();
  if (!selected) {
    throw new Error("Variations mode requires selected text.");
  }
  const { before, after } = getSelectionContext(editor);
  const n = String(count);
  const systemPrompt = renderTemplate(resolveSystemPrompt(prompt, defaultSystemPrompts), { n });
  const resolvedTemplate = await resolveFileLinks(prompt.userPromptTemplate, app);
  const userPrompt = renderTemplate(resolvedTemplate, {
    selected,
    before,
    after,
    n
  });
  const response = await provider.complete({
    systemPrompt,
    userPrompt,
    maxTokens: 1024 * Math.ceil(count / 2),
    temperature: 0.9
  });
  return parseVariations(response.text);
}
function parseVariations(raw) {
  const numbered = raw.split("\n").map((line) => line.replace(/^\d+[.)\s]\s*/, "").trim()).filter(Boolean);
  if (numbered.length > 0) return numbered;
  return raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
}

// src/variations-modal.ts
var import_obsidian4 = require("obsidian");
var VariationsModal = class extends import_obsidian4.Modal {
  constructor(app, editor, provider, prompt, count, defaultSystemPrompts) {
    super(app);
    this.editor = editor;
    this.provider = provider;
    this.prompt = prompt;
    this.count = count;
    this.defaultSystemPrompts = defaultSystemPrompts;
    this.variations = [];
    this.selectedIndex = 0;
    this.isLoading = false;
  }
  /** @inheritdoc */
  onOpen() {
    this.modalEl.addClass("wr-variations-modal");
    this.titleEl.setText("Variations");
    this.statusEl = this.contentEl.createDiv({ cls: "wr-variations-status" });
    this.listEl = this.contentEl.createDiv({ cls: "wr-variations-list" });
    const hint = this.contentEl.createDiv({ cls: "wr-variations-hint" });
    hint.innerHTML = [
      "<code>\u2191\u2193</code><br>navigate",
      "<code>\u21B5</code><br>accept",
      "<code>Shift + \u21B5</code><br>regenerate",
      "<code>Ctrl/\u2318 + A</code><br>copy all",
      "<code>Esc</code><br>cancel"
    ].map((item) => `<div>${item}</div>`).join("");
    this.modalEl.tabIndex = 0;
    this.modalEl.addEventListener("keydown", this.onKeyDown.bind(this));
    this.modalEl.focus();
    this.generate();
  }
  /** @inheritdoc */
  onClose() {
    this.contentEl.empty();
  }
  // ── Private helpers ──────────────────────────────────────────────────────
  /**
   * Call the engine to fetch a fresh set of variations, then re-render.
   * Disables keyboard input while in-flight.
   */
  async generate() {
    this.isLoading = true;
    this.selectedIndex = 0;
    this.renderList([]);
    this.statusEl.setText("Generating\u2026");
    try {
      this.variations = await runVariations(
        this.editor,
        this.provider,
        this.prompt,
        this.app,
        this.defaultSystemPrompts,
        this.count
      );
      if (this.variations.length === 0) {
        this.statusEl.setText("No variations returned. Try again.");
      } else {
        this.statusEl.setText(
          `${this.variations.length} variation${this.variations.length === 1 ? "" : "s"} \u2014 pick one:`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.statusEl.setText(`Error: ${msg}`);
      new import_obsidian4.Notice(`Variations failed: ${msg}`, 5e3);
    }
    this.isLoading = false;
    this.renderList(this.variations);
  }
  /** Re-render the variation list, highlighting `selectedIndex`. */
  renderList(items) {
    this.listEl.empty();
    if (items.length === 0) return;
    items.forEach((text, i) => {
      const row = this.listEl.createDiv({
        cls: "wr-variation-item" + (i === this.selectedIndex ? " wr-variation-selected" : "")
      });
      const num = row.createSpan({ cls: "wr-variation-num" });
      num.setText(`${i + 1}.`);
      const body = row.createSpan({ cls: "wr-variation-text" });
      body.setText(text);
      row.addEventListener("click", () => {
        this.selectedIndex = i;
        this.accept();
      });
      row.addEventListener("mouseover", () => {
        this.selectedIndex = i;
        this.highlightSelected();
      });
    });
  }
  /** Update CSS classes without full re-render. */
  highlightSelected() {
    const rows = this.listEl.querySelectorAll(".wr-variation-item");
    rows.forEach((el, i) => {
      el.classList.toggle("wr-variation-selected", i === this.selectedIndex);
    });
  }
  /** Copy all variations to the clipboard as a numbered list. */
  copyAll() {
    if (this.variations.length === 0) return;
    const text = this.variations.map((v, i) => `${i + 1}. ${v}`).join("\n\n");
    navigator.clipboard.writeText(text).then(
      () => new import_obsidian4.Notice("All variations copied.", 2e3),
      () => new import_obsidian4.Notice("Failed to copy to clipboard.", 3e3)
    );
  }
  /** Replace the editor selection with the currently highlighted variation. */
  accept() {
    const text = this.variations[this.selectedIndex];
    if (text) {
      this.editor.replaceSelection(text);
    }
    this.close();
  }
  /** Handle keyboard navigation. */
  onKeyDown(evt) {
    if (this.isLoading) return;
    switch (evt.key) {
      case "ArrowDown":
        evt.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.variations.length - 1
        );
        this.highlightSelected();
        break;
      case "ArrowUp":
        evt.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.highlightSelected();
        break;
      case "Enter":
        evt.preventDefault();
        if (evt.shiftKey) {
          this.generate();
        } else {
          this.accept();
        }
        break;
      case "a":
        if (evt.ctrlKey || evt.metaKey) {
          evt.preventDefault();
          this.copyAll();
        }
        break;
      case "Escape":
        evt.preventDefault();
        this.close();
        break;
    }
  }
};

// src/main.ts
var MODEL_CACHE_TTL_MS = 60 * 60 * 1e3;
var ModelCache = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
  }
  /**
   * Return cached models for `key` if still fresh, or `null` if missing/stale.
   *
   * @param key - Provider identifier.
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > MODEL_CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.models;
  }
  /**
   * Store a model list for `key`, resetting the TTL.
   *
   * @param key - Provider identifier.
   * @param models - Model list to cache.
   */
  set(key, models) {
    this.cache.set(key, { models, fetchedAt: Date.now() });
  }
  /** Invalidate the cached list for `key`, forcing a fresh fetch next time. */
  invalidate(key) {
    this.cache.delete(key);
  }
};
var writebraightPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    /** Shared in-memory model cache, lives for the duration of the Obsidian session. */
    this.modelCache = new ModelCache();
  }
  /** Called by Obsidian when the plugin is enabled. Registers all commands and UI elements. */
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new writebraightSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(async () => {
      const target = this.settings.promptsFilePath || PROMPTS_FILE_PATH;
      try {
        const loaded = await loadPromptsFile(this.app, target);
        this.settings.prompts = loaded.prompts;
        this.settings.defaultSystemPrompts = loaded.defaultSystemPrompts;
        this.reconcileDefaultPromptIds();
      } catch (e) {
        console.error("Elf: failed to load prompts file", e);
      }
      this.registerEvent(
        this.app.vault.on("modify", async (file) => {
          const t = this.settings.promptsFilePath || PROMPTS_FILE_PATH;
          if (file.path === t) {
            try {
              const reloaded = await loadPromptsFile(this.app, t);
              this.settings.prompts = reloaded.prompts;
              this.settings.defaultSystemPrompts = reloaded.defaultSystemPrompts;
              this.reconcileDefaultPromptIds();
            } catch (e) {
              console.error("Elf: failed to reload prompts file", e);
            }
          }
        })
      );
    });
    this.addCommand({
      id: "collaborate-default",
      name: "Collaborate: continue writing (apply default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "c" }],
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        try {
          this.runEditorAction(editor, "collaborate", this.getDefaultCollaboratePrompt());
        } catch (e) {
          new import_obsidian5.Notice(`Error: ${e instanceof Error ? e.message : String(e)}`, 5e3);
        }
      }
    });
    this.addCommand({
      id: "rewrite-default",
      name: "Rewrite: rewrite selection (apply default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "r" }],
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        try {
          this.runEditorAction(editor, "rewrite", this.getDefaultRewritePrompt());
        } catch (e) {
          new import_obsidian5.Notice(`Error: ${e instanceof Error ? e.message : String(e)}`, 5e3);
        }
      }
    });
    this.addCommand({
      id: "collaborate-pick",
      name: "Collaborate: pick a prompt\u2026",
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        this.showPromptPicker(
          "collaborate",
          (prompt) => this.runEditorAction(editor, "collaborate", prompt)
        );
      }
    });
    this.addCommand({
      id: "rewrite-pick",
      name: "Rewrite: pick a prompt\u2026",
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        this.showPromptPicker(
          "rewrite",
          (prompt) => this.runEditorAction(editor, "rewrite", prompt)
        );
      }
    });
    this.addCommand({
      id: "variations-default",
      name: "Variations: generate variations (apply default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        try {
          this.openVariationsModal(editor, this.getDefaultVariationsPrompt());
        } catch (e) {
          new import_obsidian5.Notice(`Error: ${e instanceof Error ? e.message : String(e)}`, 5e3);
        }
      }
    });
    this.addCommand({
      id: "variations-pick",
      name: "Variations: pick a prompt\u2026",
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        this.showPromptPicker(
          "variations",
          (prompt) => this.openVariationsModal(editor, prompt)
        );
      }
    });
    this.addCommand({
      id: "select-provider-model",
      name: "Select provider and model\u2026",
      callback: () => this.showProviderModelPicker()
    });
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu, editor, _view) => {
          if (!editor.getSelection()) return;
          menu.addItem(
            (item) => item.setTitle("Rewrite with AI (default)").setIcon("pencil").onClick(() => this.runEditorAction(editor, "rewrite", this.getDefaultRewritePrompt()))
          );
          menu.addItem(
            (item) => item.setTitle("Rewrite with AI\u2026").setIcon("wand").onClick(
              () => this.showPromptPicker(
                "rewrite",
                (prompt) => this.runEditorAction(editor, "rewrite", prompt)
              )
            )
          );
          menu.addItem(
            (item) => item.setTitle("Generate variations\u2026").setIcon("shuffle").onClick(
              () => this.showPromptPicker(
                "variations",
                (prompt) => this.openVariationsModal(editor, prompt)
              )
            )
          );
        }
      )
    );
  }
  /** Called by Obsidian when the plugin is disabled. Nothing to clean up beyond what Obsidian handles. */
  onunload() {
  }
  /** Load settings from disk, merging with defaults to handle missing keys. */
  async loadSettings() {
    const stored = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
    if (!this.settings.apiKeys) {
      this.settings.apiKeys = { ...DEFAULT_SETTINGS.apiKeys };
    }
    if (stored == null ? void 0 : stored.apiKey) {
      this.settings.apiKeys[this.settings.provider] = stored.apiKey;
    }
  }
  /** Persist current settings to disk. */
  async saveSettings() {
    await savePromptsFile(
      this.app,
      this.settings.prompts,
      this.settings.defaultSystemPrompts,
      this.settings.promptsFilePath || PROMPTS_FILE_PATH
    );
    const { prompts: _prompts, ...rest } = this.settings;
    await this.saveData(rest);
  }
  /**
   * After (re)loading prompts, reset any stored default prompt ID that no
   * longer exists to the first available prompt of that mode.
   * This handles migrations where prompt IDs have changed.
   */
  reconcileDefaultPromptIds() {
    const ids = (mode) => this.settings.prompts.filter((p) => p.mode === mode).map((p) => p.id);
    const fix = (current, mode, setter) => {
      const available = ids(mode);
      if (!available.includes(current) && available.length > 0) {
        setter(available[0]);
      }
    };
    fix(
      this.settings.defaultCollaboratePromptId,
      "collaborate",
      (id) => {
        this.settings.defaultCollaboratePromptId = id;
      }
    );
    fix(
      this.settings.defaultRewritePromptId,
      "rewrite",
      (id) => {
        this.settings.defaultRewritePromptId = id;
      }
    );
    fix(
      this.settings.defaultVariationsPromptId,
      "variations",
      (id) => {
        this.settings.defaultVariationsPromptId = id;
      }
    );
  }
  /**
   * Look up the default Collaborate prompt from the library.
   * Falls back to the first collaborate prompt if the stored ID is missing.
   */
  getDefaultCollaboratePrompt() {
    var _a, _b;
    return (_b = (_a = this.settings.prompts.find((p) => p.id === this.settings.defaultCollaboratePromptId)) != null ? _a : this.settings.prompts.find((p) => p.mode === "collaborate")) != null ? _b : (() => {
      throw new Error("No collaborate prompts found.");
    })();
  }
  /**
   * Look up the default Variations prompt from the library.
   * Falls back to the first variations prompt if the stored ID is missing.
   */
  getDefaultVariationsPrompt() {
    var _a, _b;
    return (_b = (_a = this.settings.prompts.find((p) => p.id === this.settings.defaultVariationsPromptId)) != null ? _a : this.settings.prompts.find((p) => p.mode === "variations")) != null ? _b : (() => {
      throw new Error("No variations prompts found.");
    })();
  }
  /**
   * Look up the default Rewrite prompt from the library.
   * Falls back to the first rewrite prompt if the stored ID is missing.
   */
  getDefaultRewritePrompt() {
    var _a, _b;
    return (_b = (_a = this.settings.prompts.find((p) => p.id === this.settings.defaultRewritePromptId)) != null ? _a : this.settings.prompts.find((p) => p.mode === "rewrite")) != null ? _b : (() => {
      throw new Error("No rewrite prompts found.");
    })();
  }
  /**
   * Open a fuzzy-search picker listing all prompts for `mode`.
   *
   * @param mode - Filter prompts to this mode.
   * @param onSelect - Called with the chosen prompt.
   */
  showPromptPicker(mode, onSelect) {
    const prompts = this.settings.prompts.filter((p) => p.mode === mode);
    if (prompts.length === 0) {
      new import_obsidian5.Notice("No prompts configured for this mode.");
      return;
    }
    const app = this.app;
    class PromptPicker extends import_obsidian5.FuzzySuggestModal {
      constructor() {
        super(app);
      }
      getItems() {
        return prompts;
      }
      getItemText(item) {
        return item.name;
      }
      onChooseItem(item) {
        onSelect(item);
      }
    }
    new PromptPicker().open();
  }
  /**
   * Open a two-step picker to select provider, then model.
   * First shows provider list (defaulting to current), then model list
   * (defaulting to current model for that provider).
   */
  showProviderModelPicker() {
    const providers = Object.keys(PROVIDER_DEFAULT_MODELS);
    const app = this.app;
    const settings = this.settings;
    const plugin = this;
    class ProviderPicker extends import_obsidian5.FuzzySuggestModal {
      constructor() {
        super(app);
      }
      getItems() {
        return providers;
      }
      getItemText(item) {
        return item;
      }
      onChooseItem(provider) {
        var _a;
        if (!settings.modelPerProvider) settings.modelPerProvider = {};
        settings.modelPerProvider[settings.provider] = settings.model;
        settings.provider = provider;
        settings.model = (_a = settings.modelPerProvider[settings.provider]) != null ? _a : PROVIDER_DEFAULT_MODELS[settings.provider];
        plugin.saveSettings();
        plugin.showModelPicker();
      }
    }
    new ProviderPicker().open();
  }
  /**
   * Show model picker for the currently selected provider.
   * Defaults to the currently selected model.
   */
  async showModelPicker() {
    const app = this.app;
    const plugin = this;
    let models = this.modelCache.get(this.settings.provider);
    if (!models) {
      const notice = new import_obsidian5.Notice("Loading models\u2026", 0);
      try {
        models = await createProvider(this.settings).listModels();
        this.modelCache.set(this.settings.provider, models);
      } catch (e) {
        models = [];
      }
      notice.hide();
    }
    const modelList = models != null ? models : [];
    if (modelList.length === 0) {
      new import_obsidian5.Notice("Could not fetch models. Check your API key.", 5e3);
      return;
    }
    class ModelPicker extends import_obsidian5.FuzzySuggestModal {
      constructor() {
        super(app);
      }
      getItems() {
        return modelList;
      }
      getItemText(item) {
        return item;
      }
      onChooseItem(model) {
        plugin.settings.model = model;
        if (!plugin.settings.modelPerProvider) plugin.settings.modelPerProvider = {};
        plugin.settings.modelPerProvider[plugin.settings.provider] = model;
        plugin.saveSettings();
        new import_obsidian5.Notice(`Model set to ${model}`, 2e3);
      }
    }
    new ModelPicker().open();
  }
  /**
   * Open the Variations modal for the given editor and prompt.
   *
   * @param editor - The active editor.
   * @param prompt - Prompt whose `mode` must be `"variations"`.
   */
  openVariationsModal(editor, prompt) {
    new VariationsModal(this.app, editor, createProvider(this.settings), prompt, this.settings.variationCount, this.settings.defaultSystemPrompts).open();
  }
  /**
   * Dispatch a Collaborate or Rewrite action, showing a persistent notice
   * while the request is in-flight. Variations uses `openVariationsModal`.
   *
   * @param editor - The active editor.
   * @param mode - `"collaborate"` or `"rewrite"`.
   * @param prompt - Prompt to use.
   */
  async runEditorAction(editor, mode, prompt) {
    const labels = {
      collaborate: ["Collaborating\u2026", "Done."],
      rewrite: ["Rewriting\u2026", "Done."]
    };
    const [startMsg, endMsg] = labels[mode];
    const run = mode === "collaborate" ? () => runCollaborate(editor, createProvider(this.settings), prompt, this.app, this.settings.defaultSystemPrompts) : () => runRewrite(editor, createProvider(this.settings), prompt, this.app, this.settings.defaultSystemPrompts);
    await this.runWithNotice(run, startMsg, endMsg);
  }
  /**
   * Run an async function while showing a persistent Obsidian notice.
   * Replaces the notice with a success or error message when done.
   *
   * @param fn - The async operation to run.
   * @param startMsg - Notice text shown while `fn` is running.
   * @param endMsg - Notice text shown on success.
   */
  getActiveEditor() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    if (!view) {
      new import_obsidian5.Notice("No active editor.", 3e3);
      return null;
    }
    return view.editor;
  }
  async runWithNotice(fn, startMsg, endMsg) {
    const notice = new import_obsidian5.Notice(startMsg, 0);
    try {
      await fn();
      notice.hide();
      new import_obsidian5.Notice(endMsg, 2e3);
    } catch (e) {
      notice.hide();
      new import_obsidian5.Notice(
        `Error: ${e instanceof Error ? e.message : String(e)}`,
        5e3
      );
    }
  }
};
