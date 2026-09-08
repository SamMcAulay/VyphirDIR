import { useState } from 'react';

const BLOB_PATHS = {
    1: 'M45,10 C80,0 130,5 160,35 C190,65 195,115 170,150 C145,185 90,195 55,175 C20,155 5,110 15,70 C22,45 25,18 45,10 Z',
    2: 'M60,15 C100,-5 150,15 175,55 C195,90 185,140 150,170 C115,198 55,195 25,160 C0,130 5,80 25,50 C35,35 45,22 60,15 Z',
    3: 'M90,5 C130,0 175,25 185,65 C195,105 175,150 135,175 C95,198 45,190 20,155 C-5,120 5,70 35,40 C55,20 70,8 90,5 Z',
    4: 'M50,25 C85,0 140,0 170,30 C200,60 195,110 165,145 C135,180 75,190 40,165 C5,140 0,90 15,60 C25,40 35,32 50,25 Z',
};

const ITEMS = [
    { key: 'gallery', label: 'Gallery', href: '/gallery/', external: false, blob: 1, tint: '#C6F5EF', flat: '#C6F5EF', preview: 'gallery',
      style: { left: '-113px', top: '-106px', '--rot': '43deg', '--fs': '44px', '--c': '#23C9B7', '--stroke': '3px', '--blobw': '360px', '--blobx': '34%' } },
    { key: 'commissions', label: 'Commissions', href: '/commissions/', external: false, blob: 3, tint: '#FFEDB0', flat: '#FFEDB0', preview: 'commissions',
      style: { left: '-142px', top: '-62px', '--rot': '23deg', '--fs': '44px', '--c': '#FFC93C', '--stroke': '3px', '--blobw': '420px', '--blobx': '32%' } },
    { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/vyphir', external: true, blob: 2, flat: '#FFD3E4',
      style: { left: '-154px', top: '-21px', '--rot': '8deg', '--fs': '26px', '--c': '#FF6FA0', '--stroke': '2px', '--blobw': '170px' } },
    { key: 'twitter', label: 'Twitter', href: 'https://x.com/Vyphirr', external: true, blob: 4, flat: '#E7D8FF',
      style: { left: '-155px', top: '10px', '--rot': '-4deg', '--fs': '24px', '--c': '#B98CFF', '--stroke': '2px', '--blobw': '150px' } },
    { key: 'bluesky', label: 'Bluesky', href: 'https://bsky.app/profile/samisaderp.bsky.social', external: true, blob: 1, flat: '#C6F5EF',
      style: { left: '-150px', top: '39px', '--rot': '-15deg', '--fs': '23px', '--c': '#23C9B7', '--stroke': '2px', '--blobw': '145px' } },
    { key: 'telegram', label: 'Telegram', href: 'https://t.me/Samisaderp#', external: true, blob: 2, flat: '#FFE0BE',
      style: { left: '-141px', top: '64px', '--rot': '-25deg', '--fs': '21px', '--c': '#FF9A44', '--stroke': '2px', '--blobw': '135px' } },
    { key: 'toyhouse', label: 'Toyhouse', href: 'https://toyhou.se/samisaderp/characters', external: true, blob: 3, flat: '#FFD3E4',
      style: { left: '-129px', top: '87px', '--rot': '-34deg', '--fs': '20px', '--c': '#FF6FA0', '--stroke': '2px', '--blobw': '125px' } },
    { key: 'steam', label: 'Steam', href: 'https://steamcommunity.com/profiles/76561199191219060/', external: true, blob: 4, flat: '#E7D8FF',
      style: { left: '-113px', top: '106px', '--rot': '-43deg', '--fs': '19px', '--c': '#B98CFF', '--stroke': '2px', '--blobw': '115px' } },
];

const PHOTO_URL = 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401';

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
                <rect x="0" y="0" width="200" height="200" fill={item.tint} opacity=".33" />
            </g>
            <path d={path} fill="none" stroke="#3A2A24" strokeWidth="4" />
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
        <div className="page-pink hub">
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
                            <a className="hub-item" key={item.key} href={item.href} style={item.style} {...external}>
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
