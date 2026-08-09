import { setupEnlargeableImages } from '../shared/enlargeable.js';

function truncateBio(bio, maxLength = 120) {
    const firstLine = (bio || '').split('\n')[0].trim();
    if (firstLine.length <= maxLength) return firstLine;
    return `${firstLine.slice(0, maxLength - 1).trimEnd()}…`;
}

function selectPreviewImages(images, iconUrl, maxCount = 3) {
    return (images || [])
        .filter((img) => !img.nsfw && img.url !== iconUrl)
        .slice(0, maxCount);
}

function renderCharacterCard(character) {
    const images = character.images || [];
    const iconImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);

    const card = document.createElement('div');
    card.className = 'gallery-index-card';

    const link = document.createElement('a');
    link.className = 'gallery-index-card-main';
    link.href = `/gallery/${character.slug}/`;

    if (iconImage) {
        const icon = document.createElement('img');
        icon.className = 'gallery-index-icon';
        icon.src = iconImage.url;
        icon.alt = character.name;
        icon.loading = 'lazy';
        link.appendChild(icon);
    }

    const name = document.createElement('h3');
    name.textContent = character.name;
    link.appendChild(name);

    const bio = document.createElement('p');
    bio.className = 'gallery-index-bio';
    bio.textContent = truncateBio(character.bio);
    link.appendChild(bio);

    card.appendChild(link);

    const previewImages = selectPreviewImages(images, iconImage && iconImage.url);
    if (previewImages.length > 0) {
        const artRow = document.createElement('div');
        artRow.className = 'gallery-index-art-row';
        previewImages.forEach((img) => {
            const wrap = document.createElement('div');
            wrap.className = 'char-image-wrap gallery-index-thumb';
            const thumbImg = document.createElement('img');
            thumbImg.src = img.url;
            thumbImg.alt = character.name;
            thumbImg.loading = 'lazy';
            wrap.appendChild(thumbImg);
            artRow.appendChild(wrap);
        });
        card.appendChild(artRow);
    }

    return card;
}

async function loadGalleryIndex() {
    const container = document.getElementById('gallery-index');
    if (!container) return;

    try {
        const response = await fetch('/data/characters.json');
        const data = await response.json();
        const characters = data.characters || [];

        if (characters.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> NO CHARACTERS ARCHIVED YET';
            container.appendChild(empty);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'gallery-index-grid';
        characters.forEach((character) => grid.appendChild(renderCharacterCard(character)));
        container.appendChild(grid);

        setupEnlargeableImages(container);
    } catch (error) {
        console.error(error);
        const errorMsg = document.createElement('p');
        errorMsg.className = 'feed-error';
        errorMsg.textContent = '> DATA UNAVAILABLE.';
        container.appendChild(errorMsg);
    }
}

export function init() {
    return loadGalleryIndex();
}
