function setStatus(elementId, message, isError) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = `admin-status ${isError ? 'error' : 'success'}`;
}

function renderNsfwCheckboxes(files) {
    const container = document.getElementById('char-nsfw-rows');
    container.innerHTML = '';
    Array.from(files).forEach((file, i) => {
        const row = document.createElement('div');
        row.className = 'image-row';

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.nsfwIndex = String(i);

        label.append(checkbox, document.createTextNode(` ${file.name}`));

        const thumbLabel = document.createElement('label');
        const thumbRadio = document.createElement('input');
        thumbRadio.type = 'radio';
        thumbRadio.name = 'char-thumbnail';
        thumbRadio.className = 'new-image-thumbnail';
        thumbRadio.dataset.newIndex = String(i);
        thumbLabel.append(thumbRadio, document.createTextNode(' Thumbnail'));

        row.append(label, thumbLabel);
        container.appendChild(row);
    });
}

document.getElementById('char-images').addEventListener('change', (event) => {
    renderNsfwCheckboxes(event.target.files);
});

let currentCharacters = [];
let editingSlug = null;

function renderExistingImages(images) {
    const container = document.getElementById('char-existing-images');
    container.innerHTML = '';
    (images || []).forEach((img) => {
        const row = document.createElement('div');
        row.className = 'image-row existing-image-row';
        row.dataset.url = img.url;

        const thumb = document.createElement('img');
        thumb.src = img.url;
        thumb.alt = '';
        thumb.className = 'existing-image-thumb';

        const keepLabel = document.createElement('label');
        const keepCheckbox = document.createElement('input');
        keepCheckbox.type = 'checkbox';
        keepCheckbox.className = 'existing-image-keep';
        keepCheckbox.checked = true;
        keepLabel.append(keepCheckbox, document.createTextNode(' Keep'));

        const nsfwLabel = document.createElement('label');
        const nsfwCheckbox = document.createElement('input');
        nsfwCheckbox.type = 'checkbox';
        nsfwCheckbox.className = 'existing-image-nsfw';
        nsfwCheckbox.checked = Boolean(img.nsfw);
        nsfwLabel.append(nsfwCheckbox, document.createTextNode(' NSFW'));

        const thumbLabel = document.createElement('label');
        const thumbRadio = document.createElement('input');
        thumbRadio.type = 'radio';
        thumbRadio.name = 'char-thumbnail';
        thumbRadio.className = 'existing-image-thumbnail';
        thumbRadio.checked = Boolean(img.thumbnail);
        thumbLabel.append(thumbRadio, document.createTextNode(' Thumbnail'));

        row.append(thumb, keepLabel, nsfwLabel, thumbLabel);
        container.appendChild(row);
    });
}

function startEditingCharacter(character) {
    editingSlug = character.slug;
    document.getElementById('char-name').value = character.name || '';
    document.getElementById('char-species').value = character.species || '';
    document.getElementById('char-bio').value = character.bio || '';
    document.getElementById('char-images').value = '';
    document.getElementById('char-nsfw-rows').innerHTML = '';
    renderExistingImages(character.images);
    document.getElementById('character-form-heading').textContent = `Edit ${character.name}`;
    document.getElementById('character-submit-button').textContent = 'Save Changes';
    document.getElementById('character-cancel-edit').classList.remove('hidden');
}

function resetCharacterForm() {
    editingSlug = null;
    document.getElementById('character-form').reset();
    document.getElementById('char-nsfw-rows').innerHTML = '';
    document.getElementById('char-existing-images').innerHTML = '';
    document.getElementById('character-form-heading').textContent = 'Add Character';
    document.getElementById('character-submit-button').textContent = 'Publish Character';
    document.getElementById('character-cancel-edit').classList.add('hidden');
}

document.getElementById('character-cancel-edit').addEventListener('click', resetCharacterForm);

