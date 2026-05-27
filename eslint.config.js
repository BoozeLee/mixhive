import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// jsx-a11y rule policy
// --------------------
// Migration is finished — every rule that the current codebase satisfies
// is promoted to 'error', so a regression fails CI. The only intentional
// hold-outs are documented inline (e.g., media-has-caption stays 'warn'
// because we host instrumental DJ mixes, not narrative content).

export default defineConfig([
  globalIgnores(['dist', '.next', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
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

      // jsx-a11y — every rule the codebase currently satisfies is at 'error'.
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/autocomplete-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/control-has-associated-label': 'error',
      'jsx-a11y/heading-has-content': 'error',
      // index.html sets `<html lang>`; the rule only checks JSX so leave at
      // warn (no enforcement opportunity in component code).
      'jsx-a11y/html-has-lang': 'warn',
      'jsx-a11y/iframe-has-title': 'error',
      'jsx-a11y/img-redundant-alt': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      // Music mixes aren't transcript-friendly the way speech/video is;
      // adding empty <track> elements would be noise. Warn so we don't
      // forget about voice content, but don't fail CI on it.
      'jsx-a11y/media-has-caption': 'warn',
      'jsx-a11y/mouse-events-have-key-events': 'error',
      'jsx-a11y/no-access-key': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/no-distracting-elements': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'jsx-a11y/no-noninteractive-tabindex': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/scope': 'error',
      'jsx-a11y/tabindex-no-positive': 'error',
    },
  },
])
