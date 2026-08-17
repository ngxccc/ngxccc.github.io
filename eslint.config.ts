import process from "node:process";
import eslintJs from "@eslint/js";
import { configs as tseslint } from "typescript-eslint";
import { importX } from "eslint-plugin-import-x";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig, globalIgnores } from "eslint/config";
import { configs as astroConfigs } from "eslint-plugin-astro";

export default defineConfig(
  globalIgnores([
    "node_modules/**",
    "dist/**",
    ".astro/**",
    "src/generated/**",
  ]),

  eslintJs.configs.recommended,
  ...tseslint.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.mts", "**/*.js", "**/*.mjs"],
  })),
  ...tseslint.stylisticTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.mts", "**/*.js", "**/*.mjs"],
  })),
  ...astroConfigs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "tsconfig.json",
        },
      },
      "import-x/core-modules": [
        "astro:content",
        "astro:assets",
        "astro/config",
        "astro/loaders",
        "astro/zod",
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.mts", "**/*.js", "**/*.mjs"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
      globals: {
        ...globals.node,
        ...globals.bunBuiltin,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      "import-x/no-unresolved": "error",
    },
  },

  eslintPluginPrettierRecommended,
);
