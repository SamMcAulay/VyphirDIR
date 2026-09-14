import { useEffect, useState } from 'react';
import CommissionTierList from '../components/CommissionTierList.jsx';
import LinkButton from '../components/LinkButton.jsx';
import PastWorkGrid from '../components/PastWorkGrid.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';

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
        <div className="page-honey">
            <Panel wide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Commissions" />
                <div className="links-grid">
                    <LinkButton href="/queue/" icon="fa-solid fa-list-check">Queue</LinkButton>
                    <LinkButton href="/tos/" icon="fa-solid fa-file-contract">Terms of Service</LinkButton>
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
            </Panel>
        </div>
    );
}
