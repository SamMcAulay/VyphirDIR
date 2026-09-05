import { useState } from 'react';
import { CONFIRM_MESSAGE } from './constants.js';

const LOAD_ERROR_MESSAGE = 'Could not load current commissions data — reload before editing.';

function isOrderDirty(pastWork, savedOrder) {
    if (pastWork.length !== savedOrder.length) return true;
    return pastWork.some((entry, i) => entry.url !== savedOrder[i]);
}

export default function AdminPastWork({ pastWork, setPastWork, savedOrder, setSavedOrder, loadError }) {
    const [orderStatus, setOrderStatus] = useState({ message: '', isError: false });
    const [itemStatus, setItemStatus] = useState({ message: '', isError: false });
    const [caption, setCaption] = useState('');
    const [nsfw, setNsfw] = useState(false);
    const [giftArt, setGiftArt] = useState(false);
    const [file, setFile] = useState(null);

    function move(entry, direction) {
        const index = pastWork.findIndex((e) => e.url === entry.url);
        const targetIndex = index + direction;
        if (index === -1 || targetIndex < 0 || targetIndex >= pastWork.length) return;
        const reordered = [...pastWork];
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
        setPastWork(reordered);
    }

    async function saveOrder() {
        if (!isOrderDirty(pastWork, savedOrder)) return;
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'reorder', order: pastWork.map((e) => e.url) }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setSavedOrder(pastWork.map((e) => e.url));
            setOrderStatus({ message: 'Order saved — live shortly', isError: false });
        } catch (error) {
            setOrderStatus({ message: error.message, isError: true });
        }
    }

    async function toggleField(entry, field, newValue) {
        if (!window.confirm(CONFIRM_MESSAGE)) return false;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'edit', url: entry.url, caption: entry.caption, [field]: newValue }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setPastWork((prev) => prev.map((e) => (e.url === entry.url ? { ...e, [field]: newValue } : e)));
            setItemStatus({ message: 'Updated — live shortly', isError: false });
            return true;
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
            return false;
        }
    }

    async function editCaption(entry) {
        const newCaption = window.prompt('Edit caption:', entry.caption || '');
        if (newCaption === null) return;
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'edit', url: entry.url, caption: newCaption }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setPastWork((prev) => prev.map((e) => (e.url === entry.url ? { ...e, caption: newCaption } : e)));
            setItemStatus({ message: 'Caption updated — live shortly', isError: false });
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
        }
    }

    async function deleteEntry(entry) {
        if (!window.confirm('Delete this past-work entry? This will be published live and permanently recorded in git history.')) return;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'delete', url: entry.url }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setPastWork((prev) => prev.filter((e) => e.url !== entry.url));
            setSavedOrder((prev) => prev.filter((u) => u !== entry.url));
            setItemStatus({ message: 'Deleted — live shortly', isError: false });
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
        }
    }

    async function handleAddSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        if (!file) return;

        const formData = new FormData();
        formData.append('meta', JSON.stringify({ type: 'past-work', action: 'add', caption, nsfw, giftArt }));
        formData.append('image', file);

        setItemStatus({ message: 'Publishing...', isError: false });
        try {
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setItemStatus({ message: 'Published — live shortly', isError: false });
            setPastWork((prev) => [...prev, result.entry]);
            setSavedOrder((prev) => [...prev, result.entry.url]);
            setCaption('');
            setNsfw(false);
            setGiftArt(false);
            setFile(null);
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
        }
    }

    const orderDirty = isOrderDirty(pastWork, savedOrder);
    const shownOrderStatus = loadError ? { message: LOAD_ERROR_MESSAGE, isError: true } : orderStatus;
    const shownItemStatus = loadError ? { message: LOAD_ERROR_MESSAGE, isError: true } : itemStatus;

    return (
        <>
            <section className="admin-panel">
                <h2>Manage Past Work</h2>
                <div id="past-work-list">
                    {pastWork.map((entry, index) => (
                        <div className="past-work-list-row" key={entry.url}>
                            <img className="past-work-list-thumb" src={entry.url} alt="" />
                            <span className="past-work-list-caption">{entry.caption || ''}</span>
                            <label><input type="checkbox" checked={Boolean(entry.nsfw)} onChange={(e) => toggleField(entry, 'nsfw', e.target.checked)} /> NSFW</label>
                            <label><input type="checkbox" checked={Boolean(entry.giftArt)} onChange={(e) => toggleField(entry, 'giftArt', e.target.checked)} /> Gift art</label>
                            <button type="button" disabled={index === 0} onClick={() => move(entry, -1)}>↑</button>
                            <button type="button" disabled={index === pastWork.length - 1} onClick={() => move(entry, 1)}>↓</button>
                            <button type="button" onClick={() => editCaption(entry)}>Edit caption</button>
                            <button type="button" className="danger-button" onClick={() => deleteEntry(entry)}>Delete</button>
                        </div>
                    ))}
                </div>
                <button type="button" id="past-work-save-order" disabled={!orderDirty || Boolean(loadError)} onClick={saveOrder}>Save Order</button>
                <p className={`admin-status ${shownOrderStatus.isError ? 'error' : 'success'}`}>{shownOrderStatus.message}</p>
            </section>

            <section className="admin-panel">
                <h2>Add Past Work</h2>
                <form onSubmit={handleAddSubmit}>
                    <label htmlFor="past-work-image">Image</label>
                    <input type="file" id="past-work-image" accept="image/png,image/jpeg,image/webp" required onChange={(e) => setFile(e.target.files[0] || null)} />

                    <label htmlFor="past-work-caption">Caption</label>
                    <input type="text" id="past-work-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />

                    <label><input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} /> NSFW</label>
                    <label><input type="checkbox" checked={giftArt} onChange={(e) => setGiftArt(e.target.checked)} /> Gift art (not commissioned)</label>

                    <button type="submit" disabled={Boolean(loadError)}>Publish Past Work</button>
                    <p className={`admin-status ${shownItemStatus.isError ? 'error' : 'success'}`}>{shownItemStatus.message}</p>
                </form>
            </section>
        </>
    );
}
