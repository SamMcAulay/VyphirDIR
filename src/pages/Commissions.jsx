import { useEffect, useState } from 'react';
import CommissionTierList from '../components/CommissionTierList.jsx';
import PastWorkGrid from '../components/PastWorkGrid.jsx';

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
        <div className="datapad-wrapper datapad-wrapper--wide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-palette" /> Commissions</h1>
                <div className="links-grid">
                    <a href="/queue" className="link-btn"><i className="fa-solid fa-list-check" /> Queue</a>
                    <a href="/tos" className="link-btn"><i className="fa-solid fa-file-contract" /> Terms of Service</a>
                </div>
                {error && <p className="feed-error">&gt; DATA UNAVAILABLE.</p>}
                {data && (
                    <>
                        <div className={`commission-status ${data.status ? 'open' : 'closed'}`}>
                            {data.status ? 'COMMISSIONS OPEN' : 'COMMISSIONS CLOSED'}
                        </div>
                        {data.specialOffer && <div className="commission-special-offer">{data.specialOffer}</div>}
                        <p>{data.intro || ''}</p>
                        <h2 className="section-title">Tiers</h2>
                        <CommissionTierList tiers={data.tiers || []} />
                        <h2 className="section-title">Past Work</h2>
                        <PastWorkGrid items={data.pastWork || []} />
                    </>
                )}
            </div>
        </div>
    );
}
