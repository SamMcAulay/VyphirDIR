import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';

export default function App() {
    return (
        <Routes>
            {routes.map(({ path, Page }) => (
                <Route key={path} path={path} element={<Page />} />
            ))}
        </Routes>
    );
}
