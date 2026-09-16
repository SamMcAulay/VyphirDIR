import { useLocation } from 'react-router-dom';
import { BLOB_PATHS } from '../components/decor/blob-paths.js';
import WaveText from '../components/WaveText.jsx';
import { cx } from '../components/cx.js';
import { usePopClick } from '../hooks/usePopClick.js';
import { PHOTO_URL } from './photo.js';
import { SECTIONS, sectionByKey, sectionForPath } from './sections.js';

const RIBBON_PATH = 'M0,22 C150,2 300,42 450,22 C600,2 750,42 900,22 C1050,2 1150,32 1200,20 L1200,78 C1050,98 900,58 750,78 C600,98 450,58 300,78 C150,98 50,70 0,82 Z';

/*
 * Fills and strokes come from CSS classes, never SVG attributes, so the
 * colour change between sections can transition (page-layouts spec 3.3).
 * The link carries the accessible name; both visible labels are hidden from
 * assistive technology and CSS shows one per breakpoint.
 */
function Bead({ section, active }) {
    const pop = usePopClick();
    return (
        <a
            className={cx('site-bead', `site-bead--${section.colour}`, 'pop-clickable', active && 'is-active', pop.className)}
            href={section.href}
            aria-label={section.name}
            aria-current={active ? 'page' : undefined}
            onPointerUp={pop.onPointerUp}
        >
            <svg className="site-bead__blob" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d={BLOB_PATHS[section.blob]} />
            </svg>
            <span className="site-bead__label site-bead__label--long" aria-hidden="true">
                <WaveText text={section.label} />
            </span>
            <span className="site-bead__label site-bead__label--short" aria-hidden="true">{section.shortLabel}</span>
        </a>
    );
}

export default function SiteBar() {
    const { pathname } = useLocation();
    const activeKey = sectionForPath(pathname);
    const colour = sectionByKey(activeKey)?.colour ?? 'teal';
    return (
        <header className={`site-bar site-bar--${colour}`}>
            <svg className="site-bar__ribbon" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d={RIBBON_PATH} />
            </svg>
            <div className="site-bar__inner">
                <a className="site-bar__photo" href="/" aria-label="Home">
                    <img src={PHOTO_URL} alt="" />
                </a>
                <nav className="site-bar__nav" aria-label="Site">
                    {SECTIONS.map((section) => (
                        <Bead key={section.key} section={section} active={section.key === activeKey} />
                    ))}
                </nav>
            </div>
        </header>
    );
}
