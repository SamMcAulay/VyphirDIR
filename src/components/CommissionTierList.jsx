import { useRef } from 'react';
import { cx } from './cx.js';
import { useScrollStrip } from '../hooks/useScrollStrip.js';

export default function CommissionTierList({ tiers }) {
    const stripRef = useRef(null);
    const { overflowing, activeIndex, nudge } = useScrollStrip(stripRef, tiers.length);

    if (tiers.length === 0) return null;

    return (
        <div className={cx('tiers', overflowing && 'tiers--overflowing')}>
            {overflowing && (
                <div className="tiers__hint">
                    <span>{tiers.length} tiers · swipe &rarr;</span>
                    <span className="tiers__dots" aria-hidden="true">
                        {tiers.map((_, i) => (
                            <span key={i} className={cx('tiers__dot', i === activeIndex && 'is-active')} />
                        ))}
                    </span>
                </div>
            )}
            <div
                ref={stripRef}
                className={cx('tiers__strip', nudge && 'tiers__strip--nudge')}
                role="region"
                aria-label="Commission tiers"
                tabIndex={0}
            >
                {tiers.map((tier, i) => (
                    <article className="tier" key={i}>
                        {tier.example && <img className="tier__image" src={tier.example} alt={tier.name} loading="lazy" />}
                        <h2 className="tier__name">{tier.name}</h2>
                        {tier.price && <p className="tier__price">{tier.price}</p>}
                        {tier.description && <p className="tier__description">{tier.description}</p>}
                    </article>
                ))}
            </div>
        </div>
    );
}
