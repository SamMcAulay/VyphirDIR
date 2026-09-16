import EnlargeableImage from '../components/EnlargeableImage.jsx';
import NsfwBlurImage from '../components/NsfwBlurImage.jsx';
import WaveText from '../components/WaveText.jsx';
import { cx } from '../components/cx.js';
import { selectCoverImage } from '../components/cover-image.js';

export default function GalleryCharacter({ character }) {
    const images = character.images || [];
    const cover = selectCoverImage(images);
    const rest = images.filter((img) => img !== cover);

    return (
        <div className="page-teal page-frame">
            <section className={cx('character-top', !cover && 'character-top--no-image')}>
                {cover && <EnlargeableImage src={cover.url} alt={character.name} className="character-hero" />}
                <div className="character-intro">
                    <a className="character-back" href="/gallery/">&larr; All characters</a>
                    <WaveText as="h1" className="character-name" text={character.name} />
                    {character.species && <p className="character-species">{character.species}</p>}
                    {character.bio && <p className="character-bio">{character.bio}</p>}
                </div>
            </section>
            {rest.length > 0 && (
                <ul className="square-grid character-grid">
                    {rest.map((img, i) => (
                        <li key={i}><NsfwBlurImage src={img.url} alt="" nsfw={Boolean(img.nsfw)} /></li>
                    ))}
                </ul>
            )}
        </div>
    );
}
