function renderTier(tier) {
    const card = document.createElement('div');
    card.className = 'tier-card';

    if (tier.example) {
        const img = document.createElement('img');
        img.src = tier.example;
        img.alt = tier.name;
        card.appendChild(img);
    }

    const heading = document.createElement('h3');
    heading.textContent = tier.name;
    const price = document.createElement('span');
    price.className = 'tier-price';
    price.textContent = tier.price ? ` — ${tier.price}` : '';
    heading.appendChild(price);

    const description = document.createElement('p');
    description.textContent = tier.description || '';

    card.append(heading, description);
    return card;
}

function renderPastWork(item) {
    const card = document.createElement('div');
    card.className = 'past-work-card';

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.caption || 'Past commission work';
    card.appendChild(img);

    if (item.caption) {
        const caption = document.createElement('p');
        caption.textContent = item.caption;
        card.appendChild(caption);
    }

    return card;
}

async function loadCommissions() {
    try {
        const response = await fetch('/data/commissions.json');
        const data = await response.json();

        const statusEl = document.getElementById('commission-status');
        statusEl.textContent = data.status ? 'COMMISSIONS OPEN' : 'COMMISSIONS CLOSED';
        statusEl.className = `commission-status ${data.status ? 'open' : 'closed'}`;

        const offerEl = document.getElementById('commission-special-offer');
        if (data.specialOffer) {
            offerEl.textContent = data.specialOffer;
            offerEl.className = 'commission-special-offer';
        }

        document.getElementById('commission-intro').textContent = data.intro || '';

        const tiersEl = document.getElementById('commission-tiers');
        (data.tiers || []).forEach((tier) => tiersEl.appendChild(renderTier(tier)));

        const pastWorkEl = document.getElementById('commission-past-work');
        (data.pastWork || []).forEach((item) => pastWorkEl.appendChild(renderPastWork(item)));
    } catch (error) {
        console.error(error);
        const intro = document.getElementById('commission-intro');
        intro.textContent = '> DATA UNAVAILABLE.';
        intro.className = 'feed-error';
    }
}

document.addEventListener('DOMContentLoaded', loadCommissions);
