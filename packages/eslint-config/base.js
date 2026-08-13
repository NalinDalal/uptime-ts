import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";

/**
 * The foundational ESLint configuration shared across the entire monorepo.
 *
 * Includes:
 * - Recommended JS rules from `@eslint/js`.
 * - Prettier compatibility to prevent ESLint/Prettier conflicts.
 * - TypeScript-ESLint recommended rules.
 * - A `turbo/no-undeclared-env-vars` rule (warn level) to catch references to undefined environment variables in Turborepo pipelines.
 * - An `only-warn` plugin that downgrades all errors to warnings for a more developer-friendly DX.
 * - Ignores the `dist/**` directory.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
];
