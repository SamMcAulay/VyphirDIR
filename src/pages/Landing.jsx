import { useEffect, useState } from 'react';
import { BLOB_PATHS } from '../components/decor/blob-paths.js';
import WaveText from '../components/WaveText.jsx';
import { selectLandingPreviews } from '../../shared/landing-previews.js';

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
 * Preview art is baked into the page at build time (landing-hub spec section
 * 4): the SSG writes it onto #root as data-previews and this reads it back at
 * hydration. `renderLanding` in scripts/render-pages.js bypasses the router
 * for '/' for the same reason -- it renders <Landing> directly with the
 * preview data instead of going through <App>.
 *
 * That covers a full page load only. Since the gravity-drop transitions
 * (page-transitions spec section 3) every internal link is a client-side
 * navigation, so arriving at '/' from any other page leaves the document that
 * was served for that page and #root carries no data-previews at all. The
 * effect below is the fallback for exactly that case: it derives the same
 * previews from the same two JSON files the build reads, using the same
 * shared selector, so both paths always agree.
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
    const [embedded, setEmbedded] = useState(readEmbeddedPreviews);

    useEffect(() => {
        if (previews || embedded) return undefined;
        let cancelled = false;
        Promise.all([
            fetch('/data/characters.json').then((r) => r.json()),
            fetch('/data/commissions.json').then((r) => r.json()),
        ])
            .then(([characters, commissions]) => {
                if (!cancelled) setEmbedded(selectLandingPreviews(characters, commissions));
            })
            .catch((error) => {
                console.error(error);
            });
        return () => {
            cancelled = true;
        };
    }, [previews, embedded]);

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
                                <WaveText className="hub-word" text={item.label} />
                            </a>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
