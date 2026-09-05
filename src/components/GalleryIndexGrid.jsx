import { useEffect, useState } from 'react';
import EnlargeableImage from './EnlargeableImage.jsx';

function truncateBio(bio, maxLength = 120) {
    const firstLine = (bio || '').split('\n')[0].trim();
    if (firstLine.length <= maxLength) return firstLine;
    return `${firstLine.slice(0, maxLength - 1).trimEnd()}…`;
}

function selectPreviewImages(images, iconUrl, maxCount = 3) {
    return (images || []).filter((img) => !img.nsfw && img.url !== iconUrl).slice(0, maxCount);
}

function CharacterCard({ character }) {
    const images = character.images || [];
    const iconImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);
    const previewImages = selectPreviewImages(images, iconImage && iconImage.url);

    return (
        <div className="gallery-index-card">
            <a className="gallery-index-card-main" href={`/gallery/${character.slug}/`}>
                {iconImage && <img className="gallery-index-icon" src={iconImage.url} alt={character.name} loading="lazy" />}
                <h3>{character.name}</h3>
                <p className="gallery-index-bio">{truncateBio(character.bio)}</p>
            </a>
            {previewImages.length > 0 && (
                <div className="gallery-index-art-row">
                    {previewImages.map((img, i) => (
                        <EnlargeableImage key={i} src={img.url} alt={character.name} className="gallery-index-thumb" />
                    ))}
                </div>
            )}
        </div>
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
    if (characters === 'error') return <p className="feed-error">&gt; DATA UNAVAILABLE.</p>;
    if (characters.length === 0) return <p className="gallery-empty">&gt; NO CHARACTERS ARCHIVED YET</p>;

    return (
        <div className="gallery-index-grid">
            {characters.map((char) => <CharacterCard character={char} key={char.slug} />)}
        </div>
    );
}
