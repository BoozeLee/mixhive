import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // v7 of eslint-plugin-react-hooks added this rule; most flagged sites
      // are legitimate async-fetch sync patterns. Surfaced as warnings so
      // we can refactor incrementally without blocking CI.
      'react-hooks/set-state-in-effect': 'warn',
      // Context providers sometimes need to live alongside their hook to
      // share types; allow that without failing the build.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
