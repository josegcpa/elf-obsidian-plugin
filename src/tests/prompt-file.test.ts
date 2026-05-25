import { nameToSlug, assignIds, serialisePrompts, parsePrompts } from "../prompt-file";
import { DEFAULT_SYSTEM_PROMPTS, Prompt } from "../types";

describe("nameToSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(nameToSlug("My Prompt")).toBe("my-prompt");
  });

  it("collapses consecutive non-alphanumeric chars", () => {
    expect(nameToSlug("Hello  World!")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(nameToSlug("  --Prompt--  ")).toBe("prompt");
  });

  it("handles all-numeric names", () => {
    expect(nameToSlug("123")).toBe("123");
  });
});

describe("assignIds", () => {
  const base = { mode: "rewrite" as const, systemPrompt: "", userPromptTemplate: "t" };

  it("derives id from name", () => {
    const [p] = assignIds([{ name: "Make concise", ...base }]);
    expect(p.id).toBe("make-concise");
  });

  it("deduplicates with numeric suffix", () => {
    const [a, b, c] = assignIds([
      { name: "My Prompt", ...base },
      { name: "My Prompt", ...base },
      { name: "My Prompt", ...base },
    ]);
    expect(a.id).toBe("my-prompt");
    expect(b.id).toBe("my-prompt-2");
    expect(c.id).toBe("my-prompt-3");
  });

  it("falls back to 'prompt' for empty names", () => {
    const [p] = assignIds([{ name: "", ...base }]);
    expect(p.id).toBe("prompt");
  });
});

describe("serialisePrompts / parsePrompts round-trip", () => {
  const prompts: Prompt[] = [
    {
      id: "continue-writing",
      name: "Continue writing",
      mode: "collaborate",
      systemPrompt: "",
      userPromptTemplate: "Continue from:\n\n{{before}}",
    },
    {
      id: "pirate",
      name: "Rewrite as pirate",
      mode: "rewrite",
      systemPrompt: "You are a pirate editor.",
      userPromptTemplate: "Rewrite in pirate speak:\n\n{{selected}}",
    },
  ];

  it("round-trips prompts without data loss", () => {
    const serialised = serialisePrompts(prompts);
    const { prompts: parsed } = parsePrompts(serialised);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("Continue writing");
    expect(parsed[0].mode).toBe("collaborate");
    expect(parsed[0].systemPrompt).toBe("");
    expect(parsed[0].userPromptTemplate).toBe("Continue from:\n\n{{before}}");
    expect(parsed[1].name).toBe("Rewrite as pirate");
    expect(parsed[1].systemPrompt).toBe("You are a pirate editor.");
  });

  it("assigns ids from names on parse", () => {
    const serialised = serialisePrompts(prompts);
    const { prompts: parsed } = parsePrompts(serialised);
    expect(parsed[0].id).toBe("continue-writing");
    expect(parsed[1].id).toBe("rewrite-as-pirate");
  });

  it("omits ### System prompt section when systemPrompt is empty", () => {
    const serialised = serialisePrompts(prompts);
    const firstBlock = serialised.split("\n---\n")[1];
    expect(firstBlock).not.toContain("### System prompt");
  });

  it("includes ### System prompt section when systemPrompt is set", () => {
    const serialised = serialisePrompts(prompts);
    expect(serialised).toContain("### System prompt");
    expect(serialised).toContain("You are a pirate editor.");
  });

  it("embeds default system prompts as flat YAML properties", () => {
    const serialised = serialisePrompts(prompts);
    expect(serialised).toMatch(/^---\n/);
    expect(serialised).toContain("default_system_prompt_collaborate:");
    expect(serialised).toContain("default_system_prompt_rewrite:");
    expect(serialised).toContain("default_system_prompt_variations:");
  });

  it("round-trips custom default system prompts", () => {
    const custom = {
      ...DEFAULT_SYSTEM_PROMPTS,
      rewrite: "Custom rewrite system prompt.",
    };
    const serialised = serialisePrompts(prompts, custom);
    const { defaultSystemPrompts } = parsePrompts(serialised);
    expect(defaultSystemPrompts.rewrite).toBe("Custom rewrite system prompt.");
    expect(defaultSystemPrompts.collaborate).toBe(DEFAULT_SYSTEM_PROMPTS.collaborate);
  });

  it("falls back to DEFAULT_SYSTEM_PROMPTS when no front-matter present", () => {
    const noFrontMatter = "## My Prompt\n\nmode: rewrite\n\n### User prompt\n\nDo something.\n";
    const { defaultSystemPrompts } = parsePrompts(noFrontMatter);
    expect(defaultSystemPrompts).toEqual(DEFAULT_SYSTEM_PROMPTS);
  });
});