async function deleteCharacterFlow(character) {
    const typed = window.prompt(`Type "${character.name}" to permanently delete this character:`);
    if (typed !== character.name) return;

    try {
        const formData = new FormData();
        formData.append('meta', JSON.stringify({ action: 'delete', slug: character.slug }));
        const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        currentCharacters = currentCharacters.filter((c) => c.slug !== character.slug);
        renderCharacterList();
        if (editingSlug === character.slug) resetCharacterForm();
        setStatus('character-status', 'Deleted — live shortly', false);
    } catch (error) {
        setStatus('character-status', `Delete failed: ${error.message}`, true);
    }
}

function renderCharacterList() {
    const container = document.getElementById('character-list');
    container.innerHTML = '';
    currentCharacters.forEach((character) => {
        const row = document.createElement('div');
        row.className = 'character-list-row';

        const images = character.images || [];
        const firstImage = images.find((img) => img.thumbnail) || images[0];
        const thumb = document.createElement('img');
        thumb.className = 'character-list-thumb';
        thumb.alt = '';
        if (firstImage) thumb.src = firstImage.url;

        const name = document.createElement('span');
        name.className = 'character-list-name';
        name.textContent = character.name;

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => startEditingCharacter(character));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'danger-button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteCharacterFlow(character));

        row.append(thumb, name, editButton, deleteButton);
        container.appendChild(row);
    });
}

fetch('/data/characters.json')
    .then((r) => r.json())
    .then((d) => {
        currentCharacters = d.characters || [];
        renderCharacterList();
    })
    .catch((error) => {
        console.error('Failed to load current characters:', error);
        setStatus('character-status', 'Could not load current character data — reload before editing.', true);
        document.getElementById('character-submit-button').disabled = true;
    });

function renderTierRow(tier) {
    const container = document.getElementById('comm-tiers-rows');
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.dataset.existingExample = (tier && tier.example) || '';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'tier-name';
    nameInput.placeholder = 'Tier name';
    nameInput.value = (tier && tier.name) || '';

    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.className = 'tier-price';
    priceInput.placeholder = 'Price (e.g. $20)';
    priceInput.value = (tier && tier.price) || '';

    const descriptionInput = document.createElement('textarea');
    descriptionInput.className = 'tier-description';
    descriptionInput.rows = 2;
    descriptionInput.placeholder = 'Description';
    descriptionInput.value = (tier && tier.description) || '';

    const imageLabel = document.createElement('label');
    imageLabel.textContent = tier && tier.example ? 'Replace example image (optional)' : 'Example image (optional)';

    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.className = 'tier-image';
    imageInput.accept = 'image/png,image/jpeg,image/webp';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove tier';
    removeButton.addEventListener('click', () => row.remove());

    row.append(nameInput, priceInput, descriptionInput, imageLabel, imageInput, removeButton);
    container.appendChild(row);
}

document.getElementById('comm-add-tier').addEventListener('click', () => renderTierRow(null));

let currentPastWork = [];
let savedPastWorkOrder = [];

function pastWorkOrderIsDirty() {
    if (currentPastWork.length !== savedPastWorkOrder.length) return true;
    return currentPastWork.some((entry, i) => entry.url !== savedPastWorkOrder[i]);
}

function updateSaveOrderButton() {
    document.getElementById('past-work-save-order').disabled = !pastWorkOrderIsDirty();
}

function movePastWork(entry, direction) {
    const index = currentPastWork.findIndex((e) => e.url === entry.url);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= currentPastWork.length) return;

    const reordered = [...currentPastWork];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    currentPastWork = reordered;
    renderPastWorkList();
}

document.getElementById('past-work-save-order').addEventListener('click', async () => {
    if (!pastWorkOrderIsDirty()) return;
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append(
            'meta',
            JSON.stringify({ type: 'past-work', action: 'reorder', order: currentPastWork.map((e) => e.url) })
        );
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        savedPastWorkOrder = currentPastWork.map((e) => e.url);
        updateSaveOrderButton();
        setStatus('past-work-order-status', 'Order saved — live shortly', false);
    } catch (error) {
        setStatus('past-work-order-status', error.message, true);
    }
});

