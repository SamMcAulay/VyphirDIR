import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App.jsx';
import GalleryCharacter from './pages/GalleryCharacter.jsx';
import Landing from './pages/Landing.jsx';
import SiteLayout from './site/SiteLayout.jsx';

export { routes } from './routes.js';

export function render(url) {
    const html = renderToString(
        <StaticRouter location={url}>
            <App />
        </StaticRouter>
    );
    return { html };
}

export function renderCharacter(character) {
    const html = renderToString(
        <StaticRouter location={`/gallery/${character.slug}/`}>
            <SiteLayout>
                <GalleryCharacter character={character} />
            </SiteLayout>
        </StaticRouter>
    );
    return { html };
}

export function renderLanding(pools) {
    const html = renderToString(<Landing pools={pools} />);
    return { html };
}
