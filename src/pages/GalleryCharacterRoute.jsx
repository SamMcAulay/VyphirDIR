import { useState } from 'react';
import GalleryCharacter from './GalleryCharacter.jsx';

function readEmbeddedCharacter() {
    if (typeof document === 'undefined') return null;
    const raw = document.getElementById('root')?.dataset.character;
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export default function GalleryCharacterRoute() {
    const [character] = useState(readEmbeddedCharacter);
    if (!character) return null;
    return <GalleryCharacter character={character} />;
}
