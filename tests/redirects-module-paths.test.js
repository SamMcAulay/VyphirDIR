import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('_redirects rules do not shadow the built client bundle or any known route', () => {
    const content = readFileSync(join(projectRoot, '_redirects'), 'utf8');
    const prefixes = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split(/\s+/)[0])
        .filter((source) => source.endsWith('/*'))
        .map((source) => source.slice(0, -1));

    const protectedPaths = ['/assets/entry-client.js', '/', '/gallery/', '/commissions/', '/tos/', '/queue/', '/admin/'];
    for (const path of protectedPaths) {
        const shadow = prefixes.find((prefix) => path.startsWith(prefix));
        assert.equal(shadow, undefined, `${path} is shadowed by _redirects rule "${shadow}*"`);
    }
});