async function toggleNsfwFlow(entry, checkbox) {
    const newValue = checkbox.checked;
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        checkbox.checked = Boolean(entry.nsfw);
        return;
    }

    try {
        const formData = new FormData();
        formData.append(
            'meta',
            JSON.stringify({ type: 'past-work', action: 'edit', url: entry.url, caption: entry.caption, nsfw: newValue })
        );
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        entry.nsfw = newValue;
        setStatus('past-work-status', 'Updated — live shortly', false);
    } catch (error) {
        checkbox.checked = Boolean(entry.nsfw);
        setStatus('past-work-status', error.message, true);
    }
}

async function toggleGiftArtFlow(entry, checkbox) {
    const newValue = checkbox.checked;
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        checkbox.checked = Boolean(entry.giftArt);
        return;
    }

    try {
        const formData = new FormData();
        formData.append(
            'meta',
            JSON.stringify({
                type: 'past-work',
                action: 'edit',
                url: entry.url,
                caption: entry.caption,
                giftArt: newValue,
            })
        );
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        entry.giftArt = newValue;
        setStatus('past-work-status', 'Updated — live shortly', false);
    } catch (error) {
        checkbox.checked = Boolean(entry.giftArt);
        setStatus('past-work-status', error.message, true);
    }
}

function renderPastWorkList() {
    const container = document.getElementById('past-work-list');
    container.innerHTML = '';
    currentPastWork.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'past-work-list-row';

        const thumb = document.createElement('img');
        thumb.className = 'past-work-list-thumb';
        thumb.src = entry.url;
        thumb.alt = '';

        const caption = document.createElement('span');
        caption.className = 'past-work-list-caption';
        caption.textContent = entry.caption || '';

        const nsfwLabel = document.createElement('label');
        const nsfwCheckbox = document.createElement('input');
        nsfwCheckbox.type = 'checkbox';
        nsfwCheckbox.checked = Boolean(entry.nsfw);
        nsfwCheckbox.addEventListener('change', () => toggleNsfwFlow(entry, nsfwCheckbox));
        nsfwLabel.append(nsfwCheckbox, document.createTextNode(' NSFW'));

        const giftArtLabel = document.createElement('label');
        const giftArtCheckbox = document.createElement('input');
        giftArtCheckbox.type = 'checkbox';
        giftArtCheckbox.checked = Boolean(entry.giftArt);
        giftArtCheckbox.addEventListener('change', () => toggleGiftArtFlow(entry, giftArtCheckbox));
        giftArtLabel.append(giftArtCheckbox, document.createTextNode(' Gift art'));

        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.textContent = '↑';
        upButton.disabled = index === 0;
        upButton.addEventListener('click', () => movePastWork(entry, -1));

        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.textContent = '↓';
        downButton.disabled = index === currentPastWork.length - 1;
        downButton.addEventListener('click', () => movePastWork(entry, 1));

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit caption';
        editButton.addEventListener('click', () => editPastWorkFlow(entry));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'danger-button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deletePastWorkFlow(entry));

        row.append(thumb, caption, nsfwLabel, giftArtLabel, upButton, downButton, editButton, deleteButton);
        container.appendChild(row);
    });
    updateSaveOrderButton();
}

async function editPastWorkFlow(entry) {
    const newCaption = window.prompt('Edit caption:', entry.caption || '');
    if (newCaption === null) return;
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append(
            'meta',
            JSON.stringify({ type: 'past-work', action: 'edit', url: entry.url, caption: newCaption })
        );
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        entry.caption = newCaption;
        renderPastWorkList();
        setStatus('past-work-status', 'Caption updated — live shortly', false);
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
}

