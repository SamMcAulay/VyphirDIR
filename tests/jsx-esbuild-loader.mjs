import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';

export async function load(url, context, nextLoad) {
    // Two cases need the JSX-capable transform:
    //  1. `.jsx` component files (e.g. src/components/*.jsx), reached via imports.
    //  2. `.test.js` files themselves. Node's built-in test runner only
    //     auto-discovers `*.test.js` (not `*.test.jsx`) when run with no file
    //     arguments (verified empirically — a bare `node --test` finds zero
    //     tests in a `*.test.jsx` file), but this project's DOM-behavior tests
    //     (see tests/nsfw-blur-image.test.js) embed JSX literals directly, e.g.
    //     `renderToStaticMarkup(<NsfwBlurImage ... />)`. So `.test.js` files
    //     must go through the same transform, or they'd hit a plain-JS parser
    //     and fail with "Unexpected token '<'". Every other `.js` import
    //     (shared/*.js, scripts/*.js, node_modules, etc.) is untouched — esbuild's
    //     `jsx` loader is a strict superset of plain JS, so running an ordinary,
    //     JSX-free `.test.js` file through it changes nothing observable; it's
    //     still routed here rather than nextLoad only because it can't be told
    //     apart from a JSX-bearing test file by extension alone.
    if (url.endsWith('.jsx') || url.endsWith('.test.js')) {
        const rawSource = await readFile(new URL(url), 'utf8');
        // jsx: 'automatic' matches @vitejs/plugin-react's default runtime — the
        // project's .jsx source files rely on the auto-imported react/jsx-runtime
        // and never import React themselves, so the classic transform (which
        // emits bare React.createElement calls) would throw "React is not defined".
        const { code } = await transform(rawSource, { loader: 'jsx', format: 'esm', jsx: 'automatic' });
        return { format: 'module', source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
}
