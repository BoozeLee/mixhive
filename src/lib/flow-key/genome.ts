// RFC 8785 (JSON Canonicalization Scheme) — the subset the Flow Key genome needs.
// Canonical bytes must be byte-identical across runtimes, because the genome hash
// is the spore's identity and is verified offline by third parties.
import { createHash } from 'node:crypto';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

function serializeString(value: string): string {
  // JSON.stringify already emits RFC 8785-compatible escaping: the shortest
  // form, lowercase \uXXXX for control chars, and literal non-ASCII (UTF-8).
  return JSON.stringify(value);
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot canonicalize non-finite number: ${String(value)}`);
  }
  // JCS uses ECMAScript Number::toString, which already collapses 1.0 -> "1".
  return String(value);
}

export function canonicalize(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return serializeNumber(value);
  if (typeof value === 'string') return serializeString(value);

  if (Array.isArray(value)) {
    // Array order is significant and preserved; undefined members become null,
    // matching JSON.stringify.
    return `[${value.map(item => (item === undefined ? 'null' : canonicalize(item))).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as { [key: string]: JsonValue };
    const entries = Object.keys(record)
      .sort()
      .filter(k => record[k] !== undefined)
      .map(k => `${serializeString(k)}:${canonicalize(record[k])}`);
    return `{${entries.join(',')}}`;
  }

  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

/** sha256 over the canonical bytes. This digest IS the spore's genome. */
export function genomeHash(body: JsonValue): string {
  return createHash('sha256').update(canonicalize(body), 'utf8').digest('hex');
}
