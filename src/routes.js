import Landing from './pages/Landing.jsx';
import Gallery from './pages/Gallery.jsx';
import Commissions from './pages/Commissions.jsx';
import Tos from './pages/Tos.jsx';
import Queue from './pages/Queue.jsx';
import Admin from './pages/Admin.jsx';

export const routes = [
    {
        path: '/',
        Page: Landing,
        title: "Sam's Directory",
        description: "Sam's Personal Social directory",
        ogImage: 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401',
    },
    { path: '/gallery/', Page: Gallery, title: 'Gallery | Vyphir', siteLayout: true },
    { path: '/commissions/', Page: Commissions, title: 'Commissions | Vyphir', siteLayout: true },
    { path: '/tos/', Page: Tos, title: 'Terms of Service | Vyphir', siteLayout: true },
    { path: '/queue/', Page: Queue, title: 'Queue | Vyphir', siteLayout: true },
    {
        path: '/admin/',
        Page: Admin,
        title: 'Admin | Vyphir',
        robotsNoIndex: true,
        noTransition: true,
        csp: "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';",
        extraStylesheets: ['/admin/admin.css'],
    },
];
