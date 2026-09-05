import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import boundaries from "eslint-plugin-boundaries";
import i18next from "eslint-plugin-i18next";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const TS_FILES = ["**/*.{ts,tsx}"];
const SOURCE_FILES = [
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "features/**/*.{ts,tsx}",
  "lib/**/*.{ts,tsx}",
];
const TEST_FILES = ["**/*.test.{ts,tsx}", "tests/**/*.ts", "vitest.setup.ts"];

const allowTo = (...types) => types.map((type) => ({ to: { element: { type } } }));

export default defineConfig([
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "playwright-report-gate/**",
    "test-results/**",
    "next-env.d.ts",
    "types/api.d.ts",
    "public/**",
  ]),
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-globals": ["error", { name: "fetch", message: "Use lib/api." }],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "fetch", message: "Use lib/api." },
        { object: "globalThis", property: "fetch", message: "Use lib/api." },
      ],
    },
  },
  {
    files: TS_FILES,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["tools/**/*.mjs", "scripts/**/*.mjs"],
    rules: { "no-console": "off", "no-restricted-globals": "off" },
  },
  {
    files: ["*.config.{mjs,ts}", "plopfile.mjs"],
    rules: { "import/no-anonymous-default-export": "off" },
  },
  {
    files: ["lib/api/**/*.ts", "app/api/**/*.ts"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
  {
    files: SOURCE_FILES,
    plugins: { i18next },
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            "·",
            "−",
            "+",
            "±",
            "#",
            "%",
            "/",
            ":",
            "(",
            ")",
            "—",
            "–",
            "•",
            "×",
            "≈",
          ],
        },
      ],
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          callees: { exclude: ["cn", "buttonClasses"] },
          "jsx-attributes": {
            include: [
              "aria-label",
              "aria-description",
              "aria-placeholder",
              "title",
              "placeholder",
              "alt",
              "label",
            ],
          },
        },
      ],
    },
  },
  {
    files: SOURCE_FILES,
    plugins: { boundaries },
    settings: {
      "import/resolver-next": [createTypeScriptImportResolver({ project: "./tsconfig.json" })],
      "boundaries/elements": [
        { type: "app", pattern: "app/**", partialMatch: false },
        { type: "features", pattern: "features/*", capture: ["feature"], partialMatch: false },
        { type: "ui", pattern: "components/**", partialMatch: false },
        { type: "lib", pattern: "lib/**", partialMatch: false },
        { type: "messages", pattern: "messages/**", partialMatch: false },
        { type: "tokens", pattern: "tokens/**", partialMatch: false },
        { type: "types", pattern: "types/**", partialMatch: false },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: allowTo("app", "features", "ui", "lib", "messages", "types", "tokens"),
            },
            {
              from: { element: { type: "features" } },
              allow: [
                ...allowTo("ui", "lib", "types"),
                {
                  to: {
                    element: { type: "features", captured: { feature: "{{ from.feature }}" } },
                  },
                },
              ],
            },
            { from: { element: { type: "ui" } }, allow: allowTo("ui", "lib", "types") },
            { from: { element: { type: "lib" } }, allow: allowTo("lib", "types", "messages") },
          ],
        },
      ],
    },
  },
  {
    files: TEST_FILES,
    rules: {
      "react/jsx-no-literals": "off",
      "i18next/no-literal-string": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-parameters": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
  prettier,
]);
