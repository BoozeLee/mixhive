// Validate that every message string in each locale catalog is a well-formed
// ICU MessageFormat pattern for that locale. Catches broken placeholders and
// apostrophe-before-brace quoting bugs that JSON parsing alone won't surface.
// Usage: node scripts/check-i18n-messages.mjs [locale ...]  (default: all)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['en', 'fr', 'nl', 'de', 'es'];

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
      console.error(
        `✖ ${locale}: ${path} → apostrophe before {placeholder} (ICU quoting swallows it)\n    "${msg}"`
      );
      localeFail++;
    }
  }
  failures += localeFail;
  console.log(`${localeFail ? '✖' : '✓'} ${locale}: ${strings.length} strings, ${localeFail} bad`);
}

// ── Namespace coverage ───────────────────────────────────────────────────────
// Well-formed ICU is not enough. next-intl falls back to printing the key when a
// namespace is absent from the catalog, so the app renders literal strings like
// "searchAutocomplete.search" with nothing throwing. Eleven namespaces were
// missing this way — across the search bar, notifications bell, global player
// and empty/error states, i.e. on nearly every page — and no check caught it.
const SRC = join(root, 'src');
const used = new Map(); // namespace -> file that requested it

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const src = readFileSync(full, 'utf8');
      for (const m of src.matchAll(/useTranslations\(\s*'([^']+)'\s*\)/g)) {
        if (!used.has(m[1])) used.set(m[1], full.replace(`${root}/`, ''));
      }
    }
  }
}
walk(SRC);

const enCatalog = JSON.parse(readFileSync(join(root, 'messages', 'en.json'), 'utf8'));
const missingNs = [...used.entries()].filter(([ns]) => !(ns.split('.')[0] in enCatalog));
for (const [ns, file] of missingNs) {
  console.error(`✖ namespace "${ns}" is used in ${file} but absent from messages/en.json`);
  failures++;
}
console.log(
  `${missingNs.length ? '✖' : '✓'} namespaces: ${used.size} used, ${missingNs.length} missing`
);

// Every locale must carry the same top-level namespaces as en, or that locale
// silently degrades to raw keys for whole sections of the UI.
for (const locale of LOCALES.filter(l => l !== 'en')) {
  let cat;
  try {
    cat = JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'));
  } catch {
    continue; // already reported above
  }
  const gaps = Object.keys(enCatalog).filter(ns => !(ns in cat));
  if (gaps.length) {
    console.error(`✖ ${locale}.json is missing namespaces present in en: ${gaps.join(', ')}`);
    failures += gaps.length;
  }
}

process.exit(failures ? 1 : 0);
