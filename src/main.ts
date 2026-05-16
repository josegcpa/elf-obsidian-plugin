import {
  Editor,
  FuzzySuggestModal,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
} from "obsidian";
import { DEFAULT_SETTINGS, ModeType, PluginSettings, Prompt } from "./types";
import { writebraightSettingTab } from "./settings-tab";
import { createProvider, PROVIDER_DEFAULT_MODELS } from "./providers/factory";
import { runCollaborate, runRewrite } from "./engine";
import { VariationsModal } from "./variations-modal";
import { loadPromptsFile, savePromptsFile, PROMPTS_FILE_PATH } from "./prompt-file";

/** Main plugin class — registered as the entry point in `manifest.json`. */
export default class writebraightPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  /** Called by Obsidian when the plugin is enabled. Registers all commands and UI elements. */
  async onload(): Promise<void> {
    await this.loadSettings();

    // ── Settings tab ──────────────────────────────────────────────────────────
    this.addSettingTab(new writebraightSettingTab(this.app, this));

    // ── Load prompts file + watch for external edits (deferred until vault ready) ──
    this.app.workspace.onLayoutReady(async () => {
      const target = this.settings.promptsFilePath || PROMPTS_FILE_PATH;
      try {
        this.settings.prompts = await loadPromptsFile(this.app, target);
      } catch (e) {
        console.error("write.braight: failed to load prompts file", e);
      }

      this.registerEvent(
        this.app.vault.on("modify", async (file) => {
          const t = this.settings.promptsFilePath || PROMPTS_FILE_PATH;
          if (file.path === t) {
            try {
              this.settings.prompts = await loadPromptsFile(this.app, t);
            } catch (e) {
              console.error("write.braight: failed to reload prompts file", e);
            }
          }
        })
      );
    });

    // ── Command: Collaborate (apply default prompt) ─────────────────────────────────
    this.addCommand({
      id: "collaborate-default",
      name: "Collaborate: continue writing (apply default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "c" }],
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        try {
          this.runEditorAction(editor, "collaborate", this.getDefaultCollaboratePrompt());
        } catch (e: unknown) {
          new Notice(`Error: ${e instanceof Error ? e.message : String(e)}`, 5000);
        }
      },
    });

    // ── Command: Rewrite (apply default prompt) ─────────────────────────────────────
    this.addCommand({
      id: "rewrite-default",
      name: "Rewrite: rewrite selection (apply default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "r" }],
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        try {
          this.runEditorAction(editor, "rewrite", this.getDefaultRewritePrompt());
        } catch (e: unknown) {
          new Notice(`Error: ${e instanceof Error ? e.message : String(e)}`, 5000);
        }
      },
    });

    // ── Command: Collaborate — pick prompt ────────────────────────────────────
    this.addCommand({
      id: "collaborate-pick",
      name: "Collaborate: pick a prompt…",
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        this.showPromptPicker("collaborate", (prompt) =>
          this.runEditorAction(editor, "collaborate", prompt)
        );
      },
    });

    // ── Command: Rewrite — pick prompt ────────────────────────────────────────
    this.addCommand({
      id: "rewrite-pick",
      name: "Rewrite: pick a prompt…",
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        this.showPromptPicker("rewrite", (prompt) =>
          this.runEditorAction(editor, "rewrite", prompt)
        );
      },
    });

    // ── Command: Variations (apply default prompt) ─────────────────────────────────
    this.addCommand({
      id: "variations-default",
      name: "Variations: generate variations (apply default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        try {
          this.openVariationsModal(editor, this.getDefaultVariationsPrompt());
        } catch (e: unknown) {
          new Notice(`Error: ${e instanceof Error ? e.message : String(e)}`, 5000);
        }
      },
    });

    // ── Command: Variations — pick prompt ─────────────────────────────────────
    this.addCommand({
      id: "variations-pick",
      name: "Variations: pick a prompt…",
      callback: () => {
        const editor = this.getActiveEditor();
        if (!editor) return;
        this.showPromptPicker("variations", (prompt) =>
          this.openVariationsModal(editor, prompt)
        );
      },
    });

    // ── Command: Select provider and model ────────────────────────────────────
    this.addCommand({
      id: "select-provider-model",
      name: "Select provider and model…",
      callback: () => this.showProviderModelPicker(),
    });

    // ── Right-click context menu ───────────────────────────────────────────────
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, editor: Editor, _view: MarkdownView) => {
          if (!editor.getSelection()) return;

          menu.addItem((item) =>
            item
              .setTitle("Rewrite with AI (default)")
              .setIcon("pencil")
              .onClick(() => this.runEditorAction(editor, "rewrite", this.getDefaultRewritePrompt()))
          );

          menu.addItem((item) =>
            item
              .setTitle("Rewrite with AI…")
              .setIcon("wand")
              .onClick(() =>
                this.showPromptPicker("rewrite", (prompt) =>
                  this.runEditorAction(editor, "rewrite", prompt)
                )
              )
          );

          menu.addItem((item) =>
            item
              .setTitle("Generate variations…")
              .setIcon("shuffle")
              .onClick(() =>
                this.showPromptPicker("variations", (prompt) =>
                  this.openVariationsModal(editor, prompt)
                )
              )
          );
        }
      )
    );
  }

  /** Called by Obsidian when the plugin is disabled. Nothing to clean up beyond what Obsidian handles. */
  onunload(): void {}

  /** Load settings from disk, merging with defaults to handle missing keys. */
  async loadSettings(): Promise<void> {
    const stored = await this.loadData() as Partial<typeof DEFAULT_SETTINGS> & { apiKey?: string };
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
    if (!this.settings.apiKeys) {
      this.settings.apiKeys = { ...DEFAULT_SETTINGS.apiKeys };
    }
    if (stored?.apiKey) {
      this.settings.apiKeys[this.settings.provider] = stored.apiKey;
    }
    // prompts are loaded from file once the vault is ready (see onload)
  }

  /** Persist current settings to disk. */
  async saveSettings(): Promise<void> {
    await savePromptsFile(
      this.app,
      this.settings.prompts,
      this.settings.promptsFilePath || PROMPTS_FILE_PATH
    );
    const { prompts: _prompts, ...rest } = this.settings;
    await this.saveData(rest);
  }

  /**
   * Look up the default Collaborate prompt from the library.
   *
   * @throws If the configured default ID no longer exists in the library.
   */
  private getDefaultCollaboratePrompt(): Prompt {
    const prompt = this.settings.prompts.find(
      (p) => p.id === this.settings.defaultCollaboratePromptId
    );
    if (!prompt) throw new Error("Default collaborate prompt not found.");
    return prompt;
  }

  /**
   * Look up the default Variations prompt from the library.
   *
   * @throws If the configured default ID no longer exists in the library.
   */
  private getDefaultVariationsPrompt(): Prompt {
    const prompt = this.settings.prompts.find(
      (p) => p.id === this.settings.defaultVariationsPromptId
    );
    if (!prompt) throw new Error("Default variations prompt not found.");
    return prompt;
  }

  /**
   * Look up the default Rewrite prompt from the library.
   *
   * @throws If the configured default ID no longer exists in the library.
   */
  private getDefaultRewritePrompt(): Prompt {
    const prompt = this.settings.prompts.find(
      (p) => p.id === this.settings.defaultRewritePromptId
    );
    if (!prompt) throw new Error("Default rewrite prompt not found.");
    return prompt;
  }

  /**
   * Open a fuzzy-search picker listing all prompts for `mode`.
   *
   * @param mode - Filter prompts to this mode.
   * @param onSelect - Called with the chosen prompt.
   */
  private showPromptPicker(
    mode: ModeType,
    onSelect: (prompt: Prompt) => void
  ): void {
    const prompts = this.settings.prompts.filter((p) => p.mode === mode);
    if (prompts.length === 0) {
      new Notice("No prompts configured for this mode.");
      return;
    }

    const app = this.app;
    class PromptPicker extends FuzzySuggestModal<Prompt> {
      constructor() { super(app); }
      getItems(): Prompt[] { return prompts; }
      getItemText(item: Prompt): string { return item.name; }
      onChooseItem(item: Prompt): void { onSelect(item); }
    }
    new PromptPicker().open();
  }

  /**
   * Open a two-step picker to select provider, then model.
   * First shows provider list (defaulting to current), then model list
   * (defaulting to current model for that provider).
   */
  private showProviderModelPicker(): void {
    const providers = Object.keys(PROVIDER_DEFAULT_MODELS) as Array<keyof typeof PROVIDER_DEFAULT_MODELS>;
    const app = this.app;
    const settings = this.settings;
    const plugin = this;

    class ProviderPicker extends FuzzySuggestModal<string> {
      constructor() { super(app); }
      getItems(): string[] { return providers; }
      getItemText(item: string): string { return item; }
      onChooseItem(provider: string): void {
        settings.provider = provider as typeof settings.provider;
        // Show model picker for selected provider
        plugin.showModelPicker();
      }
    }
    new ProviderPicker().open();
  }

  /**
   * Show model picker for the currently selected provider.
   * Defaults to the currently selected model.
   */
  private async showModelPicker(): Promise<void> {
    const provider = createProvider(this.settings);
    const app = this.app;
    const plugin = this;

    const notice = new Notice("Loading models…", 0);
    let models: string[] = [];
    try {
      models = await provider.listModels();
    } catch {
      // Fall back to empty list
    }
    notice.hide();

    if (models.length === 0) {
      new Notice("Could not fetch models. Check your API key.", 5000);
      return;
    }

    class ModelPicker extends FuzzySuggestModal<string> {
      constructor() { super(app); }
      getItems(): string[] { return models; }
      getItemText(item: string): string { return item; }
      onChooseItem(model: string): void {
        plugin.settings.model = model;
        plugin.saveSettings();
        new Notice(`Model set to ${model}`, 2000);
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
  private openVariationsModal(editor: Editor, prompt: Prompt): void {
    new VariationsModal(this.app, editor, createProvider(this.settings), prompt, 3).open();
  }

  /**
   * Dispatch a Collaborate or Rewrite action, showing a persistent notice
   * while the request is in-flight. Variations uses `openVariationsModal`.
   *
   * @param editor - The active editor.
   * @param mode - `"collaborate"` or `"rewrite"`.
   * @param prompt - Prompt to use.
   */
  private async runEditorAction(
    editor: Editor,
    mode: Exclude<ModeType, "variations">,
    prompt: Prompt
  ): Promise<void> {
    const labels: Record<Exclude<ModeType, "variations">, [string, string]> = {
      collaborate: ["Collaborating…", "Done."],
      rewrite: ["Rewriting…", "Done."],
    };
    const [startMsg, endMsg] = labels[mode];
    const run = mode === "collaborate"
      ? () => runCollaborate(editor, createProvider(this.settings), prompt)
      : () => runRewrite(editor, createProvider(this.settings), prompt);
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
  private getActiveEditor(): Editor | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("No active editor.", 3000);
      return null;
    }
    return view.editor;
  }

  private async runWithNotice(
    fn: () => Promise<void>,
    startMsg: string,
    endMsg: string
  ): Promise<void> {
    const notice = new Notice(startMsg, 0);
    try {
      await fn();
      notice.hide();
      new Notice(endMsg, 2000);
    } catch (e: unknown) {
      notice.hide();
      new Notice(
        `Error: ${e instanceof Error ? e.message : String(e)}`,
        5000
      );
    }
  }
}
