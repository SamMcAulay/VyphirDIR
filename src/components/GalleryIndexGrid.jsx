import { useEffect, useState } from 'react';
import { cx } from './cx.js';
import { selectCoverImage } from './cover-image.js';
import { LOAD_ERROR } from './messages.js';
import WaveText from './WaveText.jsx';
import { usePopClick } from '../hooks/usePopClick.js';

function firstBioLine(bio) {
    return (bio || '').split('\n')[0].trim();
}

function GalleryTile({ character }) {
    const pop = usePopClick();
    const cover = selectCoverImage(character.images);
    return (
        <a
            className={cx('gallery-tile', 'pop-clickable', pop.className)}
            href={`/gallery/${character.slug}/`}
            aria-label={character.name}
            onPointerUp={pop.onPointerUp}
        >
            {cover && <img className="gallery-tile__image" src={cover.url} alt="" loading="lazy" />}
            <span className="gallery-tile__label">
                <WaveText className="gallery-tile__name" text={character.name} />
                <span className="gallery-tile__bio">{firstBioLine(character.bio)}</span>
            </span>
        </a>
    );
}

export function GalleryTiles({ characters }) {
    if (characters.length === 0) return <p className="page-message">No characters here yet.</p>;
    return (
        <ul className="gallery-grid">
            {characters.map((character) => (
                <li key={character.slug}><GalleryTile character={character} /></li>
            ))}
        </ul>
    );
}

export default function GalleryIndexGrid() {
    const [characters, setCharacters] = useState(null);

    useEffect(() => {
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((d) => setCharacters(d.characters || []))
            .catch((error) => {
                console.error(error);
                setCharacters('error');
            });
    }, []);

    if (characters === null) return null;
    if (characters === 'error') return <p className="page-message">{LOAD_ERROR}</p>;
    return <GalleryTiles characters={characters} />;
}
