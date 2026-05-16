# write.braight Plugin

An [Obsidian](https://obsidian.md) plugin that brings AI writing assistance into your vault.  
It supports **six providers** and three distinct **modes of action**.

---

## Features

- **Collaborate mode** — the AI continues your current paragraph from the cursor position.
- **Rewrite mode** — the AI rewrites your selected text in place, using a fill-in-the-middle architecture: surrounding context (before and after the selection) is sent alongside the selection so the result fits seamlessly into the document.
- **Variations mode** — the AI generates multiple alternative rewrites of the selection. A navigable modal lets you preview options, accept one with `Enter`, or regenerate with `Shift+Enter`.
- **Prompt library** — create, edit, and delete prompts for each mode.
- **GitHub Gist sync** — push/pull your prompt library to a private Gist.
- **Command palette** commands with default hotkeys.
- **Right-click context menu** entries when text is selected.

---

## Supported Providers

| Provider | Notes |
|---|---|
| **OpenAI** | Requires an API key. Model list is fetched live. |
| **Anthropic** | Requires an API key. Model list is fetched live. |
| **Google** | Requires an API key (Gemini). Model list is fetched live. |
| **Mistral** | Requires an API key. Model list is fetched live. |
| **Ollama** | Local server — no API key needed. Configure the base URL. |
| **OpenRouter** | Single key that routes to hundreds of models. Model list is fetched live. |

---

## Installation (local / development)

1. Clone this repository into your vault's plugin folder:

   ```
   <vault>/.obsidian/plugins/write-braight-plugin/
   ```

2. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

3. Open Obsidian → **Settings → Community plugins → Installed plugins** and enable  
   **write.braight**.

> **Hot-reload during development:** run `npm run dev` instead of `npm run build`.  
> esbuild will watch for changes and rebuild `main.js` automatically.

---

## Configuration

Open **Settings → write.braight**.

### Provider & Model

1. Select a **Provider** from the dropdown.
2. Enter your **API Key** (or the **Ollama base URL** if using Ollama).
3. Type a model name directly, or click **Load models** to fetch the available list  
   and pick from a dropdown.

### Default Prompts

Choose which prompt from your library is used when you trigger the default command for each mode (Collaborate, Rewrite, Variations).

### GitHub Gist Sync

1. Create a GitHub [personal access token](https://github.com/settings/tokens) with  
   the **`gist`** scope.
2. Paste the token into **GitHub token**.
3. Leave **Gist ID** empty on first use — a new private Gist is created automatically  
   and the ID is saved for you.
4. Use **Push to Gist** / **Pull from Gist** to sync.

---

## Usage

### Commands (Command Palette)

| Command | Default hotkey | Description |
|---|---|---|
| Collaborate: continue writing (apply default prompt) | `Cmd/Ctrl + Shift + C` | Inserts AI continuation after the cursor |
| Rewrite: rewrite selection (apply default prompt) | `Cmd/Ctrl + Shift + R` | Replaces selected text with AI rewrite |
| Variations: generate variations (apply default prompt) | `Cmd/Ctrl + Shift + V` | Opens variations modal for selected text |
| Collaborate: pick a prompt… | — | Opens fuzzy picker of Collaborate prompts |
| Rewrite: pick a prompt… | — | Opens fuzzy picker of Rewrite prompts |
| Variations: pick a prompt… | — | Opens fuzzy picker of Variations prompts |
| Select provider and model… | — | Opens the provider and model selection dialog |

### Variations modal

When Variations mode is triggered, a modal appears with generated alternatives:

- `↑` / `↓` or mouse — navigate between options.
- `Enter` — accept the highlighted variation (replaces the selection).
- `Shift+Enter` — discard current results and generate a new batch.
- `Esc` — cancel and leave the selection unchanged.

### Right-click context menu

Right-click any selected text in a note to see:

- **Rewrite with AI (default)** — uses your default Rewrite prompt.
- **Rewrite with AI…** — opens a fuzzy picker to choose a Rewrite prompt.
- **Generate variations…** — opens a fuzzy picker to choose a Variations prompt.

---

## Prompt Templates

Prompts use `{{placeholder}}` variables:

| Placeholder | Available in | Replaced with |
|---|---|---|
| `{{context}}` | Collaborate | The paragraph text up to the cursor |
| `{{selected}}` | Rewrite, Variations | The currently selected text |
| `{{before}}` | Rewrite, Variations | Up to 500 characters immediately before the selection |
| `{{after}}` | Rewrite, Variations | Up to 500 characters immediately after the selection |
| `{{n}}` | Variations | The number of variations to generate |

The built-in Rewrite and Variations prompts use a **fill-in-the-middle** structure: the model receives the surrounding context alongside the selection and is instructed to produce output that fits naturally between `{{before}}` and `{{after}}`.

---

## Project Structure

```
src/
├── main.ts                    # Plugin entry point
├── types.ts                   # Shared types and default values
├── engine.ts                  # Collaborate, Rewrite & Variations logic
├── settings-tab.ts            # Settings UI
├── variations-modal.ts        # Variations navigation modal
└── providers/
    ├── base.ts                # LLMProvider interface + postJson helper
    ├── factory.ts             # createProvider() factory function
    ├── openai.ts
    ├── anthropic.ts
    ├── google.ts
    ├── mistral.ts
    ├── ollama.ts
    └── openrouter.ts
```

---

## Adding a New Provider

1. Create `src/providers/<name>.ts` implementing the `LLMProvider` interface:

   ```ts
   export class MyProvider implements LLMProvider {
     async complete(request: LLMRequest): Promise<LLMResponse> { … }
     async listModels(): Promise<string[]> { … }
   }
   ```

2. Add the new value to `ProviderType` in `types.ts`.
3. Register it in `createProvider()` and `PROVIDER_DEFAULT_MODELS` in `factory.ts`.
4. Add a label entry to the `PROVIDERS` array in `settings-tab.ts`.

---

## Testing

```bash
npm test
```

Unit tests run without any API keys. Integration tests (one per provider) are **skipped automatically** when the relevant key is absent.

To configure keys, copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
# edit .env with your keys, then:
npm test
```

Ollama tests are additionally skipped if the local server is unreachable or no models are pulled.

---

## License

MIT

## Disclaimer

This was written, in great part, with recourse to generative AI. In particular, I made use of a mixture of models within Windsurf to make a large part of this happen. 