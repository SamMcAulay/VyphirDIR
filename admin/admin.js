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

document.getElementById('character-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const files = document.getElementById('char-images').files;
    const nsfwFlags = Array.from(document.querySelectorAll('[data-nsfw-index]')).map((cb) => cb.checked);

    const meta = {
        name: document.getElementById('char-name').value,
        species: document.getElementById('char-species').value,
        bio: document.getElementById('char-bio').value,
        nsfwFlags,
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    Array.from(files).forEach((file) => formData.append('images', file));

    setStatus('character-status', 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('character-status', `Published — live shortly at /gallery/${result.slug}/`, false);
        event.target.reset();
        document.getElementById('char-nsfw-rows').innerHTML = '';
    } catch (error) {
        setStatus('character-status', error.message, true);
    }
});

document.getElementById('commissions-info-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const meta = {
        type: 'info',
        status: document.getElementById('comm-status').checked,
        intro: document.getElementById('comm-intro').value,
        specialOffer: document.getElementById('comm-special-offer').value,
        tiers: [],
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));

    setStatus('commissions-info-status', 'Saving...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('commissions-info-status', 'Saved — live shortly', false);
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
