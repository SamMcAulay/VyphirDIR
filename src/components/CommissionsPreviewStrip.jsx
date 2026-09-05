import { useEffect, useState } from 'react';

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export default function CommissionsPreviewStrip() {
    const [items, setItems] = useState(null);

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then((d) => {
                const candidates = (d.pastWork || []).slice(0, 9).filter((item) => !item.nsfw);
                setItems(shuffleArray(candidates).slice(0, 3));
            })
            .catch((error) => console.error(error));
    }, []);

    if (items === null) return <div className="commissions-preview-grid" id="commissions-preview" />;
    if (items.length === 0) return <div className="commissions-preview-grid" id="commissions-preview"><p className="gallery-empty">&gt; NO PAST WORK YET</p></div>;

    return (
        <div className="commissions-preview-grid" id="commissions-preview">
            {items.map((item, i) => (
                <img src={item.url} alt={item.caption || ''} loading="lazy" key={i} />
            ))}
        </div>
    );
}
