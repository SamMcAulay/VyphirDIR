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
        label.textContent = file.name;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.nsfwIndex = String(i);

        row.append(checkbox, label);
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

        row.append(thumb, keepLabel, nsfwLabel);
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

        const firstImage = (character.images || [])[0];
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
    .catch((error) => console.error('Failed to load current characters:', error));

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

fetch('/data/commissions.json')
    .then((r) => r.json())
    .then((d) => {
        document.getElementById('comm-status').checked = Boolean(d.status);
        document.getElementById('comm-intro').value = d.intro || '';
        document.getElementById('comm-special-offer').value = d.specialOffer || '';
        (d.tiers || []).forEach((tier) => renderTierRow(tier));
    })
    .catch((error) => console.error('Failed to load current commissions data:', error));

document.getElementById('character-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const files = document.getElementById('char-images').files;
    const nsfwFlags = Array.from(document.querySelectorAll('#char-nsfw-rows [data-nsfw-index]')).map((cb) => cb.checked);
    const existingImages = Array.from(document.querySelectorAll('#char-existing-images .existing-image-row'))
        .filter((row) => row.querySelector('.existing-image-keep').checked)
        .map((row) => ({
            url: row.dataset.url,
            nsfw: row.querySelector('.existing-image-nsfw').checked,
        }));

    const meta = {
        name: document.getElementById('char-name').value,
        species: document.getElementById('char-species').value,
        bio: document.getElementById('char-bio').value,
        nsfwFlags,
        existingImages,
    };
    if (editingSlug) meta.slug = editingSlug;

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    Array.from(files).forEach((file) => formData.append('images', file));

    setStatus('character-status', editingSlug ? 'Saving...' : 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('character-status', `Published — live shortly at /gallery/${result.slug}/`, false);

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
        tierFiles.push(newFile || new File([], ''));
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

document.getElementById('past-work-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const file = document.getElementById('past-work-image').files[0];
    const meta = {
        type: 'past-work',
        caption: document.getElementById('past-work-caption').value,
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
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
});
