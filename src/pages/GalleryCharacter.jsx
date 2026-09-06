import NsfwBlurImage from '../components/NsfwBlurImage.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';

export default function GalleryCharacter({ character }) {
    return (
        <div className="page-teal">
            <Panel>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <div className="profile">
                    <WaveText as="h1" text={character.name} />
                    <p className="char-species">{character.species}</p>
                </div>
                <p className="char-bio">{character.bio}</p>
                <div className="char-image-grid">
                    {(character.images || []).map((img, i) => (
                        <NsfwBlurImage key={i} src={img.url} alt="" nsfw={Boolean(img.nsfw)} />
                    ))}
                </div>
            </Panel>
        </div>
    );
}