async function deletePastWorkFlow(entry) {
    if (
        !window.confirm(
            'Delete this past-work entry? This will be published live and permanently recorded in git history.'
        )
    ) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('meta', JSON.stringify({ type: 'past-work', action: 'delete', url: entry.url }));
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        currentPastWork = currentPastWork.filter((e) => e.url !== entry.url);
        savedPastWorkOrder = savedPastWorkOrder.filter((u) => u !== entry.url);
        renderPastWorkList();
        setStatus('past-work-status', 'Deleted — live shortly', false);
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
}

fetch('/data/commissions.json')
    .then((r) => r.json())
    .then((d) => {
        document.getElementById('comm-status').checked = Boolean(d.status);
        document.getElementById('comm-intro').value = d.intro || '';
        document.getElementById('comm-special-offer').value = d.specialOffer || '';
        (d.tiers || []).forEach((tier) => renderTierRow(tier));
        currentPastWork = d.pastWork || [];
        savedPastWorkOrder = currentPastWork.map((e) => e.url);
        renderPastWorkList();
    })
    .catch((error) => {
        console.error('Failed to load current commissions data:', error);
        setStatus('commissions-info-status', 'Could not load current commission data — reload before saving.', true);
        document.querySelector('#commissions-info-form button[type="submit"]').disabled = true;
    });

document.getElementById('character-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const wasEditing = Boolean(editingSlug);

    const files = document.getElementById('char-images').files;
    const nsfwFlags = Array.from(document.querySelectorAll('#char-nsfw-rows [data-nsfw-index]')).map((cb) => cb.checked);
    const selectedExistingThumbRow = document.querySelector('.existing-image-thumbnail:checked')?.closest('.existing-image-row');
    const existingImages = Array.from(document.querySelectorAll('#char-existing-images .existing-image-row'))
        .filter((row) => row.querySelector('.existing-image-keep').checked)
        .map((row) => ({
            url: row.dataset.url,
            nsfw: row.querySelector('.existing-image-nsfw').checked,
            thumbnail: row === selectedExistingThumbRow,
        }));
    const selectedNewThumbIndex = document.querySelector('.new-image-thumbnail:checked')?.dataset.newIndex;

    const totalImageCount = existingImages.length + files.length;
    const allImagesNsfw =
        totalImageCount > 0 &&
        existingImages.every((img) => img.nsfw) &&
        nsfwFlags.slice(0, files.length).every(Boolean);

    const meta = {
        name: document.getElementById('char-name').value,
        species: document.getElementById('char-species').value,
        bio: document.getElementById('char-bio').value,
        nsfwFlags,
        existingImages,
        thumbnailNewIndex: selectedNewThumbIndex !== undefined ? Number(selectedNewThumbIndex) : null,
    };
    if (editingSlug) meta.slug = editingSlug;

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    Array.from(files).forEach((file) => formData.append('images', file));

    setStatus('character-status', wasEditing ? 'Saving...' : 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        const nsfwNote = allImagesNsfw
            ? " (note: all images are NSFW, so this character won't appear on the homepage gallery)"
            : '';
        setStatus(
            'character-status',
            `${wasEditing ? 'Saved' : 'Published'} — live shortly at /gallery/${result.slug}/${nsfwNote}`,
            false
        );

        const index = currentCharacters.findIndex((c) => c.slug === result.slug);
        if (index === -1) {
            currentCharacters.push(result.character);
        } else {
            currentCharacters[index] = result.character;
        }
        renderCharacterList();
        resetCharacterForm();
    } catch (error) {
        setStatus('character-status', error.message, true);
    }
});

