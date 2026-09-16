import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import SiteLayout from '../src/site/SiteLayout.jsx';
import { GalleryTiles } from '../src/components/GalleryIndexGrid.jsx';
import GalleryCharacter from '../src/pages/GalleryCharacter.jsx';
import { CommissionsContent } from '../src/pages/Commissions.jsx';
import { QueueCards } from '../src/components/QueueBoard.jsx';
import { TosContent } from '../src/components/TosPointList.jsx';

/*
 * The built-page test in render-pages.test.js only sees what the server
 * renders, and these pages fetch their content after hydration, so the
 * content itself never reaches that test. This renders every data-driven
 * layout with fixture data instead. The CSP drops inline style attributes
 * silently, so this is the only place such a regression would show up.
 */
const IMAGES = [{ url: 'https://example.com/a.png', thumbnail: true }, { url: 'https://example.com/b.png', nsfw: true }];

const FIXTURES = {
    layout: (
        <StaticRouter location="/gallery/">
            <SiteLayout><p>child</p></SiteLayout>
        </StaticRouter>
    ),
    gallery: <GalleryTiles characters={[{ slug: 'v', name: 'V', bio: 'b', images: IMAGES }]} />,
    character: <GalleryCharacter character={{ slug: 'v', name: 'V', species: 's', bio: 'b', images: IMAGES }} />,
    commissions: (
        <CommissionsContent
            data={{
                status: true,
                intro: 'i',
                specialOffer: 'o',
                tiers: [{ name: 't', price: '€1', description: 'd', example: 'https://example.com/t.png' }],
                pastWork: [{ url: 'https://example.com/p.png', nsfw: true }],
            }}
        />
    ),
    queue: (
        <QueueCards
            data={{
                columns: [{ id: 'a', name: 'A', enabled: true }, { id: 'b', name: 'B', enabled: true }],
                cards: [{ id: '1', columnId: 'a', title: 'x' }, { id: '2', columnId: 'b', title: 'y' }],
            }}
        />
    ),
    tos: <TosContent points={[{ title: 't', body: 'b', bullets: [{ type: 'yesno', text: 'y', value: true }] }]} />,
};

for (const [name, element] of Object.entries(FIXTURES)) {
    test(`${name} renders no inline style attribute`, () => {
        assert.doesNotMatch(renderToStaticMarkup(element), /\sstyle=/);
    });
}
