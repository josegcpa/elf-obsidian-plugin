import { App, ButtonComponent, Modal, Notice, Setting, TextComponent } from "obsidian";
import { ModeType, Prompt } from "./types";

/**
 * Generate a collision-resistant ID for a new prompt.
 * Format: `prompt-<timestamp>-<random6chars>`
 */
function generateId(): string {
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a styled, auto-resizable `<textarea>` inside `container`.
 *
 * @param container - Parent element to append the textarea to.
 * @param value - Initial text content.
 * @param rows - Visible row count.
 * @param onChange - Called on every `input` event with the current value.
 * @returns The created `HTMLTextAreaElement`.
 */
function makeTextarea(
  container: HTMLElement,
  value: string,
  rows: number,
  onChange: (v: string) => void
): HTMLTextAreaElement {
  const ta = container.createEl("textarea", {
    cls: "wr-textarea",
  }) as HTMLTextAreaElement;
  ta.value = value;
  ta.rows = rows;
  ta.style.width = "100%";
  ta.addEventListener("input", () => onChange(ta.value));
  return ta;
}

/**
 * Full-screen modal for editing the prompt library.
 *
 * Opens with a deep copy of the current prompts so unsaved edits
 * never affect live plugin state. Changes are committed only when
 * the user clicks **Save**.
 */
export class PromptLibraryModal extends Modal {
  private prompts: Prompt[];
  private onSave: (prompts: Prompt[]) => Promise<void>;

  /**
   * @param app - Obsidian application instance.
   * @param prompts - Current prompt library (will be deep-cloned).
   * @param onSave - Async callback invoked with the edited prompt array on save.
   */
  constructor(
    app: App,
    prompts: Prompt[],
    onSave: (prompts: Prompt[]) => Promise<void>
  ) {
    super(app);
    this.prompts = structuredClone(prompts);
    this.onSave = onSave;
  }

  /** @inheritdoc */
  onOpen(): void {
    this.render();
  }

  /** Re-render the modal content (called on open and after structural edits). */
  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Prompt Library" });

    this.prompts.forEach((prompt, index) => {
      this.renderPromptEditor(contentEl, prompt, index);
    });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("+ Add prompt")
        .onClick(() => {
          this.prompts.push({
            id: generateId(),
            name: "New prompt",
            mode: "rewrite",
            systemPrompt: "",
            userPromptTemplate: "",
          });
          this.render();
        })
    );

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(async () => {
            await this.onSave(this.prompts);
            new Notice("Prompts saved.");
            this.close();
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  /**
   * Render the editor row for a single prompt.
   *
   * @param container - Parent element to append the section to.
   * @param prompt - Prompt data to populate fields with.
   * @param index - Index within `this.prompts` (used for mutation callbacks).
   */
  private renderPromptEditor(
    container: HTMLElement,
    prompt: Prompt,
    index: number
  ): void {
    const section = container.createDiv({ cls: "wr-prompt-section" });
    section.createEl("hr");

    new Setting(section)
      .setName("Name")
      .addText((text: TextComponent) =>
        text.setValue(prompt.name).onChange((v) => {
          this.prompts[index].name = v;
        })
      )
      .addDropdown((drop) =>
        drop
          .addOption("collaborate", "Collaborate")
          .addOption("rewrite", "Rewrite")
          .addOption("variations", "Variations")
          .setValue(prompt.mode)
          .onChange((v) => {
            this.prompts[index].mode = v as ModeType;
          })
      )
      .addButton((btn: ButtonComponent) =>
        btn
          .setButtonText("Delete")
          .setWarning()
          .onClick(() => {
            this.prompts.splice(index, 1);
            this.render();
          })
      );

    new Setting(section).setName("System prompt").setHeading();
    makeTextarea(section, prompt.systemPrompt, 4, (v) => {
      this.prompts[index].systemPrompt = v;
    });

    new Setting(section)
      .setName("User prompt template")
      .setDesc("Placeholders: {{context}} (collaborate), {{selected}}, {{before}}, {{after}} (rewrite/variations), {{n}} (variations).")
      .setHeading();
    makeTextarea(section, prompt.userPromptTemplate, 3, (v) => {
      this.prompts[index].userPromptTemplate = v;
    });
  }

  /** @inheritdoc */
  onClose(): void {
    this.contentEl.empty();
  }
}
