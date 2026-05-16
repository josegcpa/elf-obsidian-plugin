import { renderTemplate, getParagraphContext } from "../engine";

describe("renderTemplate", () => {
  it("substitutes {{context}}", () => {
    const result = renderTemplate("Hello {{context}}!", { context: "world" });
    expect(result).toBe("Hello world!");
  });

  it("substitutes {{selected}}", () => {
    const result = renderTemplate("Rewrite: {{selected}}", {
      selected: "some text",
    });
    expect(result).toBe("Rewrite: some text");
  });

  it("leaves unknown placeholders empty", () => {
    const result = renderTemplate("{{foo}}", {});
    expect(result).toBe("");
  });
});

describe("getParagraphContext", () => {
  it("returns text up to start of paragraph", () => {
    const lines = [
      "First paragraph.",
      "",
      "Second paragraph line one.",
      "Second paragraph line two.",
    ];

    const mockEditor = {
      getCursor: () => ({ line: 3, ch: 0 }),
      getLine: (n: number) => lines[n],
    } as unknown as import("obsidian").Editor;

    const context = getParagraphContext(mockEditor);
    expect(context).toBe(
      "Second paragraph line one.\nSecond paragraph line two."
    );
  });
});
