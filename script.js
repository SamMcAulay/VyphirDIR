function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

let autoScrollCleanup = null;
let initGeneration = 0;

function setupAutoScroll(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

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
    container.addEventListener('touchstart', stopScroll, {passive: true});
    container.addEventListener('touchend', startScroll, {passive: true});

    autoScrollCleanup = () => {
        stopScroll();
        container.removeEventListener('mouseenter', stopScroll);
        container.removeEventListener('mouseleave', startScroll);
        container.removeEventListener('touchstart', stopScroll);
        container.removeEventListener('touchend', startScroll);
    };
}

async function loadCharacterGallery(generation) {
    const galleryDiv = document.getElementById('character-gallery');
    if (!galleryDiv) return;

    try {
        const response = await fetch('/data/characters.json');
        const data = await response.json();
        const characters = data.characters || [];

        if (characters.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> NO CHARACTERS ARCHIVED YET';
            galleryDiv.appendChild(empty);
            return;
        }

        shuffleArray(characters);

        characters.forEach((char) => {
            const images = char.images || [];
            const firstImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);
            if (!firstImage) return;

            const card = document.createElement('a');
            card.className = 'gallery-card';
            card.href = `/gallery/${char.slug}/`;

            const img = document.createElement('img');
            img.src = firstImage.url;
            img.alt = char.name;
            img.loading = 'lazy';

            const caption = document.createElement('p');
            caption.textContent = char.name;

            card.append(img, caption);
            galleryDiv.appendChild(card);
        });

        if (generation !== initGeneration) return; // a newer init() has since started; this response is stale, don't touch shared state
        setupAutoScroll('character-gallery');
    } catch (error) {
        console.error(error);
    }
}

async function loadCommissionsPreview() {
    const container = document.getElementById('commissions-preview');
    if (!container) return;

    try {
        const response = await fetch('/data/commissions.json');
        const data = await response.json();
        const recentPastWork = (data.pastWork || []).filter((item) => !item.nsfw).slice(-3).reverse();

        if (recentPastWork.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> NO PAST WORK YET';
            container.appendChild(empty);
            return;
        }

        recentPastWork.forEach((item) => {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.caption || '';
            img.loading = 'lazy';
            container.appendChild(img);
        });
    } catch (error) {
        console.error(error);
    }
}

const bskyHandle = 'samisaderp.bsky.social';

async function loadBlueskyFeed() {
    const feedContainer = document.getElementById('bsky-feed');
    if (!feedContainer) return;

    try {
        const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${bskyHandle}&limit=3`);
        const data = await response.json();

        feedContainer.innerHTML = '';

        data.feed.forEach(item => {
            const post = item.post?.record;
            if (!post) return;
            const date = new Date(post.createdAt).toLocaleDateString();

            const entry = document.createElement('div');
            entry.className = 'feed-entry';

            const header = document.createElement('div');
            header.className = 'feed-entry-header';

            const handle = document.createElement('span');
            handle.className = 'feed-handle';
            handle.textContent = `@${bskyHandle}`;

            const dateSpan = document.createElement('span');
            dateSpan.className = 'feed-date';
            dateSpan.textContent = date;

            header.append(handle, dateSpan);

            const text = document.createElement('p');
            text.className = 'feed-text';
            text.textContent = post.text;

            entry.append(header, text);
            feedContainer.appendChild(entry);
        });

    } catch (error) {
        console.error(error);
        const errorMsg = document.createElement('p');
        errorMsg.className = 'feed-error';
        errorMsg.textContent = '> UPLINK FAILED.';
        feedContainer.innerHTML = '';
        feedContainer.appendChild(errorMsg);
    }
}

export function init() {
    initGeneration += 1;
    const generation = initGeneration;
    autoScrollCleanup = null;
    loadCharacterGallery(generation);
    loadCommissionsPreview();
    loadBlueskyFeed();
}

export function cleanup() {
    if (autoScrollCleanup) {
        autoScrollCleanup();
        autoScrollCleanup = null;
    }
}
