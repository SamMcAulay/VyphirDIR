import { useEffect, useRef, useState } from 'react';

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export default function CharacterGalleryStrip() {
    const [characters, setCharacters] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((d) => setCharacters(shuffleArray(d.characters || [])))
            .catch((error) => console.error(error));
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !characters || characters.length === 0) return;

        let autoScrollInterval;
        const scrollStep = 155;
        const delay = 2500;
        const startScroll = () => {
            autoScrollInterval = setInterval(() => {
                if (Math.ceil(container.scrollLeft + container.clientWidth) >= container.scrollWidth) {
                    container.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    container.scrollBy({ left: scrollStep, behavior: 'smooth' });
                }
            }, delay);
        };
        const stopScroll = () => clearInterval(autoScrollInterval);
        startScroll();
        container.addEventListener('mouseenter', stopScroll);
        container.addEventListener('mouseleave', startScroll);
        container.addEventListener('touchstart', stopScroll, { passive: true });
        container.addEventListener('touchend', startScroll, { passive: true });

        return () => {
            stopScroll();
            container.removeEventListener('mouseenter', stopScroll);
            container.removeEventListener('mouseleave', startScroll);
            container.removeEventListener('touchstart', stopScroll);
            container.removeEventListener('touchend', startScroll);
        };
    }, [characters]);

    if (characters === null) return <div className="gallery-container" id="character-gallery" ref={containerRef} />;
    if (characters.length === 0) return <div className="gallery-container" id="character-gallery" ref={containerRef}><p className="gallery-empty">&gt; NO CHARACTERS ARCHIVED YET</p></div>;

    return (
        <div className="gallery-container" id="character-gallery" ref={containerRef}>
            {characters.map((char) => {
                const images = char.images || [];
                const firstImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);
                if (!firstImage) return null;
                return (
                    <a className="gallery-card" href={`/gallery/${char.slug}/`} key={char.slug}>
                        <img src={firstImage.url} alt={char.name} loading="lazy" />
                        <p>{char.name}</p>
                    </a>
                );
            })}
        </div>
    );
}