document.getElementById('commissions-info-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const tierRows = Array.from(document.querySelectorAll('#comm-tiers-rows .tier-row'));
    const tiers = [];
    const tierFiles = [];
    tierRows.forEach((row) => {
        const name = row.querySelector('.tier-name').value.trim();
        const price = row.querySelector('.tier-price').value.trim();
        const description = row.querySelector('.tier-description').value.trim();
        const existingExample = row.dataset.existingExample || '';
        const newFile = row.querySelector('.tier-image').files[0];

        if (!name && !price && !description && !existingExample && !newFile) return;

        tiers.push({ name, price, description, example: existingExample });
        tierFiles.push(newFile || new File([], 'unchanged'));
    });

    const meta = {
        type: 'info',
        status: document.getElementById('comm-status').checked,
        intro: document.getElementById('comm-intro').value,
        specialOffer: document.getElementById('comm-special-offer').value,
        tiers,
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    tierFiles.forEach((file) => formData.append('tierImages', file));

    setStatus('commissions-info-status', 'Saving...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('commissions-info-status', 'Saved — live shortly', false);
        document.getElementById('comm-tiers-rows').innerHTML = '';
        (result.tiers || []).forEach((tier) => renderTierRow(tier));
    } catch (error) {
        setStatus('commissions-info-status', error.message, true);
    }
});

function moveRow(row, direction) {
    if (direction === -1 && row.previousElementSibling) {
        row.parentElement.insertBefore(row, row.previousElementSibling);
    } else if (direction === 1 && row.nextElementSibling) {
        row.parentElement.insertBefore(row.nextElementSibling, row);
    }
}

function renderTosBulletRow(container, bullet) {
    const row = document.createElement('div');
    row.className = 'tos-bullet-row';

    const typeSelect = document.createElement('select');
    typeSelect.className = 'tos-bullet-type';
    [['plain', 'Plain'], ['yesno', 'Yes / No']].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        typeSelect.appendChild(option);
    });
    typeSelect.value = (bullet && bullet.type) || 'plain';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'tos-bullet-text';
    textInput.placeholder = 'Bullet text';
    textInput.value = (bullet && bullet.text) || '';

    const valueLabel = document.createElement('label');
    valueLabel.className = 'tos-bullet-yesno-value';
    const valueCheckbox = document.createElement('input');
    valueCheckbox.type = 'checkbox';
    valueCheckbox.className = 'tos-bullet-value';
    valueCheckbox.checked = Boolean(bullet && bullet.value);
    valueLabel.append(valueCheckbox, document.createTextNode(' Yes (unchecked = No)'));

    const syncValueVisibility = () => valueLabel.classList.toggle('hidden', typeSelect.value !== 'yesno');
    typeSelect.addEventListener('change', syncValueVisibility);
    syncValueVisibility();

    const upButton = document.createElement('button');
    upButton.type = 'button';
    upButton.textContent = '↑';
    upButton.addEventListener('click', () => moveRow(row, -1));

    const downButton = document.createElement('button');
    downButton.type = 'button';
    downButton.textContent = '↓';
    downButton.addEventListener('click', () => moveRow(row, 1));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'danger-button';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => row.remove());

    row.append(typeSelect, textInput, valueLabel, upButton, downButton, removeButton);
    container.appendChild(row);
}

