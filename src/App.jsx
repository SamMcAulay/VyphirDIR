import { Routes, Route, useLocation } from 'react-router-dom';
import { routes } from './routes.js';
import Background from './components/Background.jsx';
import GalleryCharacterRoute from './pages/GalleryCharacterRoute.jsx';

export default function App() {
    const location = useLocation();
    return (
        <>
            {location.pathname !== '/admin/' && <Background />}
            <Routes>
                {routes.map(({ path, Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                ))}
                <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
            </Routes>
        </>
    );
}
