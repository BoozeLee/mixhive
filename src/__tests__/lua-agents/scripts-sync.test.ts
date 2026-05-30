// Verifies that scripts.ts is in sync with the .lua files.
// Fails if someone edits a .lua file without running agents:sync.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as scripts from '@/server/lua-agents/scripts';

const agentsDir = join(__dirname, '../../server/lua-agents/agents');

describe('scripts.ts sync', () => {
  const files = readdirSync(agentsDir).filter(f => f.endsWith('.lua')).sort();

  it('exports a constant for every .lua file', () => {
    for (const file of files) {
      const name = file.replace(/\.lua$/, '').replace(/^_/, '').toUpperCase().replace(/-/g, '_');
      expect(scripts).toHaveProperty(name);
    }
  });

  it('every exported script matches its .lua source file', () => {
    for (const file of files) {
      const name = file.replace(/\.lua$/, '').replace(/^_/, '').toUpperCase().replace(/-/g, '_');
      const src = readFileSync(join(agentsDir, file), 'utf8');
      const exported = (scripts as Record<string, string>)[name];
      // Strip leading newline that template literal adds
      expect(exported?.trim()).toBe(src.trim());
    }
  });

  it('scripts.ts contains no manual copy-paste drift', () => {
    const exportedKeys = Object.keys(scripts).filter(k => !k.startsWith('_'));
    expect(exportedKeys.length).toBe(files.length);
  });
});
