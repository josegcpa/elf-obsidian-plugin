<p align="center">
<img src="assets/icon.png" alt="drawing" width="200"/>
</p>

<p align="center">
<h1>Elf Obsidian plugin</h1>

Elf is an [Obsidian](https://obsidian.md) plugin that brings AI writing assistance into your vault.
It supports **six providers** and three distinct **modes of action**.
</p>

## Features

- **Collaborate** — the AI continues your current paragraph from the cursor position.
- **Rewrite** — the AI rewrites selected text in place, using surrounding context so the result fits seamlessly into the document.
- **Variations** — the AI generates multiple alternative rewrites of the selection; a modal lets you preview, accept, copy all, or regenerate.
- **Prompt library** — create and edit prompts for each mode, stored in a `prompts.md` file in your vault.
- **File link resolution** — embed `[[wikilinks]]` in any prompt template; the linked file's contents are appended to the user message automatically.
- **Dataview integration** — `dataview` and `dataviewjs` code blocks inside linked files are rendered to markdown tables before being sent to the model.
- **Command palette** commands with default hotkeys.
- **Right-click context menu** when text is selected.

## Supported Providers

| Provider       | Notes                                                     |
|----------------|-----------------------------------------------------------|
| **OpenAI**     | Requires an API key.                                      |
| **Anthropic**  | Requires an API key.                                      |
| **Google**     | Requires an API key (Gemini).                             |
| **Mistral**    | Requires an API key.                                      |
| **Ollama**     | Local server — no API key needed. Configure the base URL. |
| **OpenRouter** | Single key that routes to many models.                    |

## Configuration

Open **Settings → Elf**.

1. Select a **Provider** and enter your **API key** (or Ollama base URL).
2. Models load automatically — pick from the dropdown or click **Refresh**.
3. Set **Variations count** (1–10, default 3) — how many alternatives are generated each time.
4. Under **Default Prompts**, choose which prompt is used for each mode's default command.
5. Under **Prompt Library**, set the path to your `prompts.md` file and edit prompts inline.

## Commands

| Command                         | Hotkey     | Description                              |
|---------------------------------|------------|------------------------------------------|
| Collaborate: continue writing   | `Ctrl/⌘⇧C` | Inserts AI continuation after the cursor |
| Rewrite: rewrite selection      | `Ctrl/⌘⇧R` | Replaces selection with AI rewrite       |
| Variations: generate variations | `Ctrl/⌘⇧V` | Opens variations modal                   |
| Collaborate: pick a prompt…     | —          | Fuzzy-pick a Collaborate prompt          |
| Rewrite: pick a prompt…         | —          | Fuzzy-pick a Rewrite prompt              |
| Variations: pick a prompt…      | —          | Fuzzy-pick a Variations prompt           |
| Select provider and model…      | —          | Switch provider and model                |

### Variations modal

- `↑` / `↓` or mouse — navigate options.
- `Enter` — accept highlighted variation.
- `Shift+Enter` — regenerate a new batch.
- `Ctrl/⌘+A` — copy all variations to the clipboard (numbered list).
- `Esc` — cancel.

### Right-click menu

Right-click selected text to access **Rewrite with AI**, **Rewrite with AI…**, and **Generate variations…**.

## Prompt Templates

Prompts use `{{placeholder}}` variables:

| Placeholder    | Available in        | Description                                                                                             |
|----------------|---------------------|---------------------------------------------------------------------------------------------------------|
| `{{before}}`   | All modes           | Collaborate: paragraph up to the cursor. Rewrite/Variations: up to 500 characters before the selection. |
| `{{after}}`    | Rewrite, Variations | Up to 500 characters after the selection                                                                |
| `{{selected}}` | Rewrite, Variations | The currently selected text                                                                             |
| `{{n}}`        | Variations          | Number of variations to generate                                                                        |

### File links

Any `[[wikilink]]` in a prompt template is resolved before the prompt is sent:

1. The link is replaced inline with `[FILE: path/to/file.md]`.
2. The file's contents are appended at the end of the user message under `[CONTENTS OF FILE: path/to/file.md]`.
3. `dataview` / `dataviewjs` blocks inside the linked file are rendered via the Dataview plugin API (if installed).
4. Wikilinks inside linked files are resolved recursively; circular references are safely deduplicated.

### Default system prompts

Each mode has a default system prompt stored as YAML front-matter in `prompts.md`:

```yaml
---
default_system_prompt_collaborate: "..."
default_system_prompt_rewrite: "..."
default_system_prompt_variations: "..."
---
```

Individual prompts can override this by including a `### System prompt` section. If the section is absent, the mode default is used.

## Developing

### Setup

```bash
git clone <repo>
cd elf-obsidian-plugin
npm install
npm run build
```

Copy the built files into your vault:

```
<vault>/.obsidian/plugins/elf-obsidian-plugin/
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
├── file-resolver.ts           # [[wikilink]] and Dataview block resolution
├── prompt-file.ts             # Prompt library serialisation / parsing
├── settings-tab.ts            # Settings UI
├── variations-modal.ts        # Variations navigation modal
├── providers/
│   ├── base.ts                # LLMProvider interface + HTTP helpers
│   ├── factory.ts             # createProvider() + default models
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── google.ts
│   ├── mistral.ts
│   ├── ollama.ts
│   └── openrouter.ts
└── tests/
    ├── __mocks__/
    │   └── obsidian.ts
    ├── setup.ts
    ├── engine.test.ts
    ├── file-resolver.test.ts
    ├── prompt-file.test.ts
    └── providers.test.ts
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

## License

MIT

## Disclaimer

This was written, in great part, with recourse to generative AI. In particular, I made use of a mixture of models within Windsurf to make a large part of this happen.
