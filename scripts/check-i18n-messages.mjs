// Validate that every message string in each locale catalog is a well-formed
// ICU MessageFormat pattern for that locale. Catches broken placeholders and
// apostrophe-before-brace quoting bugs that JSON parsing alone won't surface.
// Usage: node scripts/check-i18n-messages.mjs [locale ...]  (default: all)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'fr', 'nl', 'de', 'es'];

// A proxy that yields a usable value for any accessed argument name, so
// .format() exercises every {placeholder} without us knowing the arg names.
// The value is a function so rich-text tags (<bold>…</bold>) also resolve;
// for simple {arg} placeholders it's just stringified (we only care whether
// .format() throws on a malformed pattern, not what it renders).
const anyArgs = new Proxy({}, { get: () => chunks => chunks ?? '', has: () => true });

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, path, out);
    else if (typeof v === 'string') out.push([path, v]);
  }
  return out;
}

let failures = 0;
for (const locale of LOCALES) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'));
  } catch (e) {
    console.error(`✖ ${locale}.json: invalid JSON — ${e.message}`);
    failures++;
    continue;
  }
  const strings = flatten(json, '', []);
  let localeFail = 0;
  for (const [path, msg] of strings) {
    try {
      // ignoreTag matches next-intl's plain t(): `<`/`>` are literal (only
      // t.rich parses tags), so a `</>` label isn't a false error.
      new IntlMessageFormat(msg, locale, undefined, { ignoreTag: true }).format(anyArgs);
    } catch (e) {
      console.error(`✖ ${locale}: ${path} → ${e.message}\n    "${msg}"`);
      localeFail++;
    }
    // An apostrophe immediately before `{` starts ICU quoting and silently
    // swallows the placeholder (a classic fr/es/it bug) — it doesn't throw,
    // so flag it explicitly.
    if (/'\{/.test(msg)) {
      console.error(`✖ ${locale}: ${path} → apostrophe before {placeholder} (ICU quoting swallows it)\n    "${msg}"`);
      localeFail++;
    }
  }
  failures += localeFail;
  console.log(`${localeFail ? '✖' : '✓'} ${locale}: ${strings.length} strings, ${localeFail} bad`);
}
process.exit(failures ? 1 : 0);
