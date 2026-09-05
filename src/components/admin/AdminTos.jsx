import { useEffect, useState } from 'react';

const CONFIRM_MESSAGE = 'This will be published live and permanently recorded in git history. Continue?';

function emptyBullet() {
    return { type: 'plain', text: '', value: false };
}
function emptyPoint() {
    return { title: '', body: '', bullets: [] };
}
function swap(array, i, j) {
    const copy = [...array];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
}

export default function AdminTos() {
    const [points, setPoints] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [status, setStatus] = useState({ message: '', isError: false });

    useEffect(() => {
        fetch('/data/tos.json')
            .then((r) => r.json())
            .then((d) => setPoints((d.points || []).map((p) => ({ ...p, bullets: p.bullets || [] }))))
            .catch((error) => {
                console.error('Failed to load current TOS data:', error);
                setLoadError(true);
                setStatus({ message: 'Could not load current TOS data — reload before editing.', isError: true });
            });
    }, []);

    function updatePoint(pi, patch) {
        setPoints((prev) => prev.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
    }
    function movePoint(pi, direction) {
        const target = pi + direction;
        if (target < 0 || target >= points.length) return;
        setPoints((prev) => swap(prev, pi, target));
    }
    function updateBullet(pi, bi, patch) {
        setPoints((prev) => prev.map((p, i) => (i !== pi ? p : { ...p, bullets: p.bullets.map((b, j) => (j === bi ? { ...b, ...patch } : b)) })));
    }
    function moveBullet(pi, bi, direction) {
        const point = points[pi];
        const target = bi + direction;
        if (target < 0 || target >= point.bullets.length) return;
        updatePoint(pi, { bullets: swap(point.bullets, bi, target) });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;

        const cleaned = points
            .map((p) => ({
                title: (p.title || '').trim(),
                body: (p.body || '').trim(),
                bullets: p.bullets
                    .map((b) => (b.type === 'yesno' ? { type: 'yesno', text: (b.text || '').trim(), value: Boolean(b.value) } : { type: 'plain', text: (b.text || '').trim() }))
                    .filter((b) => b.text),
            }))
            .filter((p) => p.title);

        setStatus({ message: 'Saving...', isError: false });
        try {
            const response = await fetch('/api/publish-tos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: cleaned }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setStatus({ message: 'Saved — live shortly', isError: false });
        } catch (error) {
            setStatus({ message: error.message, isError: true });
        }
    }

    return (
        <section className="admin-panel">
            <h2>Terms of Service</h2>
            <form onSubmit={handleSubmit}>
                <div id="tos-points-rows">
                    {points.map((point, pi) => (
                        <div className="tos-point-row" key={pi}>
                            <div className="tos-point-row-header">
                                <button type="button" onClick={() => movePoint(pi, -1)}>↑ Move point</button>
                                <button type="button" onClick={() => movePoint(pi, 1)}>↓ Move point</button>
                                <button type="button" className="danger-button" onClick={() => setPoints((prev) => prev.filter((_, i) => i !== pi))}>Remove point</button>
                            </div>
                            <label>Title</label>
                            <input type="text" className="tos-point-title" value={point.title} onChange={(e) => updatePoint(pi, { title: e.target.value })} />
                            <label>Body</label>
                            <textarea className="tos-point-body" rows={2} value={point.body} onChange={(e) => updatePoint(pi, { body: e.target.value })} />
                            <label>Bullets</label>
                            <div className="tos-bullet-rows">
                                {point.bullets.map((bullet, bi) => (
                                    <div className="tos-bullet-row" key={bi}>
                                        <select className="tos-bullet-type" value={bullet.type} onChange={(e) => updateBullet(pi, bi, { type: e.target.value })}>
                                            <option value="plain">Plain</option>
                                            <option value="yesno">Yes / No</option>
                                        </select>
                                        <input type="text" className="tos-bullet-text" placeholder="Bullet text" value={bullet.text} onChange={(e) => updateBullet(pi, bi, { text: e.target.value })} />
                                        <label className={`tos-bullet-yesno-value${bullet.type === 'yesno' ? '' : ' hidden'}`}>
                                            <input type="checkbox" className="tos-bullet-value" checked={Boolean(bullet.value)} onChange={(e) => updateBullet(pi, bi, { value: e.target.checked })} /> Yes (unchecked = No)
                                        </label>
                                        <button type="button" onClick={() => moveBullet(pi, bi, -1)}>↑</button>
                                        <button type="button" onClick={() => moveBullet(pi, bi, 1)}>↓</button>
                                        <button type="button" className="danger-button" onClick={() => updatePoint(pi, { bullets: point.bullets.filter((_, i) => i !== bi) })}>Remove</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={() => updatePoint(pi, { bullets: [...point.bullets, emptyBullet()] })}>Add bullet</button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={() => setPoints((prev) => [...prev, emptyPoint()])}>Add point</button>
                <button type="submit" disabled={loadError}>Save TOS</button>
                <p className={`admin-status ${status.isError ? 'error' : 'success'}`}>{status.message}</p>
            </form>
        </section>
    );
}
