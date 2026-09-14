import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';
import GalleryCharacterRoute from './pages/GalleryCharacterRoute.jsx';
import PageTransitions from './transitions/PageTransitions.jsx';

export default function App() {
    return (
        <>
            <PageTransitions />
            <Routes>
                {routes.map(({ path, Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                ))}
                <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
            </Routes>
        </>
    );
}