function renderTosPointRow(point) {
    const container = document.getElementById('tos-points-rows');
    const row = document.createElement('div');
    row.className = 'tos-point-row';

    const header = document.createElement('div');
    header.className = 'tos-point-row-header';

    const upButton = document.createElement('button');
    upButton.type = 'button';
    upButton.textContent = '↑ Move point';
    upButton.addEventListener('click', () => moveRow(row, -1));

    const downButton = document.createElement('button');
    downButton.type = 'button';
    downButton.textContent = '↓ Move point';
    downButton.addEventListener('click', () => moveRow(row, 1));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'danger-button';
    removeButton.textContent = 'Remove point';
    removeButton.addEventListener('click', () => row.remove());

    header.append(upButton, downButton, removeButton);

    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Title';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'tos-point-title';
    titleInput.value = (point && point.title) || '';

    const bodyLabel = document.createElement('label');
    bodyLabel.textContent = 'Body';
    const bodyTextarea = document.createElement('textarea');
    bodyTextarea.className = 'tos-point-body';
    bodyTextarea.rows = 2;
    bodyTextarea.value = (point && point.body) || '';

    const bulletsLabel = document.createElement('label');
    bulletsLabel.textContent = 'Bullets';
    const bulletsContainer = document.createElement('div');
    bulletsContainer.className = 'tos-bullet-rows';
    ((point && point.bullets) || []).forEach((bullet) => renderTosBulletRow(bulletsContainer, bullet));

    const addBulletButton = document.createElement('button');
    addBulletButton.type = 'button';
    addBulletButton.textContent = 'Add bullet';
    addBulletButton.addEventListener('click', () => renderTosBulletRow(bulletsContainer, null));

    row.append(header, titleLabel, titleInput, bodyLabel, bodyTextarea, bulletsLabel, bulletsContainer, addBulletButton);
    container.appendChild(row);
}

document.getElementById('tos-add-point').addEventListener('click', () => renderTosPointRow(null));

function collectTosPoints() {
    return Array.from(document.querySelectorAll('#tos-points-rows > .tos-point-row'))
        .map((row) => {
            const bullets = Array.from(row.querySelectorAll('.tos-bullet-row'))
                .map((bulletRow) => {
                    const type = bulletRow.querySelector('.tos-bullet-type').value;
                    const text = bulletRow.querySelector('.tos-bullet-text').value.trim();
                    const bullet = { type, text };
                    if (type === 'yesno') bullet.value = bulletRow.querySelector('.tos-bullet-value').checked;
                    return bullet;
                })
                .filter((bullet) => bullet.text);

            return {
                title: row.querySelector('.tos-point-title').value.trim(),
                body: row.querySelector('.tos-point-body').value.trim(),
                bullets,
            };
        })
        .filter((point) => point.title);
}

fetch('/data/tos.json')
    .then((r) => r.json())
    .then((d) => {
        (d.points || []).forEach((point) => renderTosPointRow(point));
    })
    .catch((error) => {
        console.error('Failed to load current TOS data:', error);
        setStatus('tos-status', 'Could not load current TOS data — reload before editing.', true);
        document.querySelector('#tos-form button[type="submit"]').disabled = true;
    });

document.getElementById('tos-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    setStatus('tos-status', 'Saving...', false);
    try {
        const response = await fetch('/api/publish-tos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points: collectTosPoints() }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('tos-status', 'Saved — live shortly', false);
    } catch (error) {
        setStatus('tos-status', error.message, true);
    }
});

let currentQueueColumns = [];
let currentQueueCards = [];

function renderQueueColumns() {
    const container = document.getElementById('queue-columns-rows');
    container.innerHTML = '';
    currentQueueColumns.forEach((column) => {
        const row = document.createElement('div');
        row.className = 'image-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = column.name;
        nameInput.addEventListener('input', () => {
            column.name = nameInput.value;
        });

        const enabledLabel = document.createElement('label');
        const enabledCheckbox = document.createElement('input');
        enabledCheckbox.type = 'checkbox';
        enabledCheckbox.checked = column.enabled;
        enabledCheckbox.addEventListener('change', () => {
            column.enabled = enabledCheckbox.checked;
        });
        enabledLabel.append(enabledCheckbox, document.createTextNode(' Visible'));

        row.append(nameInput, enabledLabel);
        container.appendChild(row);
    });
}

function moveQueueCardWithinColumn(card, direction) {
    const sameColumn = currentQueueCards.filter((c) => c.columnId === card.columnId);
    const posInColumn = sameColumn.indexOf(card);
    const targetPos = posInColumn + direction;
    if (targetPos < 0 || targetPos >= sameColumn.length) return;

    const neighbor = sameColumn[targetPos];
    const cardIndex = currentQueueCards.indexOf(card);
    const neighborIndex = currentQueueCards.indexOf(neighbor);
    [currentQueueCards[cardIndex], currentQueueCards[neighborIndex]] = [
        currentQueueCards[neighborIndex],
        currentQueueCards[cardIndex],
    ];
    renderQueueCards();
}

