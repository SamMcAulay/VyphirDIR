export default function CommissionTierList({ tiers }) {
    return (
        <>
            {tiers.map((tier, i) => (
                <div className="tier-card" key={i}>
                    {tier.example && <img src={tier.example} alt={tier.name} />}
                    <h3>{tier.name}<span className="tier-price">{tier.price ? ` — ${tier.price}` : ''}</span></h3>
                    <p>{tier.description || ''}</p>
                </div>
            ))}
        </>
    );
}
