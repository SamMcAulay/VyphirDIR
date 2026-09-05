import Landing from './pages/Landing.jsx';
import Gallery from './pages/Gallery.jsx';

export const routes = [
    {
        path: '/',
        Page: Landing,
        title: "Sam's Directory",
        description: "Sam's Personal Social directory",
        ogImage: 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401',
    },
    { path: '/gallery/', Page: Gallery, title: 'Gallery | Vyphir' },
];
