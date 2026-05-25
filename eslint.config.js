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
      // v7 of eslint-plugin-react-hooks added this advisory rule; most flagged
      // sites here are legitimate async-fetch synchronization patterns.
      'react-hooks/set-state-in-effect': 'off',
      // Context providers sometimes need to live alongside their hook to share
      // types; keep lint focused on behavioral issues.
      'react-refresh/only-export-components': 'off',
    },
  },
])
