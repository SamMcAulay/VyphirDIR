import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('_redirects rules do not shadow the built client bundle or any known route', () => {
    // Read from the build output: Cloudflare Pages only honours `_redirects` when it
    // lands in `pages_build_output_dir`, so asserting here also gate-checks that the
    // source file (public/_redirects) is actually being deployed.
    const content = readFileSync(join(projectRoot, 'dist/client/_redirects'), 'utf8');
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
