import { useState } from 'react';
import { BLOB_PATHS } from '../components/decor/blob-paths.js';

const ITEMS = [
    { key: 'gallery', label: 'Gallery', href: '/gallery/', external: false, blob: 1, tint: 'var(--slime-teal-light)', tintOpacity: '.34', flat: 'var(--slime-teal-light)', preview: 'gallery' },
    { key: 'commissions', label: 'Commissions', href: '/commissions/', external: false, blob: 3, tint: 'var(--slime-honey-light)', tintOpacity: '.32', flat: 'var(--slime-honey-light)', preview: 'commissions' },
    { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/vyphir', external: true, blob: 2, flat: 'var(--slime-pink-light)' },
    { key: 'twitter', label: 'Twitter', href: 'https://x.com/Vyphirr', external: true, blob: 4, flat: 'var(--slime-lavender-light)' },
    { key: 'bluesky', label: 'Bluesky', href: 'https://bsky.app/profile/samisaderp.bsky.social', external: true, blob: 1, flat: 'var(--slime-teal-light)' },
    { key: 'telegram', label: 'Telegram', href: 'https://t.me/Samisaderp#', external: true, blob: 2, flat: 'var(--slime-tabby-light)' },
    { key: 'toyhouse', label: 'Toyhouse', href: 'https://toyhou.se/samisaderp/characters', external: true, blob: 3, flat: 'var(--slime-pink-light)' },
    { key: 'steam', label: 'Steam', href: 'https://steamcommunity.com/profiles/76561199191219060/', external: true, blob: 4, flat: 'var(--slime-lavender-light)' },
];

const PHOTO_URL = 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401';

/*
 * Preview art is baked into the page at build time (spec section 4): the SSG
 * writes it onto #root as data-previews and this reads it back ONCE, at
 * hydration, via useState's lazy initialiser.
 *
 * That is correct only while every route change on this site is a full-page
 * <a> navigation, which reloads the document and so re-runs this with the
 * new page's #root. `renderLanding` in scripts/render-pages.js deliberately
 * bypasses the router for '/' for the same reason -- it renders <Landing>
 * directly with the preview data instead of going through <App>.
 *
 * If in-app client-side routing to '/' is ever added, both halves break
 * together: no document reload means no fresh #root read, so Landing would
 * mount with empty preview sets and silently fall back to flat blobs. Fixing
 * that means threading the preview data through the router (a loader, or a
 * module-level cache captured on first load), not patching it here.
 */
function readEmbeddedPreviews() {
    if (typeof document === 'undefined') return null;
    const raw = document.getElementById('root')?.dataset.previews;
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function PreviewBlob({ item, images }) {
    const path = BLOB_PATHS[item.blob];
    const clipId = `hub-clip-${item.key}`;
    const cells = [[0, 0], [100, 0], [0, 100], [100, 100]];
    return (
        <svg className="hub-blob" viewBox="0 0 200 200" aria-hidden="true">
            <defs><clipPath id={clipId}><path d={path} /></clipPath></defs>
            <g clipPath={`url(#${clipId})`}>
                {images.map((url, i) => (
                    <image
                        key={url}
                        href={url}
                        x={cells[i % 4][0]}
                        y={cells[i % 4][1]}
                        width="100"
                        height="100"
                        preserveAspectRatio="xMidYMid slice"
                    />
                ))}
                <rect x="0" y="0" width="200" height="200" fill={item.tint} opacity={item.tintOpacity} />
            </g>
            <path d={path} fill="none" stroke="var(--text-ink)" strokeWidth="4" />
        </svg>
    );
}

function FlatBlob({ item }) {
    return (
        <svg className="hub-blob" viewBox="0 0 200 200" aria-hidden="true">
            <path d={BLOB_PATHS[item.blob]} fill={item.flat} />
        </svg>
    );
}

export default function Landing({ previews }) {
    const [embedded] = useState(readEmbeddedPreviews);
    const data = previews || embedded || { gallery: [], commissions: [] };

    return (
        <div className="hub">
            <h1 className="sr-only">Sam's Directory</h1>

            <div className="hub-slab hub-slab--teal" aria-hidden="true" />
            <div className="hub-slab hub-slab--pink" aria-hidden="true" />
            <div className="hub-slab hub-slab--honey" aria-hidden="true" />

            <div className="hub-anchor">
                <a className="hub-photo" href="/" aria-label="Home">
                    <img src={PHOTO_URL} alt="" />
                </a>

                <nav className="hub-nav">
                    {ITEMS.map((item) => {
                        const images = item.preview ? (data[item.preview] || []) : [];
                        const external = item.external
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {};
                        return (
                            <a className={`hub-item hub-item--${item.key}`} key={item.key} href={item.href} {...external}>
                                {images.length > 0
                                    ? <PreviewBlob item={item} images={images} />
                                    : <FlatBlob item={item} />}
                                <span className="hub-word">{item.label}</span>
                            </a>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
