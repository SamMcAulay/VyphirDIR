import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App.jsx';
import Background from './components/Background.jsx';
import GalleryCharacter from './pages/GalleryCharacter.jsx';

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
        <>
            <Background />
            <GalleryCharacter character={character} />
        </>
    );
    return { html };
}
