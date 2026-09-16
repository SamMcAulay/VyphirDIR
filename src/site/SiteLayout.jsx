import { Outlet } from 'react-router-dom';
import SiteBar from './SiteBar.jsx';

/*
 * The layout route's element (page-layouts spec section 4). React Router keeps
 * it mounted while child routes change, which is what keeps the bar still
 * between inner pages. `children` lets renderCharacter build the identical tree
 * without an outlet (spec section 5).
 */
export default function SiteLayout({ children }) {
    return (
        <div className="site">
            <SiteBar />
            <main className="site-page">{children ?? <Outlet />}</main>
        </div>
    );
}
