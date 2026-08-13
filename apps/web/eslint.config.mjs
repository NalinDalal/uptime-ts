import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint flat config for the web application.
 *
 * Extends:
 * - `eslint-config-next/core-web-vitals`: Next.js core web vitals rules.
 * - `eslint-config-next/typescript`: Next.js TypeScript-specific rules.
 *
 * Overrides the default ignores of `eslint-config-next` with an explicit allow-list
 * to keep the project's own ignore patterns in control.
 *
 * @type {import("eslint").Linter.Config}
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
