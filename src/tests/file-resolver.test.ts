import { resolveFileLinks } from "../file-resolver";
import { App, TFile } from "obsidian";

function makeApp(files: Record<string, string>, dvResults?: Record<string, string>): App {
  const tfiles: Record<string, TFile> = {};
  for (const [path, _content] of Object.entries(files)) {
    tfiles[path] = {
      path,
      basename: path.replace(/\.md$/, "").split("/").pop()!,
    } as TFile;
  }

  const dvApi = dvResults
    ? {
        queryMarkdown: async (query: string) => ({
          successful: true,
          value: dvResults[query] ?? `[rendered: ${query}]`,
        }),
      }
    : undefined;

  return {
    vault: {
      getAbstractFileByPath: (p: string) => tfiles[p] ?? null,
      getMarkdownFiles: () => Object.values(tfiles),
      read: async (file: TFile) => files[file.path] ?? "",
    },
    plugins: {
      plugins: dvApi ? { dataview: { api: dvApi } } : {},
    },
  } as unknown as App;
}

describe("resolveFileLinks", () => {
  it("returns text unchanged when no wikilinks present", async () => {
    const app = makeApp({});
    const result = await resolveFileLinks("Hello world", app);
    expect(result).toBe("Hello world");
  });

  it("replaces [[link]] with [FILE: path] and appends contents", async () => {
    const app = makeApp({ "notes/foo.md": "foo content" });
    const result = await resolveFileLinks("See [[notes/foo]]", app);
    expect(result).toContain("[FILE: notes/foo.md]");
    expect(result).toContain("[CONTENTS OF FILE: notes/foo.md]");
    expect(result).toContain("foo content");
  });

  it("marks missing files with — not found", async () => {
    const app = makeApp({});
    const result = await resolveFileLinks("See [[ghost]]", app);
    expect(result).toContain("[FILE: ghost — not found]");
    expect(result).not.toContain("[CONTENTS OF FILE:");
  });

  it("deduplicates: includes a file's contents only once", async () => {
    const app = makeApp({ "a.md": "alpha" });
    const result = await resolveFileLinks("[[a]] and [[a]] again", app);
    const count = (result.match(/\[CONTENTS OF FILE: a\.md\]/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("does not recurse infinitely when file links to itself", async () => {
    const app = makeApp({ "self.md": "[[self]]" });
    const result = await resolveFileLinks("[[self]]", app);
    expect(result).toContain("[FILE: self.md]");
    expect(result).toContain("[CONTENTS OF FILE: self.md]");
    // The inner [[self]] link inside self.md should not cause another content block
    const count = (result.match(/\[CONTENTS OF FILE: self\.md\]/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("replaces dataview blocks when plugin is available", async () => {
    const app = makeApp(
      { "report.md": "```dataview\nLIST FROM #tag\n```" },
      { "LIST FROM #tag": "| File |\n|---|\n| Note A |" }
    );
    const result = await resolveFileLinks("[[report]]", app);
    expect(result).toContain("| File |");
    expect(result).not.toContain("```dataview");
  });

  it("falls back gracefully when dataview plugin is not installed", async () => {
    const app = makeApp({ "report.md": "```dataview\nLIST\n```" });
    const result = await resolveFileLinks("[[report]]", app);
    expect(result).toContain("[dataview block — plugin not installed]");
  });
});
