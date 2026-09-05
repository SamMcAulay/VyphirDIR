import { useEffect, useState } from 'react';
import { formatDate } from '../../shared/format-date.js';

function formatTargetDate(dateStr) {
    if (!dateStr) return '';
    return formatDate(`${dateStr}T00:00:00`);
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

function Card({ card }) {
    const targetLabel = formatTargetDate(card.targetDate);
    const ageLabel = formatRelativeAge(card.createdAt);
    return (
        <div className="queue-card tier-card">
            <h4>{card.title || ''}</h4>
            {card.for && <p className="queue-card-for">For: {card.for}</p>}
            {targetLabel && <p className="queue-card-target">Target: {targetLabel}</p>}
            {ageLabel && <p className="queue-card-age">{ageLabel}</p>}
        </div>
    );
}

function Column({ column, cards }) {
    return (
        <div className="queue-column">
            <h3>{column.name}</h3>
            <div className="queue-column-cards">
                {cards.map((card) => <Card card={card} key={card.id} />)}
            </div>
        </div>
    );
}

export default function QueueBoard() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch('/data/queue.json')
            .then((r) => r.json())
            .then(setData)
            .catch((err) => {
                console.error(err);
                setError(true);
            });
    }, []);

    if (error) return <p className="feed-error">&gt; DATA UNAVAILABLE.</p>;
    if (data === null) return null;

    const enabledColumns = (data.columns || []).filter((c) => c.enabled);
    if (enabledColumns.length === 0) return <p className="gallery-empty">&gt; QUEUE IS CURRENTLY EMPTY</p>;

    return (
        <div className="queue-board-columns">
            {enabledColumns.map((column) => (
                <Column column={column} cards={(data.cards || []).filter((c) => c.columnId === column.id)} key={column.id} />
            ))}
        </div>
    );
}
