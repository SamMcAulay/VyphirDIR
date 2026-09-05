import { useEffect, useState } from 'react';
import { CONFIRM_MESSAGE } from './constants.js';

export default function AdminCharacters() {
    const [characters, setCharacters] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [editingSlug, setEditingSlug] = useState(null);
    const [name, setName] = useState('');
    const [species, setSpecies] = useState('');
    const [bio, setBio] = useState('');
    const [existingImages, setExistingImages] = useState([]);
    const [newFiles, setNewFiles] = useState([]);
    const [newFileNsfw, setNewFileNsfw] = useState([]);
    const [newThumbnailKey, setNewThumbnailKey] = useState(null); // { kind: 'existing'|'new', index or url }
    const [status, setStatus] = useState({ message: '', isError: false });

    useEffect(() => {
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((d) => setCharacters(d.characters || []))
            .catch((error) => {
                console.error('Failed to load current characters:', error);
                setLoadError(true);
                setStatus({ message: 'Could not load current character data — reload before editing.', isError: true });
            });
    }, []);

    function resetForm() {
        setEditingSlug(null);
        setName('');
        setSpecies('');
        setBio('');
        setExistingImages([]);
        setNewFiles([]);
        setNewFileNsfw([]);
        setNewThumbnailKey(null);
    }

    function startEditing(character) {
        setEditingSlug(character.slug);
        setName(character.name || '');
        setSpecies(character.species || '');
        setBio(character.bio || '');
        setExistingImages((character.images || []).map((img) => ({ url: img.url, nsfw: Boolean(img.nsfw), keep: true })));
        setNewFiles([]);
        setNewFileNsfw([]);
        const thumb = (character.images || []).find((img) => img.thumbnail);
        setNewThumbnailKey(thumb ? { kind: 'existing', url: thumb.url } : null);
    }

    async function deleteCharacter(character) {
        const typed = window.prompt(`Type "${character.name}" to permanently delete this character:`);
        if (typed !== character.name) return;

        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ action: 'delete', slug: character.slug }));
            const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setCharacters((prev) => prev.filter((c) => c.slug !== character.slug));
            if (editingSlug === character.slug) resetForm();
            setStatus({ message: 'Deleted — live shortly', isError: false });
        } catch (error) {
            setStatus({ message: `Delete failed: ${error.message}`, isError: true });
        }
    }

    function handleFilesChange(e) {
        const files = Array.from(e.target.files);
        setNewFiles(files);
        setNewFileNsfw(files.map(() => false));
        setNewThumbnailKey((prev) => (prev?.kind === 'new' ? null : prev));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        const wasEditing = Boolean(editingSlug);

        const keptExisting = existingImages
            .filter((img) => img.keep)
            .map((img) => ({
                url: img.url,
                nsfw: img.nsfw,
                thumbnail: newThumbnailKey?.kind === 'existing' && newThumbnailKey.url === img.url,
            }));

        const totalImageCount = keptExisting.length + newFiles.length;
        const allImagesNsfw =
            totalImageCount > 0 &&
            keptExisting.every((img) => img.nsfw) &&
            newFileNsfw.every(Boolean);

        const meta = {
            name,
            species,
            bio,
            nsfwFlags: newFileNsfw,
            existingImages: keptExisting,
            thumbnailNewIndex: newThumbnailKey?.kind === 'new' ? newThumbnailKey.index : null,
        };
        if (editingSlug) meta.slug = editingSlug;

        const formData = new FormData();
        formData.append('meta', JSON.stringify(meta));
        newFiles.forEach((file) => formData.append('images', file));

        setStatus({ message: wasEditing ? 'Saving...' : 'Publishing...', isError: false });
        try {
            const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            const nsfwNote = allImagesNsfw
                ? " (note: all images are NSFW, so this character won't appear on the homepage gallery)"
                : '';
            setStatus({
                message: `${wasEditing ? 'Saved' : 'Published'} — live shortly at /gallery/${result.slug}/${nsfwNote}`,
                isError: false,
            });
            setCharacters((prev) => {
                const index = prev.findIndex((c) => c.slug === result.slug);
                if (index === -1) return [...prev, result.character];
                const copy = [...prev];
                copy[index] = result.character;
                return copy;
            });
            resetForm();
        } catch (error) {
            setStatus({ message: error.message, isError: true });
        }
    }

    return (
        <>
            <section className="admin-panel">
                <h2>Manage Characters</h2>
                <div id="character-list">
                    {characters.map((character) => {
                        const images = character.images || [];
                        const thumb = images.find((img) => img.thumbnail) || images[0];
                        return (
                            <div className="character-list-row" key={character.slug}>
                                {thumb && <img className="character-list-thumb" alt="" src={thumb.url} />}
                                <span className="character-list-name">{character.name}</span>
                                <button type="button" onClick={() => startEditing(character)}>Edit</button>
                                <button type="button" className="danger-button" onClick={() => deleteCharacter(character)}>Delete</button>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="admin-panel">
                <h2>{editingSlug ? `Edit ${name}` : 'Add Character'}</h2>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="char-name">Name</label>
                    <input type="text" id="char-name" required value={name} onChange={(e) => setName(e.target.value)} />

                    <label htmlFor="char-species">Species / Type</label>
                    <input type="text" id="char-species" value={species} onChange={(e) => setSpecies(e.target.value)} />

                    <label htmlFor="char-bio">Bio</label>
                    <textarea id="char-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />

                    <div id="char-existing-images">
                        {existingImages.map((img, i) => (
                            <div className="image-row existing-image-row" key={img.url}>
                                <img src={img.url} alt="" className="existing-image-thumb" />
                                <label>
                                    <input
                                        type="checkbox"
                                        className="existing-image-keep"
                                        checked={img.keep}
                                        onChange={(e) => setExistingImages((prev) => prev.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                                    /> Keep
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        className="existing-image-nsfw"
                                        checked={img.nsfw}
                                        onChange={(e) => setExistingImages((prev) => prev.map((x, j) => (j === i ? { ...x, nsfw: e.target.checked } : x)))}
                                    /> NSFW
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="char-thumbnail"
                                        className="existing-image-thumbnail"
                                        checked={newThumbnailKey?.kind === 'existing' && newThumbnailKey.url === img.url}
                                        onChange={() => setNewThumbnailKey({ kind: 'existing', url: img.url })}
                                    /> Thumbnail
                                </label>
                            </div>
                        ))}
                    </div>

                    <label htmlFor="char-images">Add images (select multiple)</label>
                    <input type="file" id="char-images" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFilesChange} />
                    <div id="char-nsfw-rows">
                        {newFiles.map((file, i) => (
                            <div className="image-row" key={i}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={newFileNsfw[i]}
                                        onChange={(e) => setNewFileNsfw((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                                    /> {file.name}
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="char-thumbnail"
                                        checked={newThumbnailKey?.kind === 'new' && newThumbnailKey.index === i}
                                        onChange={() => setNewThumbnailKey({ kind: 'new', index: i })}
                                    /> Thumbnail
                                </label>
                            </div>
                        ))}
                    </div>

                    <button type="submit" disabled={loadError}>{editingSlug ? 'Save Changes' : 'Publish Character'}</button>
                    {editingSlug && <button type="button" onClick={resetForm}>Cancel Edit</button>}
                    <p className={`admin-status ${status.isError ? 'error' : 'success'}`}>{status.message}</p>
                </form>
            </section>
        </>
    );
}
