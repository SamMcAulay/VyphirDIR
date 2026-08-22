function formatTargetDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelativeAge(isoString) {
    if (!isoString) return '';
    const created = new Date(isoString);
    if (Number.isNaN(created.getTime())) return '';
    const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'added today';
    if (days === 1) return 'added 1 day ago';
    if (days < 14) return `added ${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 8) return `added ${weeks} week${weeks === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `added ${months} month${months === 1 ? '' : 's'} ago`;
}

function renderCard(card) {
    const el = document.createElement('div');
    el.className = 'queue-card tier-card';

    const title = document.createElement('h4');
    title.textContent = card.title || '';
    el.appendChild(title);

    if (card.for) {
        const forLine = document.createElement('p');
        forLine.className = 'queue-card-for';
        forLine.textContent = `For: ${card.for}`;
        el.appendChild(forLine);
    }

    const targetLabel = formatTargetDate(card.targetDate);
    if (targetLabel) {
        const targetLine = document.createElement('p');
        targetLine.className = 'queue-card-target';
        targetLine.textContent = `Target: ${targetLabel}`;
        el.appendChild(targetLine);
    }

    const ageLabel = formatRelativeAge(card.createdAt);
    if (ageLabel) {
        const ageLine = document.createElement('p');
        ageLine.className = 'queue-card-age';
        ageLine.textContent = ageLabel;
        el.appendChild(ageLine);
    }

    return el;
}

function renderColumn(column, cards) {
    const el = document.createElement('div');
    el.className = 'queue-column';

    const heading = document.createElement('h3');
    heading.textContent = column.name;
    el.appendChild(heading);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'queue-column-cards';
    cards.forEach((card) => cardsContainer.appendChild(renderCard(card)));
    el.appendChild(cardsContainer);

    return el;
}

async function loadQueue() {
    const container = document.getElementById('queue-board');
    if (!container) return;

    try {
        const response = await fetch('/data/queue.json');
        const data = await response.json();
        const enabledColumns = (data.columns || []).filter((column) => column.enabled);

        if (enabledColumns.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> QUEUE IS CURRENTLY EMPTY';
            container.appendChild(empty);
            return;
        }

        const board = document.createElement('div');
        board.className = 'queue-board-columns';
        enabledColumns.forEach((column) => {
            const cardsInColumn = (data.cards || []).filter((card) => card.columnId === column.id);
            board.appendChild(renderColumn(column, cardsInColumn));
        });
        container.appendChild(board);
    } catch (error) {
        console.error(error);
        const errorMsg = document.createElement('p');
        errorMsg.className = 'feed-error';
        errorMsg.textContent = '> DATA UNAVAILABLE.';
        container.appendChild(errorMsg);
    }
}

export function init() {
    return loadQueue();
}
