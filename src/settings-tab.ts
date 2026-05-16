import { App, FuzzySuggestModal, Notice, PluginSettingTab, Setting, TextComponent } from "obsidian";
import WriterRewriterPlugin from "./main";
import { ModeType, PluginSettings, ProviderType } from "./types";
import { createProvider, PROVIDER_DEFAULT_MODELS } from "./providers/factory";
import { savePromptsFile, PROMPTS_FILE_PATH } from "./prompt-file";

const PROVIDERS: { value: ProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "mistral", label: "Mistral" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "openrouter", label: "OpenRouter" },
];

/**
 * Settings tab rendered under Obsidian's Settings → Plugin Options panel.
 *
 * Sections:
 * - Provider selection and API key configuration
 * - Model selection with auto-fetch from provider APIs
 * - Default prompt selection for each mode
 * - Prompt library inline editing with file picker
 */
export class WriterRewriterSettingTab extends PluginSettingTab {
  /** Index of the prompt currently open in the inline editor (-1 = none). */
  private selectedPromptIndex = -1;

  constructor(app: App, private plugin: WriterRewriterPlugin) {
    super(app, plugin);
  }

  /** Re-render the entire settings panel (called on load and after provider changes). */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Writer Rewriter Settings" });

    const s = this.plugin.settings;
    const modelSectionEl = document.createElement("div");
    this.renderProviderSection(containerEl, s, modelSectionEl);
    containerEl.appendChild(modelSectionEl);
    void this.renderModelSection(modelSectionEl, s);
    this.renderDefaultPromptsSection(containerEl, s);
    this.renderPromptLibrarySection(containerEl, s);
  }

  /** Render the provider dropdown and credential input (API key or Ollama URL). */
  private renderProviderSection(
    el: HTMLElement,
    s: PluginSettings,
    modelSectionEl: HTMLElement
  ): void {
    new Setting(el)
      .setName("Provider")
      .setDesc("AI provider to use for completions.")
      .addDropdown((drop) => {
        PROVIDERS.forEach(({ value, label }) => drop.addOption(value, label));
        drop.setValue(s.provider);
        drop.onChange(async (value) => {
          s.provider = value as ProviderType;
          s.model = PROVIDER_DEFAULT_MODELS[s.provider];
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (s.provider === "ollama") {
      new Setting(el)
        .setName("Ollama base URL")
        .setDesc("Base URL for the local Ollama server.")
        .addText((text) =>
          text
            .setPlaceholder("http://localhost:11434")
            .setValue(s.ollamaBaseUrl)
            .onChange(async (value) => {
              s.ollamaBaseUrl = value;
              await this.plugin.saveSettings();
            })
        );
    } else {
      let keyInput: TextComponent;
      let visible = false;

      new Setting(el)
        .setName("API Key")
        .setDesc(`API key for ${s.provider}.`)
        .addText((text) => {
          keyInput = text;
          text
            .setPlaceholder("sk-…")
            .setValue((s.apiKeys ?? {})[s.provider] ?? "")
            .onChange(async (value) => {
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
        })
        .addButton((btn) => {
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
  private async renderModelSection(el: HTMLElement, s: PluginSettings): Promise<void> {
    const modelSetting = new Setting(el).setName("Model");
    const hasKey = s.provider === "ollama" || !!(s.apiKeys?.[s.provider]);

    // Container to hold dropdown reference once created
    let dropdown: import("obsidian").DropdownComponent | null = null;

    const populateDropdown = (models: string[]) => {
      if (!dropdown) return;
      dropdown.selectEl.empty();
      if (models.length === 0) {
        dropdown.addOption("", "— no models available —");
        dropdown.setDisabled(true);
        modelSetting.setDesc("No models available.");
      } else {
        models.forEach((m) => dropdown!.addOption(m, m));
        if (!models.includes(s.model)) s.model = models[0];
        dropdown.setValue(s.model);
        dropdown.setDisabled(false);
        modelSetting.setDesc("Model to use for completions.");
      }
    };

    // Create dropdown initially disabled with placeholder
    modelSetting.addDropdown((drop) => {
      dropdown = drop;
      drop.addOption("", hasKey ? "— select a model —" : "— enter API key first —");
      drop.setDisabled(!hasKey);
      drop.onChange(async (value) => {
        if (value) {
          s.model = value;
          await this.plugin.saveSettings();
        }
      });
    });

    modelSetting.addButton((btn) => {
      btn.setButtonText("Refresh");
      btn.setDisabled(!hasKey);
      btn.onClick(async () => {
        btn.setDisabled(true);
        btn.setButtonText("Loading…");
        try {
          const fetched = await createProvider(s).listModels();
          populateDropdown(fetched);
        } catch {
          populateDropdown([]);
        }
        btn.setButtonText("Refresh");
        btn.setDisabled(false);
      });
    });

    // Load models if key is present
    if (hasKey) {
      modelSetting.setDesc("Loading models…");
      try {
        const fetched = await createProvider(s).listModels();
        populateDropdown(fetched);
      } catch {
        populateDropdown([]);
      }
    } else {
      modelSetting.setDesc("Enter your API key above to load available models.");
    }
  }

  /** Render dropdowns for the default Collaborate, Rewrite, and Variations prompts. */
  private renderDefaultPromptsSection(el: HTMLElement, s: PluginSettings): void {
    el.createEl("h3", { text: "Default Prompts" });

    new Setting(el)
      .setName("Default Collaborate prompt")
      .addDropdown((drop) => {
        s.prompts
          .filter((p) => p.mode === "collaborate")
          .forEach((p) => drop.addOption(p.id, p.name));
        drop.setValue(s.defaultCollaboratePromptId);
        drop.onChange(async (value) => {
          s.defaultCollaboratePromptId = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(el)
      .setName("Default Rewrite prompt")
      .addDropdown((drop) => {
        s.prompts
          .filter((p) => p.mode === "rewrite")
          .forEach((p) => drop.addOption(p.id, p.name));
        drop.setValue(s.defaultRewritePromptId);
        drop.onChange(async (value) => {
          s.defaultRewritePromptId = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(el)
      .setName("Default Variations prompt")
      .addDropdown((drop) => {
        s.prompts
          .filter((p) => p.mode === "variations")
          .forEach((p) => drop.addOption(p.id, p.name));
        drop.setValue(s.defaultVariationsPromptId);
        drop.onChange(async (value) => {
          s.defaultVariationsPromptId = value;
          await this.plugin.saveSettings();
        });
      });
  }

  /** Render inline prompt library: dropdown to select prompt + editor for selected. */
  private renderPromptLibrarySection(el: HTMLElement, s: PluginSettings): void {
    const existingSection = el.querySelector(".wr-prompt-library-section");
    let sectionEl: HTMLElement;
    if (existingSection) {
      sectionEl = existingSection as HTMLElement;
      sectionEl.empty();
    } else {
      sectionEl = el.createDiv({ cls: "wr-prompt-library-section" });
    }
    sectionEl.createEl("h3", { text: "Prompt Library" });

    const app = this.app;
    new Setting(sectionEl)
      .setName("Prompts file")
      .setDesc(s.promptsFilePath ?? PROMPTS_FILE_PATH)
      .addButton((btn) => {
        btn.setButtonText("Change").onClick(() => {
          const mdFiles = app.vault.getMarkdownFiles().map((f) => f.path).sort();
          const plugin = this.plugin;
          const redisplay = () => this.display();
          class FilePicker extends FuzzySuggestModal<string> {
            constructor() { super(app); }
            getItems(): string[] { return mdFiles; }
            getItemText(item: string): string { return item; }
            onChooseItem(item: string): void {
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

    new Setting(sectionEl)
      .setName("Prompt")
      .setDesc("Select a prompt to edit, or add a new one.")
      .addDropdown((drop) => {
        drop.addOption("-1", "— select a prompt —");
        promptOptions.forEach((p, i) =>
          drop.addOption(String(i), `[${p.mode}] ${p.name}`)
        );
        drop.setValue(String(this.selectedPromptIndex));
        drop.onChange((val) => {
          this.selectedPromptIndex = Number(val);
          this.renderPromptLibrarySection(el, s);
        });
      })
      .addButton((btn) =>
        btn.setButtonText("+ Add").onClick(async () => {
          s.prompts.push({
            id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: "New prompt",
            mode: "rewrite",
            systemPrompt: "",
            userPromptTemplate: "",
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

    const save = async () => {
      await savePromptsFile(this.app, s.prompts, s.promptsFilePath);
      await this.plugin.saveSettings();
    };

    // ── Row 1: name + mode on one line ──────────────────────────────────────
    const metaRow = editorEl.createDiv({ cls: "wr-prompt-meta-row" });

    const nameWrap = metaRow.createDiv({ cls: "wr-prompt-meta-field" });
    nameWrap.createEl("label", { text: "Name", cls: "wr-field-label" });
    const nameInput = nameWrap.createEl("input", { type: "text" }) as HTMLInputElement;
    nameInput.value = prompt.name;
    nameInput.style.width = "100%";
    nameInput.addEventListener("input", async () => {
      s.prompts[idx].name = nameInput.value;
      await save();
    });

    const modeWrap = metaRow.createDiv({ cls: "wr-prompt-meta-field" });
    modeWrap.createEl("label", { text: "Mode", cls: "wr-field-label" });
    const modeSelect = modeWrap.createEl("select") as HTMLSelectElement;
    (["collaborate", "rewrite", "variations"] as ModeType[]).forEach((m) => {
      const opt = modeSelect.createEl("option", { value: m, text: m.charAt(0).toUpperCase() + m.slice(1) });
      if (m === prompt.mode) opt.selected = true;
    });
    modeSelect.addEventListener("change", async () => {
      s.prompts[idx].mode = modeSelect.value as ModeType;
      await save();
    });

    // ── Row 2: system prompt textarea ────────────────────────────────────────
    editorEl.createEl("label", { text: "System prompt", cls: "wr-field-label" });
    this.addTextarea(editorEl, prompt.systemPrompt, 4, async (v) => {
      s.prompts[idx].systemPrompt = v;
      await save();
    });

    // ── Row 3: user prompt textarea ──────────────────────────────────────────
    editorEl.createEl("label", { text: "User prompt template", cls: "wr-field-label" });
    editorEl.createEl("p", {
      text: "Placeholders: {{context}}, {{selected}}, {{before}}, {{after}}, {{n}}",
      cls: "setting-item-description wr-placeholder-hint",
    });
    this.addTextarea(editorEl, prompt.userPromptTemplate, 4, async (v) => {
      s.prompts[idx].userPromptTemplate = v;
      await save();
    });

    // ── Delete button ─────────────────────────────────────────────────────────
    const deleteRow = editorEl.createDiv({ cls: "wr-prompt-delete-row" });
    const deleteBtn = deleteRow.createEl("button", { text: "Delete prompt", cls: "mod-warning" });
    deleteBtn.addEventListener("click", async () => {
      s.prompts.splice(idx, 1);
      this.selectedPromptIndex = -1;
      await this.plugin.saveSettings();
      this.display();
    });
  }

  /**
   * Append an auto-resizing textarea to `container`.
   *
   * @param container - Parent element to append the textarea to.
   * @param value - Initial text content.
   * @param rows - Initial row count for the textarea.
   * @param onChange - Callback invoked on every input event with the current value.
   */
  private addTextarea(
    container: HTMLElement,
    value: string,
    rows: number,
    onChange: (v: string) => void
  ): void {
    const ta = container.createEl("textarea", { cls: "wr-textarea" }) as HTMLTextAreaElement;
    ta.value = value;
    ta.rows = rows;
    ta.style.width = "100%";
    ta.style.marginBottom = "0.75em";
    ta.addEventListener("input", () => onChange(ta.value));
  }
}
