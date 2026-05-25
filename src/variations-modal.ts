import { App, Editor, Modal, Notice } from "obsidian";
import { LLMProvider } from "./providers/base";
import { DefaultSystemPrompts, Prompt } from "./types";
import { runVariations } from "./engine";

/**
 * Modal that presents AI-generated variations of the selected text.
 *
 * **Keyboard controls:**
 * - `↑` / `↓` — navigate between variations
 * - `Enter` — accept the highlighted variation (replaces the selection)
 * - `Shift+Enter` — generate a new round of variations
 * - `Escape` — dismiss without changing anything
 */
export class VariationsModal extends Modal {
  private variations: string[] = [];
  private selectedIndex = 0;
  private isLoading = false;

  private listEl!: HTMLElement;
  private statusEl!: HTMLElement;

  constructor(
    app: App,
    private readonly editor: Editor,
    private readonly provider: LLMProvider,
    private readonly prompt: Prompt,
    private readonly count: number,
    private readonly defaultSystemPrompts: DefaultSystemPrompts
  ) {
    super(app);
  }

  /** @inheritdoc */
  onOpen(): void {
    this.modalEl.addClass("wr-variations-modal");
    this.titleEl.setText("Variations");

    this.statusEl = this.contentEl.createDiv({ cls: "wr-variations-status" });
    this.listEl = this.contentEl.createDiv({ cls: "wr-variations-list" });

    const hint = this.contentEl.createDiv({ cls: "wr-variations-hint" });
    hint.innerHTML = [
      "<code>↑↓</code><br>navigate", 
      "<code>↵</code><br>accept", 
      "<code>Shift + ↵</code><br>regenerate", 
      "<code>Ctrl/⌘ + A</code><br>copy all", 
      "<code>Esc</code><br>cancel"
    ].map((item) => `<div>${item}</div>`).join("");

    this.modalEl.tabIndex = 0;
    this.modalEl.addEventListener("keydown", this.onKeyDown.bind(this));
    this.modalEl.focus();

    this.generate();
  }

  /** @inheritdoc */
  onClose(): void {
    this.contentEl.empty();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Call the engine to fetch a fresh set of variations, then re-render.
   * Disables keyboard input while in-flight.
   */
  private async generate(): Promise<void> {
    this.isLoading = true;
    this.selectedIndex = 0;
    this.renderList([]);
    this.statusEl.setText("Generating…");

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
          `${this.variations.length} variation${this.variations.length === 1 ? "" : "s"} — pick one:`
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.statusEl.setText(`Error: ${msg}`);
      new Notice(`Variations failed: ${msg}`, 5000);
    }

    this.isLoading = false;
    this.renderList(this.variations);
  }

  /** Re-render the variation list, highlighting `selectedIndex`. */
  private renderList(items: string[]): void {
    this.listEl.empty();

    if (items.length === 0) return;

    items.forEach((text, i) => {
      const row = this.listEl.createDiv({
        cls: "wr-variation-item" + (i === this.selectedIndex ? " wr-variation-selected" : ""),
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
  private highlightSelected(): void {
    const rows = this.listEl.querySelectorAll(".wr-variation-item");
    rows.forEach((el, i) => {
      el.classList.toggle("wr-variation-selected", i === this.selectedIndex);
    });
  }

  /** Copy all variations to the clipboard as a numbered list. */
  private copyAll(): void {
    if (this.variations.length === 0) return;
    const text = this.variations
      .map((v, i) => `${i + 1}. ${v}`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(
      () => new Notice("All variations copied.", 2000),
      () => new Notice("Failed to copy to clipboard.", 3000)
    );
  }

  /** Replace the editor selection with the currently highlighted variation. */
  private accept(): void {
    const text = this.variations[this.selectedIndex];
    if (text) {
      this.editor.replaceSelection(text);
    }
    this.close();
  }

  /** Handle keyboard navigation. */
  private onKeyDown(evt: KeyboardEvent): void {
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
}
