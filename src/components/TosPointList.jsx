import { useEffect, useState } from 'react';

function Bullet({ bullet }) {
    if (bullet.type === 'yesno') {
        return (
            <li className={bullet.value ? 'tos-bullet-yesno tos-bullet-yes' : 'tos-bullet-yesno tos-bullet-no'}>
                <i className={bullet.value ? 'fa-solid fa-check' : 'fa-solid fa-xmark'} /> {bullet.text || ''}
            </li>
        );
    }
    return <li className="tos-bullet-plain">{bullet.text || ''}</li>;
}

function Point({ point, index }) {
    return (
        <div className="tos-point tier-card">
            <h3><span className="tos-point-number">{index + 1}. </span>{point.title || ''}</h3>
            {point.body && <p>{point.body}</p>}
            {(point.bullets || []).length > 0 && (
                <ul className="tos-bullets">
                    {point.bullets.map((bullet, i) => <Bullet bullet={bullet} key={i} />)}
                </ul>
            )}
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

    if (error) return <p className="feed-error">&gt; DATA UNAVAILABLE.</p>;
    if (points === null) return null;
    if (points.length === 0) return <p className="gallery-empty">&gt; NO TERMS PUBLISHED YET</p>;

    return <>{points.map((point, i) => <Point point={point} index={i} key={i} />)}</>;
}
