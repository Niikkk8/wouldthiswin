import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { Claim } from "../session";
import { aiDepth, aiDepthFindings, usesPretrained } from "./ai-depth";

const files = (entries: Record<string, string>) => ({ files: new Map(Object.entries(entries)) });
const claim = (text: string, over: Partial<Claim> = {}): Claim => ({
  claim: text,
  status: "unclear",
  weight: "core",
  file: null,
  evidence: "",
  label: "",
  missing: null,
  searched: [],
  category: "ai",
  ...over,
});

describe("AI depth", () => {
  test("each level is read from the code, deepest wins", () => {
    assert.equal(
      aiDepth(files({ "a.ts": "const r = await openai.chat.completions.create({ model })" })).level,
      "wrapper",
    );
    assert.equal(
      aiDepth(
        files({
          "a.py": "store = Chroma.from_documents(docs, OpenAIEmbeddings())\nchromadb.Client()",
        }),
      ).level,
      "rag",
    );
    assert.equal(
      aiDepth(files({ "a.ts": "client.messages.create({ tools: [search] })" })).level,
      "agents",
    );
    assert.equal(
      aiDepth(files({ "train.py": "model.fit(x, y)\ntorch.save(model, 'm.pt')" })).level,
      "custom_trained",
    );
    assert.equal(
      aiDepth(files({ "a.ts": "const x = 1;", "README.md": "messages.create" })).level,
      "none",
    );
  });

  test("evidence is the lines that show it", () => {
    const d = aiDepth(
      files({
        "lib/ai.ts": "import OpenAI from 'openai';\nawait client.chat.completions.create({})",
      }),
    );
    assert.deepEqual(d.evidence, [{ kind: "file", path: "lib/ai.ts", startLine: 2, endLine: 2 }]);
  });

  test("a 'custom model' claim over a hosted call or from_pretrained is overstated", () => {
    const snap = files({
      "m.py":
        "model = AutoModel.from_pretrained('bert')\nout = pipeline('sentiment-analysis')(text)",
    });
    const [, f] = aiDepthFindings(
      aiDepth(snap),
      [claim("Uses our custom ML model for predictions")],
      usesPretrained(snap),
    );
    assert.equal(
      f.title,
      '"Uses our custom ML model for predictions" says more than the code shows',
    );
    assert.match(f.detail, /from_pretrained/);
    assert.equal(f.severity, "major");
  });

  test("an honest claim, or a non-AI claim, raises nothing", () => {
    const d = aiDepth(files({ "a.ts": "await anthropic.messages.create({})" }));
    assert.deepEqual(
      aiDepthFindings(
        d,
        [claim("Summarizes notes with Claude"), claim("Custom dashboard", { category: "feature" })],
        false,
      ).map((f) => f.id),
      ["ai-depth"],
    );
  });

  test("claims of RAG with no retrieval code are caught too", () => {
    const f = aiDepthFindings(
      aiDepth(files({ "a.ts": "await openai.chat.completions.create({})" })),
      [claim("RAG over your documents with a vector database")],
      false,
    );
    assert.equal(f.at(-1)?.check, "ai");
    assert.match(f.at(-1)!.detail, /retrieval over embeddings/);
  });
});
