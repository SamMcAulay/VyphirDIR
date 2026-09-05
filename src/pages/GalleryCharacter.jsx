import NsfwBlurImage from '../components/NsfwBlurImage.jsx';

export default function GalleryCharacter({ character }) {
    return (
        <div className="datapad-wrapper">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <div className="profile">
                    <h1>{character.name}</h1>
                    <p className="char-species">{character.species}</p>
                </div>
                <p className="char-bio">{character.bio}</p>
                <div className="char-image-grid">
                    {(character.images || []).map((img, i) => (
                        <NsfwBlurImage key={i} src={img.url} alt="" nsfw={Boolean(img.nsfw)} />
                    ))}
                </div>
            </div>
        </div>
    );
}
