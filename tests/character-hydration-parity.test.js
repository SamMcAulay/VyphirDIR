import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { renderCharacter } from '../src/entry-server.jsx';

const CHARACTER = {
    slug: 'vyphir',
    name: 'Vyphir',
    species: 'Mainecoon Cat',
    bio: '20yo | She/Her\nLoves art',
    images: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/aaa-111.png', nsfw: false },
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/bbb-222.png', nsfw: false, thumbnail: true },
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/ccc-333.png', nsfw: true },
    ],
};

/*
 * The build renders character pages through renderCharacter, but the browser
 * hydrates them through App -> SiteLayout -> GalleryCharacterRoute. Hydration
 * needs the two to produce identical HTML (page-layouts spec section 5). The
 * route reads the embedded character from #root at first render, so a stub
 * document standing in for the built page makes App render the same data.
 */
test('renderCharacter produces exactly what the client renders for the same character', () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
        getElementById: (id) => (id === 'root' ? { dataset: { character: JSON.stringify(CHARACTER) } } : null),
    };
    try {
        const client = renderToString(
            <StaticRouter location="/gallery/vyphir/">
                <App />
            </StaticRouter>
        );
        assert.equal(renderCharacter(CHARACTER).html, client);
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
});
