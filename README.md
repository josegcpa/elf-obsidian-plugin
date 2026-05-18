<center>
<img src="assets/icon.png" alt="drawing" width="200"/>
</center>

<center>
<h1>Elf Obsidian plugin</h1>

Elf is an [Obsidian](https://obsidian.md) plugin that brings AI writing assistance into your vault.
It supports **six providers** and three distinct **modes of action**.
</center>

---

## Features

- **Collaborate** — the AI continues your current paragraph from the cursor position.
- **Rewrite** — the AI rewrites selected text in place, using surrounding context so the result fits seamlessly into the document.
- **Variations** — the AI generates multiple alternative rewrites of the selection; a modal lets you preview, accept, or regenerate.
- **Prompt library** — create and edit prompts for each mode, stored in a `prompts.md` file in your vault.
- **Command palette** commands with default hotkeys.
- **Right-click context menu** when text is selected.

---

## Supported Providers

| Provider       | Notes                                                     |
|----------------|-----------------------------------------------------------|
| **OpenAI**     | Requires an API key.                                      |
| **Anthropic**  | Requires an API key.                                      |
| **Google**     | Requires an API key (Gemini).                             |
| **Mistral**    | Requires an API key.                                      |
| **Ollama**     | Local server — no API key needed. Configure the base URL. |
| **OpenRouter** | Single key that routes to many models.                    |

---

## Configuration

Open **Settings → Elf**.

1. Select a **Provider** and enter your **API key** (or Ollama base URL).
2. Models load automatically — pick from the dropdown or click **Refresh**.
3. Set **Variations count** (1–10, default 3) — how many alternatives are generated each time.
4. Under **Default Prompts**, choose which prompt is used for each mode's default command.
5. Under **Prompt Library**, set the path to your `prompts.md` file and edit prompts inline.

---

## Commands

| Command                         | Hotkey | Description                              |
|---------------------------------|--------|------------------------------------------|
| Collaborate: continue writing   | `⌘⇧C`  | Inserts AI continuation after the cursor |
| Rewrite: rewrite selection      | `⌘⇧R`  | Replaces selection with AI rewrite       |
| Variations: generate variations | `⌘⇧V`  | Opens variations modal                   |
| Collaborate: pick a prompt…     | —      | Fuzzy-pick a Collaborate prompt          |
| Rewrite: pick a prompt…         | —      | Fuzzy-pick a Rewrite prompt              |
| Variations: pick a prompt…      | —      | Fuzzy-pick a Variations prompt           |
| Select provider and model…      | —      | Switch provider and model                |

### Variations modal

- `↑` / `↓` or mouse — navigate options.
- `Enter` — accept highlighted variation.
- `Shift+Enter` — regenerate a new batch.
- `Esc` — cancel.

### Right-click menu

Right-click selected text to access **Rewrite with AI**, **Rewrite with AI…**, and **Generate variations…**.

---

## Prompt Templates

Prompts use `{{placeholder}}` variables:

| Placeholder    | Available in        | Description                               |
|----------------|---------------------|-------------------------------------------|
| `{{context}}`  | Collaborate         | Paragraph text up to the cursor           |
| `{{selected}}` | Rewrite, Variations | Currently selected text                   |
| `{{before}}`   | Rewrite, Variations | Up to 500 characters before the selection |
| `{{after}}`    | Rewrite, Variations | Up to 500 characters after the selection  |
| `{{n}}`        | Variations          | Number of variations to generate          |

---

## License

MIT

## Disclaimer

This was written, in great part, with recourse to generative AI. In particular, I made use of a mixture of models within Windsurf to make a large part of this happen.

---

## Developing

### Setup

```bash
git clone <repo>
cd elf-plugin
npm install
npm run build
```

Copy the built files into your vault:

```
<vault>/.obsidian/plugins/elf-plugin/
├── main.js
├── manifest.json
└── styles.css
```

Enable the plugin under **Settings → Community plugins → Installed plugins**.

> Run `npm run dev` for watch mode — esbuild rebuilds `main.js` on every change.

### Project Structure

```
src/
├── main.ts                    # Plugin entry point
├── types.ts                   # Shared types and default values
├── engine.ts                  # Collaborate, Rewrite & Variations logic
├── settings-tab.ts            # Settings UI
├── variations-modal.ts        # Variations navigation modal
└── providers/
    ├── base.ts                # LLMProvider interface + HTTP helpers
    ├── factory.ts             # createProvider() + default models
    ├── openai.ts
    ├── anthropic.ts
    ├── google.ts
    ├── mistral.ts
    ├── ollama.ts
    └── openrouter.ts
```

### Adding a New Provider

1. Create `src/providers/<name>.ts` implementing `LLMProvider`:

   ```ts
   export class MyProvider implements LLMProvider {
     async complete(request: LLMRequest): Promise<LLMResponse> { … }
     async listModels(): Promise<string[]> { … }
   }
   ```

2. Add the value to `ProviderType` in `types.ts`.
3. Register it in `createProvider()` and `PROVIDER_DEFAULT_MODELS` in `factory.ts`.
4. Add a label to the `PROVIDERS` array in `settings-tab.ts`.

### Testing

```bash
npm test
```

Unit tests run without API keys. Integration tests are skipped automatically when the relevant key is absent. Copy `.env.example` to `.env` and fill in keys to run them:

```bash
cp .env.example .env
npm test
```