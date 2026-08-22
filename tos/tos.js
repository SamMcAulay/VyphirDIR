function renderBullet(bullet) {
    const li = document.createElement('li');

    if (bullet.type === 'yesno') {
        li.className = bullet.value ? 'tos-bullet-yesno tos-bullet-yes' : 'tos-bullet-yesno tos-bullet-no';
        const icon = document.createElement('i');
        icon.className = bullet.value ? 'fa-solid fa-check' : 'fa-solid fa-xmark';
        li.append(icon, document.createTextNode(` ${bullet.text || ''}`));
    } else {
        li.className = 'tos-bullet-plain';
        li.textContent = bullet.text || '';
    }

    return li;
}

function renderPoint(point, index) {
    const card = document.createElement('div');
    card.className = 'tos-point tier-card';

    const heading = document.createElement('h3');
    const number = document.createElement('span');
    number.className = 'tos-point-number';
    number.textContent = `${index + 1}. `;
    heading.append(number, document.createTextNode(point.title || ''));
    card.appendChild(heading);

    if (point.body) {
        const body = document.createElement('p');
        body.textContent = point.body;
        card.appendChild(body);
    }

    const bullets = point.bullets || [];
    if (bullets.length > 0) {
        const list = document.createElement('ul');
        list.className = 'tos-bullets';
        bullets.forEach((bullet) => list.appendChild(renderBullet(bullet)));
        card.appendChild(list);
    }

    return card;
}

async function loadTos() {
    const container = document.getElementById('tos-points');
    if (!container) return;

    try {
        const response = await fetch('/data/tos.json');
        const data = await response.json();
        const points = data.points || [];

        if (points.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> NO TERMS PUBLISHED YET';
            container.appendChild(empty);
            return;
        }

        points.forEach((point, index) => container.appendChild(renderPoint(point, index)));
    } catch (error) {
        console.error(error);
        const errorMsg = document.createElement('p');
        errorMsg.className = 'feed-error';
        errorMsg.textContent = '> DATA UNAVAILABLE.';
        container.appendChild(errorMsg);
    }
}

export function init() {
    return loadTos();
}
