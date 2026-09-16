import { useEffect, useState } from 'react';
import { cx } from './cx.js';
import { LOAD_ERROR } from './messages.js';
import { splitTos } from './split-tos.js';
import { useCurrentSection } from '../hooks/useCurrentSection.js';

function DrawPanel({ variant, title, items }) {
    if (items.length === 0) return null;
    return (
        <section className={`tos-draw__panel tos-draw__panel--${variant}`}>
            <h2>{title}</h2>
            <ul>{items.map((text, i) => <li key={i}>{text}</li>)}</ul>
        </section>
    );
}

export function TosContent({ points: source }) {
    const { will, wont, points } = splitTos(source);
    const ids = points.map((_, i) => `tos-${i + 1}`);
    const current = useCurrentSection(ids);

    /*
     * Finding F5: a direct load of /tos/#tos-3 doesn't land on the point,
     * because the points only exist once this fetch-driven content has
     * rendered. Once it has, scroll the named point into view a single time
     * (instant, not smooth). Browser-only, so guarded and effect-scoped.
     */
    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        const id = window.location.hash.slice(1);
        if (!ids.includes(id)) return;
        const el = document.getElementById(id);
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'instant' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (points.length === 0) return <p className="page-message">No terms published yet.</p>;

    return (
        <div className="tos">
            <nav className="tos-index" aria-label="Terms">
                <ol className="tos-index__list">
                    {points.map((point, i) => (
                        <li key={ids[i]}>
                            <a
                                className={cx('tos-index__link', current === ids[i] && 'is-current')}
                                href={`#${ids[i]}`}
                                aria-current={current === ids[i] ? 'true' : undefined}
                            >
                                <span className="tos-num" aria-hidden="true">{i + 1}</span>{point.title || ''}
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>
            <div className="tos-body">
                {(will.length > 0 || wont.length > 0) && (
                    <div className="tos-draw">
                        <DrawPanel variant="will" title="Will draw" items={will} />
                        <DrawPanel variant="wont" title="Won't draw" items={wont} />
                    </div>
                )}
                {points.map((point, i) => (
                    <section className="tos-point" id={ids[i]} key={ids[i]}>
                        <h2 className="tos-point__title">
                            <span className="tos-num" aria-hidden="true">{i + 1}</span>{point.title || ''}
                        </h2>
                        {point.body && <p className="tos-point__body">{point.body}</p>}
                        {point.bullets.length > 0 && (
                            <ul className="tos-point__bullets">
                                {point.bullets.map((bullet, j) => <li key={j}>{bullet.text || ''}</li>)}
                            </ul>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}

export default function TosPointList() {
    const [points, setPoints] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch('/data/tos.json')
            .then((r) => r.json())
            .then((d) => setPoints(d.points || []))
            .catch((err) => {
                console.error(err);
                setError(true);
            });
    }, []);

    if (error) return <p className="page-message">{LOAD_ERROR}</p>;
    if (points === null) return null;
    return <TosContent points={points} />;
}
