import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';
import GalleryCharacterRoute from './pages/GalleryCharacterRoute.jsx';
import SiteLayout from './site/SiteLayout.jsx';
import PageTransitions from './transitions/PageTransitions.jsx';

const standaloneRoutes = routes.filter((route) => !route.siteLayout);
const layoutRoutes = routes.filter((route) => route.siteLayout);

export default function App() {
    return (
        <>
            <PageTransitions />
            <Routes>
                {standaloneRoutes.map(({ path, Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                ))}
                <Route element={<SiteLayout />}>
                    {layoutRoutes.map(({ path, Page }) => (
                        <Route key={path} path={path} element={<Page />} />
                    ))}
                    <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
                </Route>
            </Routes>
        </>
    );
}
