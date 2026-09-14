import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GalleryCharacterRoute from '../src/pages/GalleryCharacterRoute.jsx';

const VYPHIR = { slug: 'vyphir', name: 'Vyphir', bio: 'A slime.', images: [] };
const OTHER = { slug: 'other', name: 'Other', bio: 'Someone else.', images: [] };

function renderAt(path) {
    let tree;
    act(() => {
        tree = create(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
                </Routes>
            </MemoryRouter>
        );
    });
    return tree;
}

function withStubs({ embedded = null, characters = [] }, run) {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    const originalTitle = globalThis.document?.title;

    globalThis.document = {
        title: '',
        getElementById: () => (embedded ? { dataset: { character: JSON.stringify(embedded) } } : null),
    };
    globalThis.fetch = async () => new Response(JSON.stringify({ characters }), { status: 200 });

    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = originalFetch;
        if (originalDocument === undefined) delete globalThis.document;
        else {
            globalThis.document = originalDocument;
            globalThis.document.title = originalTitle;
        }
    });
}

function textOf(tree) {
    return JSON.stringify(tree.toJSON());
}

test('renders from the embedded attribute when its slug matches the route', async () => {
    await withStubs({ embedded: VYPHIR, characters: [] }, async () => {
        const tree = renderAt('/gallery/vyphir/');
        await act(async () => {});
        assert.match(textOf(tree), /Vyphir/);
    });
});

test('ignores embedded data belonging to another character and fetches instead', async () => {
    await withStubs({ embedded: OTHER, characters: [VYPHIR, OTHER] }, async () => {
        const tree = renderAt('/gallery/vyphir/');
        await act(async () => {});
        const text = textOf(tree);
        assert.match(text, /Vyphir/);
        assert.doesNotMatch(text, /Someone else/);
    });
});

test('fetches and selects by slug when no attribute is present', async () => {
    await withStubs({ embedded: null, characters: [VYPHIR, OTHER] }, async () => {
        const tree = renderAt('/gallery/vyphir/');
        await act(async () => {});
        assert.match(textOf(tree), /Vyphir/);
    });
});

test('renders nothing rather than crashing when the slug matches no character', async () => {
    await withStubs({ embedded: null, characters: [OTHER] }, async () => {
        const tree = renderAt('/gallery/missing/');
        await act(async () => {});
        assert.equal(tree.toJSON(), null);
    });
});

test('sets the document title once the character resolves', async () => {
    await withStubs({ embedded: null, characters: [VYPHIR] }, async () => {
        renderAt('/gallery/vyphir/');
        await act(async () => {});
        assert.equal(globalThis.document.title, 'Vyphir | Vyphir');
    });
});
