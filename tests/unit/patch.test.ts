import { expect, test } from "bun:test";
import { patchedSource } from "../../lib/core/mcp";
test("patch selectors bind to the original source and reject ambiguity, overlap and empty output", () => {
  expect(
    patchedSource("one two", [
      { expected: "one", replacement: "two" },
      { expected: "two", replacement: "three" },
    ]),
  ).toBe("two three");
  for (const edits of [
    [{ expected: "absent", replacement: "x" }],
    [{ expected: "o", replacement: "x" }],
    [
      { expected: "one", replacement: "x" },
      { expected: "one two", replacement: "x" },
    ],
    [{ expected: "one two", replacement: "" }],
  ])
    expect(() => patchedSource("one two", edits)).toThrow();
});
