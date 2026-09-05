import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const GUARDED_FILES = ["lib/pipeline/draft.ts", "lib/pipeline/policy-check.ts"];

describe("sanitize boundary", () => {
  for (const file of GUARDED_FILES) {
    it(`${file} never references SourceArtifact`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf-8");
      expect(source).not.toMatch(/SourceArtifact/);
    });
  }

  it("only ingest/triage/sanitize stages touch SourceArtifact — draft and policy-check never do", () => {
    // triage.ts legitimately reads the raw ticket (stage 2, precedes sanitize);
    // sanitize.ts is the boundary itself. Every other pipeline stage — draft,
    // policy-check, channel-contracts, claims-rules — must be clean.
    const ALLOWED = new Set(["sanitize.ts", "triage.ts", "run.ts"]);
    const pipelineDir = path.join(process.cwd(), "lib/pipeline");
    const files = fs.readdirSync(pipelineDir).filter((f) => f.endsWith(".ts") && !f.includes("test"));
    const offenders = files.filter((f) => {
      if (ALLOWED.has(f)) return false;
      const source = fs.readFileSync(path.join(pipelineDir, f), "utf-8");
      return /SourceArtifact/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
