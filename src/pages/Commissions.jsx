import { useEffect, useState } from 'react';
import CommissionTierList from '../components/CommissionTierList.jsx';
import PastWorkGrid from '../components/PastWorkGrid.jsx';
import { BLOB_PATHS } from '../components/decor/blob-paths.js';
import { LOAD_ERROR } from '../components/messages.js';

export function CommissionsContent({ data }) {
    const open = Boolean(data.status);
    const pastWork = data.pastWork || [];
    return (
        <>
            <section className="commissions-top">
                <p className={`status-sticker status-sticker--${open ? 'open' : 'closed'}`}>
                    <svg className="status-sticker__blob" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                        <path d={BLOB_PATHS[2]} />
                    </svg>
                    <span className="status-sticker__text">{open ? 'Commissions open!' : 'Commissions closed'}</span>
                </p>
                <div className="commissions-intro">
                    {data.intro && <p className="commissions-intro__text">{data.intro}</p>}
                    {data.specialOffer && <p className="commissions-offer">{data.specialOffer}</p>}
                </div>
            </section>
            <CommissionTierList tiers={data.tiers || []} />
            {pastWork.length > 0 && (
                <>
                    <h2 className="past-work-title">Past work</h2>
                    <PastWorkGrid items={pastWork} />
                </>
            )}
        </>
    );
}

export default function Commissions() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then(setData)
            .catch((err) => {
                console.error(err);
                setError(true);
            });
    }, []);

    return (
        <div className="page-honey page-frame">
            <h1 className="sr-only">Commissions</h1>
            {error && <p className="page-message">{LOAD_ERROR}</p>}
            {data && <CommissionsContent data={data} />}
        </div>
    );
}
