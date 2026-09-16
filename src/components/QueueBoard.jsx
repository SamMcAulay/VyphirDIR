import { Fragment, useEffect, useState } from 'react';
import { formatDate } from '../../shared/format-date.js';
import { cx } from './cx.js';
import { LOAD_ERROR } from './messages.js';
import { queueEntries } from './queue-entries.js';

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

function metaLine(entry) {
    const target = formatTargetDate(entry.targetDate);
    return [entry.for && `For: ${entry.for}`, target && `target ${target}`, formatRelativeAge(entry.createdAt)]
        .filter(Boolean)
        .join(' · ');
}

function QueueCard({ entry, finished }) {
    const meta = metaLine(entry);
    return (
        <li className={cx('queue-card', finished && 'queue-card--finished')}>
            <h2 className="queue-card__title">{entry.title || 'Untitled'}</h2>
            {meta && <p className="queue-card__meta">{meta}</p>}
            <span className="queue-track" aria-hidden="true">
                {Array.from({ length: entry.stageCount }, (_, i) => (
                    <Fragment key={i}>
                        {i > 0 && <span className={cx('queue-track__bar', i <= entry.stageIndex && 'is-past')} />}
                        <span className={cx('queue-track__bead', i < entry.stageIndex && 'is-past', i === entry.stageIndex && 'is-current')} />
                    </Fragment>
                ))}
            </span>
            <p className="queue-card__stage">
                {finished ? entry.stageName : `${entry.stageName} · stage ${entry.stageIndex + 1} of ${entry.stageCount}`}
            </p>
        </li>
    );
}

export function QueueCards({ data }) {
    const { active, finished } = queueEntries(data);
    if (active.length === 0 && finished.length === 0) {
        return <p className="page-message">The queue is empty right now.</p>;
    }
    return (
        <div className="queue">
            {active.length > 0 && (
                <ul className="queue-list">
                    {active.map((entry) => <QueueCard entry={entry} key={entry.id} />)}
                </ul>
            )}
            {finished.length > 0 && (
                <>
                    <p className="queue-finished-label">Finished · {finished.length}</p>
                    <ul className="queue-list">
                        {finished.map((entry) => <QueueCard entry={entry} finished key={entry.id} />)}
                    </ul>
                </>
            )}
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

    if (error) return <p className="page-message">{LOAD_ERROR}</p>;
    if (data === null) return null;
    return <QueueCards data={data} />;
}
