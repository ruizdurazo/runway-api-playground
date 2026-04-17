import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import tseslint from "typescript-eslint"

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      "packages/runway-mcp/dist/**",
      "packages/runway-mcp/.mcp-use/**",
    ],
  },
  ...nextCoreWebVitals,
  ...tseslint.configs.recommended,
  {
    rules: {
      semi: ["error", "never"],
      // React Compiler / hooks v7; revisit with refactors (sync setState in effects).
      "react-hooks/set-state-in-effect": "off",
    },
  },
]

export default eslintConfig
