import { useEffect, useState } from 'react';
import { CONFIRM_MESSAGE } from './constants.js';

function emptyTier() {
    return { name: '', price: '', description: '', example: '', newFile: null };
}

export default function AdminCommissionsInfo() {
    const [status, setStatus] = useState(true);
    const [intro, setIntro] = useState('');
    const [specialOffer, setSpecialOffer] = useState('');
    const [tiers, setTiers] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then((d) => {
                setStatus(Boolean(d.status));
                setIntro(d.intro || '');
                setSpecialOffer(d.specialOffer || '');
                setTiers((d.tiers || []).map((t) => ({ ...t, newFile: null })));
            })
            .catch((error) => {
                console.error('Failed to load current commissions data:', error);
                setLoadError(true);
                setSaveStatus({ message: 'Could not load current commission data — reload before saving.', isError: true });
            });
    }, []);

    function updateTier(index, patch) {
        setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;

        const cleanedTiers = [];
        const tierFiles = [];
        tiers.forEach((tier) => {
            const name = (tier.name || '').trim();
            const price = (tier.price || '').trim();
            const description = (tier.description || '').trim();
            const existingExample = tier.example || '';
            if (!name && !price && !description && !existingExample && !tier.newFile) return;
            cleanedTiers.push({ name, price, description, example: existingExample });
            tierFiles.push(tier.newFile || new File([], 'unchanged'));
        });

        const meta = { type: 'info', status, intro, specialOffer, tiers: cleanedTiers };
        const formData = new FormData();
        formData.append('meta', JSON.stringify(meta));
        tierFiles.forEach((file) => formData.append('tierImages', file));

        setSaveStatus({ message: 'Saving...', isError: false });
        try {
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setSaveStatus({ message: 'Saved — live shortly', isError: false });
            setTiers((result.tiers || []).map((t) => ({ ...t, newFile: null })));
        } catch (error) {
            setSaveStatus({ message: error.message, isError: true });
        }
    }

    return (
        <section className="admin-panel">
            <h2>Commission Info</h2>
            <form onSubmit={handleSubmit}>
                <label><input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)} /> Commissions open</label>

                <label htmlFor="comm-intro">Intro text</label>
                <textarea id="comm-intro" rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />

                <label htmlFor="comm-special-offer">Special offer (e.g. PWYW) — leave blank if none</label>
                <input type="text" id="comm-special-offer" value={specialOffer} onChange={(e) => setSpecialOffer(e.target.value)} />

                <label>Tiers</label>
                <div id="comm-tiers-rows">
                    {tiers.map((tier, i) => (
                        <div className="tier-row" key={i}>
                            <input type="text" placeholder="Tier name" value={tier.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
                            <input type="text" placeholder="Price (e.g. $20)" value={tier.price} onChange={(e) => updateTier(i, { price: e.target.value })} />
                            <textarea rows={2} placeholder="Description" value={tier.description} onChange={(e) => updateTier(i, { description: e.target.value })} />
                            <label>{tier.example ? 'Replace example image (optional)' : 'Example image (optional)'}</label>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => updateTier(i, { newFile: e.target.files[0] || null })} />
                            <button type="button" onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}>Remove tier</button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={() => setTiers((prev) => [...prev, emptyTier()])}>Add tier</button>

                <button type="submit" disabled={loadError}>Save Commission Info</button>
                <p className={`admin-status ${saveStatus.isError ? 'error' : 'success'}`}>{saveStatus.message}</p>
            </form>
        </section>
    );
}
