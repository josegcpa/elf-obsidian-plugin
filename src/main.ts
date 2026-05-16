import {
  Editor,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
} from "obsidian";
import { DEFAULT_SETTINGS, ModeType, PluginSettings, Prompt } from "./types";
import { WriterRewriterSettingTab } from "./settings-tab";
import { PromptLibraryModal } from "./prompt-library-modal";
import { createProvider } from "./providers/factory";
import { runCollaborate, runRewrite } from "./engine";
import { VariationsModal } from "./variations-modal";

/** Main plugin class — registered as the entry point in `manifest.json`. */
export default class WriterRewriterPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  /** Called by Obsidian when the plugin is enabled. Registers all commands and UI elements. */
  async onload(): Promise<void> {
    await this.loadSettings();

    // ── Settings tab ──────────────────────────────────────────────────────────
    this.addSettingTab(new WriterRewriterSettingTab(this.app, this));

    // ── Command: open prompt library ──────────────────────────────────────────
    this.addCommand({
      id: "open-prompt-library",
      name: "Open Prompt Library",
      callback: () => this.openPromptLibrary(),
    });

    // ── Command: Collaborate (default prompt) ─────────────────────────────────
    this.addCommand({
      id: "collaborate-default",
      name: "Collaborate: continue writing (default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "c" }],
      editorCallback: (editor: Editor) =>
        this.runEditorAction(editor, "collaborate", this.getDefaultCollaboratePrompt()),
    });

    // ── Command: Rewrite (default prompt) ─────────────────────────────────────
    this.addCommand({
      id: "rewrite-default",
      name: "Rewrite: rewrite selection (default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "r" }],
      editorCallback: (editor: Editor) =>
        this.runEditorAction(editor, "rewrite", this.getDefaultRewritePrompt()),
    });

    // ── Command: Collaborate — pick prompt ────────────────────────────────────
    this.addCommand({
      id: "collaborate-pick",
      name: "Collaborate: pick a prompt…",
      editorCallback: (editor: Editor) =>
        this.showPromptPicker("collaborate", (prompt) =>
          this.runEditorAction(editor, "collaborate", prompt)
        ),
    });

    // ── Command: Rewrite — pick prompt ────────────────────────────────────────
    this.addCommand({
      id: "rewrite-pick",
      name: "Rewrite: pick a prompt…",
      editorCallback: (editor: Editor) =>
        this.showPromptPicker("rewrite", (prompt) =>
          this.runEditorAction(editor, "rewrite", prompt)
        ),
    });

    // ── Command: Variations (default prompt) ─────────────────────────────────
    this.addCommand({
      id: "variations-default",
      name: "Variations: generate variations (default prompt)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
      editorCallback: (editor: Editor) =>
        this.openVariationsModal(editor, this.getDefaultVariationsPrompt()),
    });

    // ── Command: Variations — pick prompt ─────────────────────────────────────
    this.addCommand({
      id: "variations-pick",
      name: "Variations: pick a prompt…",
      editorCallback: (editor: Editor) =>
        this.showPromptPicker("variations", (prompt) =>
          this.openVariationsModal(editor, prompt)
        ),
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.prompts || this.settings.prompts.length === 0) {
      this.settings.prompts = DEFAULT_SETTINGS.prompts;
    }
  }

  /** Persist current settings to disk. */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
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

  /** Open the Prompt Library modal for editing the prompt collection. */
  private openPromptLibrary(): void {
    new PromptLibraryModal(this.app, this.settings.prompts, async (prompts) => {
      this.settings.prompts = prompts;
      await this.saveSettings();
    }).open();
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

    import("obsidian").then(({ FuzzySuggestModal }) => {
      class PromptPicker extends FuzzySuggestModal<Prompt> {
        getItems(): Prompt[] { return prompts; }
        getItemText(item: Prompt): string { return item.name; }
        onChooseItem(item: Prompt): void { onSelect(item); }
      }
      new PromptPicker(this.app).open();
    });
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
