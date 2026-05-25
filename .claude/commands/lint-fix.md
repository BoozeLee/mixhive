---
description: Group remaining lint warnings by rule and offer to chip the next one off.
---

# /lint-fix

Run lint, group the output by rule, and propose the next concrete fix.

## Steps

1. Run `npm run lint 2>&1 | tail -200` and inspect the output.
2. Bucket every warning by rule (e.g., `jsx-a11y/label-has-associated-control`,
   `react-hooks/exhaustive-deps`) and count per bucket.
3. Print a short summary: `N warnings, top rule: <rule> (count)`.
4. If the user agrees, walk through the top rule's hits, one file at a
   time, suggesting the canonical fix. Reuse the project's primitives:
   - `Input` / `Textarea` / `Select` / `FileInput` for form labels.
   - `IconButton` / `Button` for click-handler warnings.
   - `<fieldset><legend>` for group labels.
   - `onFocus`/`onBlur` parity for hover-only handlers.
5. After each fix, re-run lint and confirm the rule count dropped.
6. When a rule's bucket reaches 0, **promote it to `'error'`** in
   `eslint.config.js` so a regression fails CI.

## Don'ts

- Don't blanket-add `// eslint-disable` to clear warnings — only suppress
  when the rule is genuinely wrong for the context (e.g., `media-has-caption`
  on instrumental music). Always add a `--` comment explaining why.
- Don't promote a rule to `'error'` while any warnings under it remain.
- Don't touch files outside the rule's hit list; this is a narrow ratchet.
