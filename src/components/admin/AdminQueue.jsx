import { useEffect, useState } from 'react';
import { CONFIRM_MESSAGE } from './constants.js';

export default function AdminQueue() {
    const [columns, setColumns] = useState([]);
    const [cards, setCards] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [status, setStatus] = useState({ message: '', isError: false });
    const [title, setTitle] = useState('');
    const [forWhom, setForWhom] = useState('');
    const [targetDate, setTargetDate] = useState('');

    useEffect(() => {
        fetch('/data/queue.json')
            .then((r) => r.json())
            .then((d) => {
                setColumns(d.columns || []);
                setCards(d.cards || []);
            })
            .catch((error) => {
                console.error('Failed to load current queue data:', error);
                setLoadError(true);
                setStatus({ message: 'Could not load current queue data — reload before editing.', isError: true });
            });
    }, []);

    function updateColumn(id, patch) {
        setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    }

    function moveCardWithinColumn(card, direction) {
        const sameColumn = cards.filter((c) => c.columnId === card.columnId);
        const posInColumn = sameColumn.indexOf(card);
        const targetPos = posInColumn + direction;
        if (targetPos < 0 || targetPos >= sameColumn.length) return;
        const neighbor = sameColumn[targetPos];
        const cardIndex = cards.indexOf(card);
        const neighborIndex = cards.indexOf(neighbor);
        setCards((prev) => {
            const copy = [...prev];
            [copy[cardIndex], copy[neighborIndex]] = [copy[neighborIndex], copy[cardIndex]];
            return copy;
        });
    }

    function updateCard(id, patch) {
        setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    }

    function addCard(e) {
        e.preventDefault();
        setCards((prev) => [
            ...prev,
            { id: crypto.randomUUID(), columnId: (columns[0] || {}).id, title, for: forWhom, targetDate, createdAt: new Date().toISOString() },
        ]);
        setTitle('');
        setForWhom('');
        setTargetDate('');
    }

    async function saveQueue() {
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        setStatus({ message: 'Saving...', isError: false });
        try {
            const response = await fetch('/api/publish-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columns, cards }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setStatus({ message: 'Saved — live shortly', isError: false });
        } catch (error) {
            setStatus({ message: error.message, isError: true });
        }
    }

    return (
        <>
            <section className="admin-panel">
                <h2>Queue Columns</h2>
                <div id="queue-columns-rows">
                    {columns.map((column) => (
                        <div className="image-row" key={column.id}>
                            <input type="text" value={column.name} onChange={(e) => updateColumn(column.id, { name: e.target.value })} />
                            <label><input type="checkbox" checked={column.enabled} onChange={(e) => updateColumn(column.id, { enabled: e.target.checked })} /> Visible</label>
                        </div>
                    ))}
                </div>
            </section>

            <section className="admin-panel">
                <h2>Queue Cards</h2>
                <div id="queue-cards-list">
                    {cards.map((card) => (
                        <div className="past-work-list-row" key={card.id}>
                            <input type="text" value={card.title} onChange={(e) => updateCard(card.id, { title: e.target.value })} />
                            <input type="text" placeholder="For" value={card.for || ''} onChange={(e) => updateCard(card.id, { for: e.target.value })} />
                            <input type="date" value={card.targetDate || ''} onChange={(e) => updateCard(card.id, { targetDate: e.target.value })} />
                            <select value={card.columnId} onChange={(e) => updateCard(card.id, { columnId: e.target.value })}>
                                {columns.map((column) => (
                                    <option value={column.id} key={column.id}>{column.enabled ? column.name : `${column.name} (hidden)`}</option>
                                ))}
                            </select>
                            <button type="button" onClick={() => moveCardWithinColumn(card, -1)}>↑</button>
                            <button type="button" onClick={() => moveCardWithinColumn(card, 1)}>↓</button>
                            <button type="button" className="danger-button" onClick={() => setCards((prev) => prev.filter((c) => c.id !== card.id))}>Delete</button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="admin-panel">
                <h2>Add Queue Card</h2>
                <form onSubmit={addCard}>
                    <label htmlFor="queue-card-title">Title</label>
                    <input type="text" id="queue-card-title" required value={title} onChange={(e) => setTitle(e.target.value)} />

                    <label htmlFor="queue-card-for">For</label>
                    <input type="text" id="queue-card-for" placeholder="@handle or name" value={forWhom} onChange={(e) => setForWhom(e.target.value)} />

                    <label htmlFor="queue-card-target-date">Target date (optional)</label>
                    <input type="date" id="queue-card-target-date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />

                    <button type="submit">Add Card</button>
                </form>
                <button type="button" id="queue-save" disabled={loadError} onClick={saveQueue}>Save Queue</button>
                <p className={`admin-status ${status.isError ? 'error' : 'success'}`}>{status.message}</p>
            </section>
        </>
    );
}
