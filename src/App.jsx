import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';
import Background from './components/Background.jsx';

export default function App() {
    return (
        <>
            <Background />
            <Routes>
                {routes.map(({ path, Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                ))}
            </Routes>
        </>
    );
}
