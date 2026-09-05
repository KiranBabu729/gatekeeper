import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // Gatekeeper's sanitize boundary: draft() and checkPolicy() must never
    // see a SourceArtifact, only SanitizedFacts / Variant. Referencing the
    // SourceArtifact identifier in these two files is a lint error so a
    // bypass can't be introduced silently.
    files: ["lib/pipeline/draft.ts", "lib/pipeline/policy-check.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name='SourceArtifact']",
          message:
            "Sanitize boundary violation: this file must not reference SourceArtifact. Only lib/pipeline/sanitize.ts may read raw ticket data.",
        },
      ],
    },
  },
];

export default eslintConfig;