function renderQueueCards() {
    const container = document.getElementById('queue-cards-list');
    container.innerHTML = '';

    currentQueueCards.forEach((card) => {
        const row = document.createElement('div');
        row.className = 'past-work-list-row';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = card.title;
        titleInput.addEventListener('input', () => {
            card.title = titleInput.value;
        });

        const forInput = document.createElement('input');
        forInput.type = 'text';
        forInput.placeholder = 'For';
        forInput.value = card.for || '';
        forInput.addEventListener('input', () => {
            card.for = forInput.value;
        });

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = card.targetDate || '';
        dateInput.addEventListener('input', () => {
            card.targetDate = dateInput.value;
        });

        const columnSelect = document.createElement('select');
        currentQueueColumns.forEach((column) => {
            const option = document.createElement('option');
            option.value = column.id;
            option.textContent = column.enabled ? column.name : `${column.name} (hidden)`;
            columnSelect.appendChild(option);
        });
        columnSelect.value = card.columnId;
        columnSelect.addEventListener('change', () => {
            card.columnId = columnSelect.value;
            renderQueueCards();
        });

        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.textContent = '↑';
        upButton.addEventListener('click', () => moveQueueCardWithinColumn(card, -1));

        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.textContent = '↓';
        downButton.addEventListener('click', () => moveQueueCardWithinColumn(card, 1));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'danger-button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            currentQueueCards = currentQueueCards.filter((c) => c !== card);
            renderQueueCards();
        });

        row.append(titleInput, forInput, dateInput, columnSelect, upButton, downButton, deleteButton);
        container.appendChild(row);
    });
}

fetch('/data/queue.json')
    .then((r) => r.json())
    .then((d) => {
        currentQueueColumns = d.columns || [];
        currentQueueCards = d.cards || [];
        renderQueueColumns();
        renderQueueCards();
    })
    .catch((error) => {
        console.error('Failed to load current queue data:', error);
        setStatus('queue-status', 'Could not load current queue data — reload before editing.', true);
        document.getElementById('queue-save').disabled = true;
    });

document.getElementById('queue-card-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const titleInput = document.getElementById('queue-card-title');
    const forInput = document.getElementById('queue-card-for');
    const dateInput = document.getElementById('queue-card-target-date');

    currentQueueCards.push({
        id: crypto.randomUUID(),
        columnId: (currentQueueColumns[0] || {}).id,
        title: titleInput.value,
        for: forInput.value,
        targetDate: dateInput.value,
        createdAt: new Date().toISOString(),
    });
    renderQueueCards();
    event.target.reset();
});

document.getElementById('queue-save').addEventListener('click', async () => {
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    setStatus('queue-status', 'Saving...', false);
    try {
        const response = await fetch('/api/publish-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columns: currentQueueColumns, cards: currentQueueCards }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('queue-status', 'Saved — live shortly', false);
    } catch (error) {
        setStatus('queue-status', error.message, true);
    }
});

document.getElementById('past-work-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const file = document.getElementById('past-work-image').files[0];
    const meta = {
        type: 'past-work',
        action: 'add',
        caption: document.getElementById('past-work-caption').value,
        nsfw: document.getElementById('past-work-nsfw').checked,
        giftArt: document.getElementById('past-work-gift-art').checked,
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    formData.append('image', file);

    setStatus('past-work-status', 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('past-work-status', 'Published — live shortly', false);
        event.target.reset();
        currentPastWork.push(result.entry);
        savedPastWorkOrder.push(result.entry.url);
        renderPastWorkList();
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
});
