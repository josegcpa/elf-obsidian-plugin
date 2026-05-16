import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import WriterRewriterPlugin from "./main";
import { PluginSettings, ProviderType } from "./types";
import { createProvider, PROVIDER_DEFAULT_MODELS } from "./providers/factory";
import { pushPromptsToGist, pullPromptsFromGist } from "./github-sync";

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
 * Sections: provider, model, default prompts, GitHub Gist sync.
 */
export class WriterRewriterSettingTab extends PluginSettingTab {
  /** Cached model list populated by "Load models" button. */
  private modelOptions: string[] = [];

  constructor(app: App, private plugin: WriterRewriterPlugin) {
    super(app, plugin);
  }

  /** Re-render the entire settings panel (called on load and after provider changes). */
  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Writer Rewriter Settings" });

    const s = this.plugin.settings;
    this.renderProviderSection(containerEl, s);
    this.renderModelSection(containerEl, s);
    this.renderDefaultPromptsSection(containerEl, s);
    this.renderGistSyncSection(containerEl, s);
  }

  /** Render the provider dropdown and credential input (API key or Ollama URL). */
  private renderProviderSection(el: HTMLElement, s: PluginSettings): void {
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
      new Setting(el)
        .setName("API Key")
        .setDesc("API key for the selected provider.")
        .addText((text) => {
          text
            .setPlaceholder("sk-…")
            .setValue(s.apiKey)
            .onChange(async (value) => {
              s.apiKey = value;
              await this.plugin.saveSettings();
            });
          text.inputEl.type = "password";
        });
    }
  }

  /**
   * Render the model row.
   *
   * Shows a free-text input by default. Clicking "Load models" fetches the
   * available model list from the provider and replaces the input with a
   * dropdown.
   */
  private renderModelSection(el: HTMLElement, s: PluginSettings): void {
    const modelSetting = new Setting(el)
      .setName("Model")
      .setDesc("Model to use for completions.");

    const refreshModels = async () => {
      try {
        const provider = createProvider(s);
        this.modelOptions = await provider.listModels();
      } catch {
        this.modelOptions = [];
      }

      modelSetting.clear();
      modelSetting.setName("Model").setDesc("Model to use for completions.");

      if (this.modelOptions.length > 0) {
        modelSetting.addDropdown((drop) => {
          this.modelOptions.forEach((m) => drop.addOption(m, m));
          if (!this.modelOptions.includes(s.model)) {
            s.model = this.modelOptions[0];
          }
          drop.setValue(s.model);
          drop.onChange(async (value) => {
            s.model = value;
            await this.plugin.saveSettings();
          });
        });
      } else {
        modelSetting.addText((text) =>
          text
            .setPlaceholder(PROVIDER_DEFAULT_MODELS[s.provider])
            .setValue(s.model)
            .onChange(async (value) => {
              s.model = value;
              await this.plugin.saveSettings();
            })
        );
      }
    };

    modelSetting.addButton((btn) =>
      btn.setButtonText("Load models").onClick(async () => {
        btn.setDisabled(true);
        btn.setButtonText("Loading…");
        await refreshModels();
        btn.setDisabled(false);
        btn.setButtonText("Refresh");
      })
    );

    modelSetting.addText((text) =>
      text
        .setPlaceholder(PROVIDER_DEFAULT_MODELS[s.provider])
        .setValue(s.model)
        .onChange(async (value) => {
          s.model = value;
          await this.plugin.saveSettings();
        })
    );
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

  /** Render GitHub token, Gist ID, and push/pull buttons. */
  private renderGistSyncSection(el: HTMLElement, s: PluginSettings): void {
    el.createEl("h3", { text: "GitHub Gist Sync (Prompt Library)" });

    new Setting(el)
      .setName("GitHub token")
      .setDesc("Personal access token with gist scope.")
      .addText((text) => {
        text
          .setPlaceholder("ghp_…")
          .setValue(s.githubToken)
          .onChange(async (value) => {
            s.githubToken = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(el)
      .setName("Gist ID")
      .setDesc("Leave empty to create a new Gist on first push.")
      .addText((text) =>
        text
          .setPlaceholder("abc123…")
          .setValue(s.githubGistId)
          .onChange(async (value) => {
            s.githubGistId = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(el)
      .setName("Sync prompts")
      .addButton((btn) =>
        btn
          .setButtonText("Push to Gist")
          .setCta()
          .onClick(async () => {
            try {
              const newId = await pushPromptsToGist(
                s.prompts,
                s.githubToken,
                s.githubGistId
              );
              s.githubGistId = newId;
              await this.plugin.saveSettings();
              new Notice("Prompts pushed to GitHub Gist.");
              this.display();
            } catch (e: unknown) {
              new Notice(
                `Push failed: ${e instanceof Error ? e.message : String(e)}`
              );
            }
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Pull from Gist").onClick(async () => {
          try {
            const prompts = await pullPromptsFromGist(
              s.githubToken,
              s.githubGistId
            );
            s.prompts = prompts;
            await this.plugin.saveSettings();
            new Notice(`Pulled ${prompts.length} prompts from Gist.`);
            this.display();
          } catch (e: unknown) {
            new Notice(
              `Pull failed: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        })
      );
  }
}
