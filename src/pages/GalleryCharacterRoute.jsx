import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GalleryCharacter from './GalleryCharacter.jsx';

/*
 * The build bakes each character onto #root as data-character, which is the
 * fast path on a full page load. Client-side navigation from /gallery/ leaves
 * the document that was served for /gallery/, so that attribute is either
 * absent or belongs to a different character -- hence the slug check and the
 * fetch fallback, which is the same pattern GalleryIndexGrid, QueueBoard,
 * TosPointList and Commissions already use (spec section 7).
 */
function readEmbeddedCharacter(slug) {
    if (typeof document === 'undefined') return null;
    const raw = document.getElementById('root')?.dataset.character;
    if (!raw) return null;
    try {
        const character = JSON.parse(raw);
        return character && character.slug === slug ? character : null;
    } catch {
        return null;
    }
}

export default function GalleryCharacterRoute() {
    const { slug } = useParams();
    const [character, setCharacter] = useState(() => readEmbeddedCharacter(slug));

    useEffect(() => {
        const embedded = readEmbeddedCharacter(slug);
        if (embedded) {
            setCharacter(embedded);
            return undefined;
        }
        let cancelled = false;
        setCharacter(null);
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                const match = (data.characters || []).find((c) => c.slug === slug);
                setCharacter(match || null);
            })
            .catch((error) => {
                console.error(error);
                if (!cancelled) setCharacter(null);
            });
        return () => {
            cancelled = true;
        };
    }, [slug]);

    // The browser set this for free on a full page load; under client-side
    // navigation only this component knows the name (spec section 3).
    useEffect(() => {
        if (character) document.title = `${character.name} | Vyphir`;
    }, [character]);

    if (!character) return null;
    return <GalleryCharacter character={character} />;
}
