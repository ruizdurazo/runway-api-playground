import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

import * as tsEslint from "@typescript-eslint/eslint-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  ...compat.extends("plugin:@typescript-eslint/recommended"),
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
    plugins: {
      "@typescript-eslint": tsEslint,
    },
    rules: {
      semi: ["error", "never"],
      "@typescript-eslint/semi": ["error", "never"],
    },
  },
]

export default eslintConfig
